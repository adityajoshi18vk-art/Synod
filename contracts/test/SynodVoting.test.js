import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

describe("SynodVoting", function () {
  let registry, voting;
  let owner, agent1, agent2, agent3, nonAgent;

  const COMMIT_WINDOW = 3600;
  const REVEAL_WINDOW = 3600;
  const QUORUM = 2;

  function computeHash(choice, salt, voterAddress) {
    return hre.ethers.solidityPackedKeccak256(
      ["bool", "bytes32", "address"],
      [choice, salt, voterAddress]
    );
  }

  beforeEach(async function () {
    [owner, agent1, agent2, agent3, nonAgent] = await hre.ethers.getSigners();

    const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
    registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    await registry.register(agent1.address, "Agent Alpha");
    await registry.register(agent2.address, "Agent Beta");
    await registry.register(agent3.address, "Agent Gamma");

    const SynodVoting = await hre.ethers.getContractFactory("SynodVoting");
    voting = await SynodVoting.deploy(await registry.getAddress());
    await voting.waitForDeployment();

    // Allow voting contract to update reputations
    await registry.setVotingContract(await voting.getAddress());
  });

  async function createProposal(quorum = QUORUM) {
    const tx = await voting.submitProposal(
      "Execute trade: buy 10 ETH",
      hre.ethers.parseEther("1"),
      owner.address,
      COMMIT_WINDOW,
      REVEAL_WINDOW,
      quorum
    );
    await tx.wait();
    return Number(await voting.proposalCount());
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Phase 1: HAPPY PATH (commit → reveal → tally) — backward compat
  // ═══════════════════════════════════════════════════════════════════

  describe("Happy path: commit → reveal → tally", function () {
    it("should allow registered agents to commit, reveal, and tally", async function () {
      const proposalId = await createProposal();

      const salt1 = hre.ethers.id("salt-agent1");
      const salt2 = hre.ethers.id("salt-agent2");
      const salt3 = hre.ethers.id("salt-agent3");

      const hash1 = computeHash(true, salt1, agent1.address);
      const hash2 = computeHash(false, salt2, agent2.address);
      const hash3 = computeHash(true, salt3, agent3.address);

      await voting.connect(agent1).commitVote(proposalId, hash1);
      await voting.connect(agent2).commitVote(proposalId, hash2);
      await voting.connect(agent3).commitVote(proposalId, hash3);

      expect(await voting.getVoterCount(proposalId)).to.equal(3);

      await time.increase(COMMIT_WINDOW + 1);

      // Use backward-compatible revealVote (no rationale)
      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt1);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, false, salt2);
      await voting.connect(agent3)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt3);

      await time.increase(REVEAL_WINDOW + 1);

      await voting.tallyVotes(proposalId);

      const proposal = await voting.getProposal(proposalId);
      expect(proposal.status).to.equal(1); // Approved
      // All agents start at 500 rep, so 2*500 > 1*500
      expect(proposal.yesCount).to.equal(2);
      expect(proposal.noCount).to.equal(1);
      expect(proposal.tallied).to.be.true;
    });

    it("should reject a proposal when no votes beat yes votes", async function () {
      const proposalId = await createProposal();

      const salt1 = hre.ethers.id("s1");
      const salt2 = hre.ethers.id("s2");

      const hash1 = computeHash(false, salt1, agent1.address);
      const hash2 = computeHash(false, salt2, agent2.address);

      await voting.connect(agent1).commitVote(proposalId, hash1);
      await voting.connect(agent2).commitVote(proposalId, hash2);

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, false, salt1);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, false, salt2);

      await time.increase(REVEAL_WINDOW + 1);

      await voting.tallyVotes(proposalId);

      const proposal = await voting.getProposal(proposalId);
      expect(proposal.status).to.equal(2); // Rejected
      expect(proposal.yesCount).to.equal(0);
      expect(proposal.noCount).to.equal(2);
    });

    it("should reject when quorum is not met", async function () {
      // quorum threshold = 1000 (needs 2 agents * 500 rep minimum)
      const proposalId = await createProposal(1000);

      const salt1 = hre.ethers.id("only-one");
      const hash1 = computeHash(true, salt1, agent1.address);

      await voting.connect(agent1).commitVote(proposalId, hash1);

      await time.increase(COMMIT_WINDOW + 1);
      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt1);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(proposalId);

      const proposal = await voting.getProposal(proposalId);
      expect(proposal.status).to.equal(2); // Rejected — 500 < 1000 quorum
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  MISMATCHED REVEAL
  // ═══════════════════════════════════════════════════════════════════

  describe("Mismatched reveal", function () {
    it("should revert if revealed choice or salt don't match the commit hash", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("real-salt");
      const wrongSalt = hre.ethers.id("wrong-salt");
      const hash = computeHash(true, salt, agent1.address);

      await voting.connect(agent1).commitVote(proposalId, hash);
      await time.increase(COMMIT_WINDOW + 1);

      await expect(
        voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, wrongSalt)
      ).to.be.revertedWith("Hash mismatch");

      await expect(
        voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, false, salt)
      ).to.be.revertedWith("Hash mismatch");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  REVEAL OUTSIDE WINDOW
  // ═══════════════════════════════════════════════════════════════════

  describe("Reveal outside the window", function () {
    it("should revert if revealed during the commit window (too early)", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("early-reveal");
      const hash = computeHash(true, salt, agent1.address);

      await voting.connect(agent1).commitVote(proposalId, hash);

      await expect(
        voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt)
      ).to.be.revertedWith("Commit window still open");
    });

    it("should revert if revealed after the reveal deadline (too late)", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("late-reveal");
      const hash = computeHash(true, salt, agent1.address);

      await voting.connect(agent1).commitVote(proposalId, hash);

      await time.increase(COMMIT_WINDOW + REVEAL_WINDOW + 1);

      await expect(
        voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt)
      ).to.be.revertedWith("Reveal window closed");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  NON-REGISTERED ADDRESS
  // ═══════════════════════════════════════════════════════════════════

  describe("Non-registered address", function () {
    it("should revert if a non-registered address tries to commit", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("intruder");
      const hash = computeHash(true, salt, nonAgent.address);

      await expect(
        voting.connect(nonAgent).commitVote(proposalId, hash)
      ).to.be.revertedWith("Caller is not a registered agent");
    });

    it("should revert if a non-registered address tries to reveal", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("intruder-reveal");

      await time.increase(COMMIT_WINDOW + 1);

      await expect(
        voting.connect(nonAgent)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt)
      ).to.be.revertedWith("Caller is not a registered agent");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  EDGE CASES
  // ═══════════════════════════════════════════════════════════════════

  describe("Edge cases", function () {
    it("should revert on double commit", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("double");
      const hash = computeHash(true, salt, agent1.address);

      await voting.connect(agent1).commitVote(proposalId, hash);

      await expect(
        voting.connect(agent1).commitVote(proposalId, hash)
      ).to.be.revertedWith("Already committed");
    });

    it("should revert on double reveal", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("double-reveal");
      const hash = computeHash(true, salt, agent1.address);

      await voting.connect(agent1).commitVote(proposalId, hash);
      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt);

      await expect(
        voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt)
      ).to.be.revertedWith("Already revealed");
    });

    it("should revert on tally before reveal window closes", async function () {
      const proposalId = await createProposal();
      await expect(
        voting.tallyVotes(proposalId)
      ).to.be.revertedWith("Reveal window still open");
    });

    it("should revert on double tally", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("tally-double");
      const hash = computeHash(true, salt, agent1.address);

      await voting.connect(agent1).commitVote(proposalId, hash);
      await time.increase(COMMIT_WINDOW + 1);
      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt);
      await time.increase(REVEAL_WINDOW + 1);

      await voting.tallyVotes(proposalId);

      await expect(
        voting.tallyVotes(proposalId)
      ).to.be.revertedWith("Already tallied");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Phase 2: REPUTATION-WEIGHTED TALLY
  // ═══════════════════════════════════════════════════════════════════

  describe("Reputation-weighted tally", function () {
    it("should weight votes by agent reputation at commit time", async function () {
      const proposalId = await createProposal();

      // All agents start at 500 rep — equal weight
      const salt1 = hre.ethers.id("w1");
      const salt2 = hre.ethers.id("w2");
      const salt3 = hre.ethers.id("w3");

      await voting.connect(agent1).commitVote(proposalId, computeHash(true, salt1, agent1.address));
      await voting.connect(agent2).commitVote(proposalId, computeHash(true, salt2, agent2.address));
      await voting.connect(agent3).commitVote(proposalId, computeHash(false, salt3, agent3.address));

      // Verify weights captured at commit time
      const vote1 = await voting.getVote(proposalId, agent1.address);
      expect(vote1.weight).to.equal(500);

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt1);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt2);
      await voting.connect(agent3)["revealVote(uint256,bool,bytes32)"](proposalId, false, salt3);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(proposalId);

      const p = await voting.getProposal(proposalId);
      expect(p.yesWeight).to.equal(1000); // 500 + 500
      expect(p.noWeight).to.equal(500);    // 500
      expect(p.status).to.equal(1);        // Approved
    });

    it("high-rep agent should outweigh two low-rep agents", async function () {
      // First, run a proposal to shift reputations:
      // Agent1 votes YES (correct), agents 2+3 vote NO (incorrect) → Approved
      const p1 = await createProposal();
      const s1a = hre.ethers.id("p1-a1"); const s1b = hre.ethers.id("p1-a2"); const s1c = hre.ethers.id("p1-a3");

      await voting.connect(agent1).commitVote(p1, computeHash(true, s1a, agent1.address));
      await voting.connect(agent2).commitVote(p1, computeHash(true, s1b, agent2.address));
      await voting.connect(agent3).commitVote(p1, computeHash(false, s1c, agent3.address));

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](p1, true, s1a);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](p1, true, s1b);
      await voting.connect(agent3)["revealVote(uint256,bool,bytes32)"](p1, false, s1c);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(p1); // Approved → agent1,2 correct, agent3 incorrect

      // Check updated reputations:
      // Agent1: 0.8*500 + 0.2*1000 = 600
      // Agent2: 0.8*500 + 0.2*1000 = 600
      // Agent3: 0.8*500 + 0.2*0    = 400
      expect(await registry.getReputation(agent1.address)).to.equal(600);
      expect(await registry.getReputation(agent2.address)).to.equal(600);
      expect(await registry.getReputation(agent3.address)).to.equal(400);

      // Now: second proposal. Agent1 (600) votes YES, agents 2+3 vote NO.
      // YES weight = 600, NO weight = 600 + 400 = 1000
      // Should be Rejected because noWeight > yesWeight
      const p2 = await createProposal();
      const s2a = hre.ethers.id("p2-a1"); const s2b = hre.ethers.id("p2-a2"); const s2c = hre.ethers.id("p2-a3");

      await voting.connect(agent1).commitVote(p2, computeHash(true, s2a, agent1.address));
      await voting.connect(agent2).commitVote(p2, computeHash(false, s2b, agent2.address));
      await voting.connect(agent3).commitVote(p2, computeHash(false, s2c, agent3.address));

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](p2, true, s2a);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](p2, false, s2b);
      await voting.connect(agent3)["revealVote(uint256,bool,bytes32)"](p2, false, s2c);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(p2);

      const result = await voting.getProposal(p2);
      expect(result.yesWeight).to.equal(600);
      expect(result.noWeight).to.equal(1000);
      expect(result.status).to.equal(2); // Rejected
    });

    it("should update reputations after tally (EMA formula)", async function () {
      const proposalId = await createProposal();

      const salt1 = hre.ethers.id("ema1");
      const salt2 = hre.ethers.id("ema2");

      await voting.connect(agent1).commitVote(proposalId, computeHash(true, salt1, agent1.address));
      await voting.connect(agent2).commitVote(proposalId, computeHash(false, salt2, agent2.address));

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt1);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, false, salt2);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(proposalId); // Approved (500 > 500 tie? actually yes=500, no=500 → not approved since not strictly >)

      // Actually: yesWeight=500, noWeight=500, yes is NOT > no → Rejected
      const p = await voting.getProposal(proposalId);
      expect(p.status).to.equal(2); // Rejected (tie)

      // Agent1 voted YES (incorrect, outcome=Rejected): 0.8*500 + 0.2*0 = 400
      // Agent2 voted NO (correct, outcome=Rejected):    0.8*500 + 0.2*1000 = 600
      expect(await registry.getReputation(agent1.address)).to.equal(400);
      expect(await registry.getReputation(agent2.address)).to.equal(600);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Phase 2: RATIONALE FIELD
  // ═══════════════════════════════════════════════════════════════════

  describe("Rationale field", function () {
    it("should store and emit rationale with the reveal", async function () {
      const proposalId = await createProposal();

      const salt = hre.ethers.id("rationale-test");
      const hash = computeHash(true, salt, agent1.address);
      const rationale = "Risk assessment indicates favorable market conditions for this trade.";

      await voting.connect(agent1).commitVote(proposalId, hash);
      await time.increase(COMMIT_WINDOW + 1);

      const tx = await voting.connect(agent1)["revealVote(uint256,bool,bytes32,string)"](
        proposalId, true, salt, rationale
      );
      const receipt = await tx.wait();

      // Check stored rationale
      const vote = await voting.getVote(proposalId, agent1.address);
      expect(vote.rationale).to.equal(rationale);

      // Check event
      const event = receipt.logs.find(
        log => voting.interface.parseLog(log)?.name === "VoteRevealed"
      );
      const parsed = voting.interface.parseLog(event);
      expect(parsed.args.rationale).to.equal(rationale);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
//  SynodEscrow Tests
// ═══════════════════════════════════════════════════════════════════

describe("SynodEscrow", function () {
  let registry, voting, escrow, timelock;
  let owner, agent1, agent2, proposer, target;

  const COMMIT_WINDOW = 3600;
  const REVEAL_WINDOW = 3600;
  const QUORUM = 2;
  const MIN_DELAY = 60; // 60s for demo

  function computeHash(choice, salt, voterAddress) {
    return hre.ethers.solidityPackedKeccak256(
      ["bool", "bytes32", "address"],
      [choice, salt, voterAddress]
    );
  }

  beforeEach(async function () {
    [owner, agent1, agent2, proposer, target] = await hre.ethers.getSigners();

    // Deploy AgentRegistry
    const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
    registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    await registry.register(agent1.address, "Agent Alpha");
    await registry.register(agent2.address, "Agent Beta");

    // Deploy SynodVoting
    const SynodVoting = await hre.ethers.getContractFactory("SynodVoting");
    voting = await SynodVoting.deploy(await registry.getAddress());
    await voting.waitForDeployment();

    await registry.setVotingContract(await voting.getAddress());

    // Deploy TimelockController
    const TimelockController = await hre.ethers.getContractFactory("TimelockController");
    timelock = await TimelockController.deploy(
      MIN_DELAY,
      [owner.address],  // proposers
      [owner.address],  // executors
      owner.address     // admin
    );
    await timelock.waitForDeployment();

    // Deploy SynodEscrow
    const SynodEscrow = await hre.ethers.getContractFactory("SynodEscrow");
    escrow = await SynodEscrow.deploy(
      await voting.getAddress(),
      await timelock.getAddress()
    );
    await escrow.waitForDeployment();
  });

  async function createAndApproveProposal() {
    const tx = await voting.connect(proposer).submitProposal(
      "Buy 10 ETH",
      hre.ethers.parseEther("1"),
      target.address,
      COMMIT_WINDOW,
      REVEAL_WINDOW,
      QUORUM
    );
    await tx.wait();
    const proposalId = Number(await voting.proposalCount());

    // Both agents vote YES
    const salt1 = hre.ethers.id("e-s1");
    const salt2 = hre.ethers.id("e-s2");

    await voting.connect(agent1).commitVote(proposalId, computeHash(true, salt1, agent1.address));
    await voting.connect(agent2).commitVote(proposalId, computeHash(true, salt2, agent2.address));

    await time.increase(COMMIT_WINDOW + 1);

    await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt1);
    await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt2);

    await time.increase(REVEAL_WINDOW + 1);

    await voting.tallyVotes(proposalId);

    return proposalId;
  }

  describe("Deposit and release", function () {
    it("should accept a deposit and release on approval", async function () {
      // Create proposal first, then deposit while still pending
      const tx = await voting.connect(proposer).submitProposal(
        "Buy 10 ETH",
        hre.ethers.parseEther("1"),
        target.address,
        COMMIT_WINDOW,
        REVEAL_WINDOW,
        QUORUM
      );
      await tx.wait();
      const proposalId = Number(await voting.proposalCount());

      // Deposit
      await escrow.connect(proposer).deposit(proposalId, { value: hre.ethers.parseEther("1") });

      const deposit = await escrow.getDeposit(1);
      expect(deposit.amount).to.equal(hre.ethers.parseEther("1"));
      expect(deposit.proposalId).to.equal(proposalId);

      // Vote and approve
      const salt1 = hre.ethers.id("rel-s1");
      const salt2 = hre.ethers.id("rel-s2");

      await voting.connect(agent1).commitVote(proposalId, computeHash(true, salt1, agent1.address));
      await voting.connect(agent2).commitVote(proposalId, computeHash(true, salt2, agent2.address));

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt1);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt2);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(proposalId);

      // Release
      const targetBalBefore = await hre.ethers.provider.getBalance(target.address);
      await escrow.release(proposalId);
      const targetBalAfter = await hre.ethers.provider.getBalance(target.address);

      expect(targetBalAfter - targetBalBefore).to.equal(hre.ethers.parseEther("1"));
    });

    it("should refund on rejected proposal", async function () {
      const tx = await voting.connect(proposer).submitProposal(
        "Bad trade",
        hre.ethers.parseEther("0.5"),
        target.address,
        COMMIT_WINDOW,
        REVEAL_WINDOW,
        QUORUM
      );
      await tx.wait();
      const proposalId = Number(await voting.proposalCount());

      await escrow.connect(proposer).deposit(proposalId, { value: hre.ethers.parseEther("0.5") });

      // Both agents vote NO
      const salt1 = hre.ethers.id("ref-s1");
      const salt2 = hre.ethers.id("ref-s2");

      await voting.connect(agent1).commitVote(proposalId, computeHash(false, salt1, agent1.address));
      await voting.connect(agent2).commitVote(proposalId, computeHash(false, salt2, agent2.address));

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, false, salt1);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, false, salt2);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(proposalId);

      // Refund
      const depositorBalBefore = await hre.ethers.provider.getBalance(proposer.address);
      await escrow.connect(proposer).refund(proposalId);
      const depositorBalAfter = await hre.ethers.provider.getBalance(proposer.address);

      // Balance should increase (minus gas)
      expect(depositorBalAfter).to.be.greaterThan(depositorBalBefore);
    });

    it("should revert release when not approved", async function () {
      const tx = await voting.submitProposal(
        "test", hre.ethers.parseEther("1"), target.address,
        COMMIT_WINDOW, REVEAL_WINDOW, QUORUM
      );
      await tx.wait();
      const proposalId = Number(await voting.proposalCount());

      await escrow.deposit(proposalId, { value: hre.ethers.parseEther("1") });

      await expect(escrow.release(proposalId)).to.be.revertedWith("Proposal not approved");
    });

    it("should revert double release", async function () {
      const tx = await voting.connect(proposer).submitProposal(
        "test", hre.ethers.parseEther("0.1"), target.address,
        COMMIT_WINDOW, REVEAL_WINDOW, QUORUM
      );
      await tx.wait();
      const proposalId = Number(await voting.proposalCount());

      await escrow.connect(proposer).deposit(proposalId, { value: hre.ethers.parseEther("0.1") });

      const salt1 = hre.ethers.id("dr-s1");
      const salt2 = hre.ethers.id("dr-s2");

      await voting.connect(agent1).commitVote(proposalId, computeHash(true, salt1, agent1.address));
      await voting.connect(agent2).commitVote(proposalId, computeHash(true, salt2, agent2.address));

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt1);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt2);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(proposalId);

      await escrow.release(proposalId);
      await expect(escrow.release(proposalId)).to.be.revertedWith("Already released");
    });
  });

  describe("Guardian pause", function () {
    it("should block release when paused by guardian (timelock)", async function () {
      // Schedule a pause through the timelock
      const escrowAddr = await escrow.getAddress();
      const pauseData = escrow.interface.encodeFunctionData("pause");

      await timelock.schedule(
        escrowAddr, 0, pauseData,
        hre.ethers.ZeroHash, hre.ethers.ZeroHash, MIN_DELAY
      );

      await time.increase(MIN_DELAY + 1);

      await timelock.execute(
        escrowAddr, 0, pauseData,
        hre.ethers.ZeroHash, hre.ethers.ZeroHash
      );

      expect(await escrow.paused()).to.be.true;

      // Now try to release — should fail
      const tx = await voting.connect(proposer).submitProposal(
        "paused test", hre.ethers.parseEther("0.1"), target.address,
        COMMIT_WINDOW, REVEAL_WINDOW, QUORUM
      );
      await tx.wait();
      const proposalId = Number(await voting.proposalCount());

      await escrow.connect(proposer).deposit(proposalId, { value: hre.ethers.parseEther("0.1") });

      const salt1 = hre.ethers.id("pause-s1");
      const salt2 = hre.ethers.id("pause-s2");

      await voting.connect(agent1).commitVote(proposalId, computeHash(true, salt1, agent1.address));
      await voting.connect(agent2).commitVote(proposalId, computeHash(true, salt2, agent2.address));

      await time.increase(COMMIT_WINDOW + 1);

      await voting.connect(agent1)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt1);
      await voting.connect(agent2)["revealVote(uint256,bool,bytes32)"](proposalId, true, salt2);

      await time.increase(REVEAL_WINDOW + 1);
      await voting.tallyVotes(proposalId);

      await expect(escrow.release(proposalId)).to.be.revertedWith("Escrow is paused");
    });
  });
});
