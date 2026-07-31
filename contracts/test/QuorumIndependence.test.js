import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

/**
 * Quorum Independence Test
 *
 * Scenario: 5 "burner" agents (4 YES, 1 NO) + 5 "council" agents (all NO).
 *
 * Proves:
 *   1. Burner YES weight alone meets the quorum threshold.
 *   2. Council all-NO votes don't block quorum from being met.
 *   3. The proposal outcome (Approved/Rejected) depends on weight comparison,
 *      but the quorum bar is independently satisfied by burner agents alone —
 *      council votes are "non-load-bearing" for quorum purposes.
 */
describe("Quorum Independence: Council all-NO, burner swarm carries quorum", function () {
  let registry, voting;
  let owner;
  let burners = [];  // 5 burner agents
  let council = [];  // 5 council agents

  const COMMIT_WINDOW = 60;
  const REVEAL_WINDOW = 60;
  // Quorum threshold set to 2000:
  //   4 burner YES × 500 rep = 2000 — exactly meets quorum
  //   This proves burner weight alone is sufficient, no council YES needed.
  const QUORUM_THRESHOLD = 2000;

  function computeHash(choice, salt, voterAddress) {
    return hre.ethers.solidityPackedKeccak256(
      ["bool", "bytes32", "address"],
      [choice, salt, voterAddress]
    );
  }

  beforeEach(async function () {
    // Hardhat provides 20 accounts by default; we need 1 owner + 10 agents = 11
    const signers = await hre.ethers.getSigners();
    owner = signers[0];
    burners = signers.slice(1, 6);   // indices 1–5
    council = signers.slice(6, 11);  // indices 6–10

    // Deploy AgentRegistry
    const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
    registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    // Register all 10 agents (each starts at 500 rep)
    for (let i = 0; i < burners.length; i++) {
      await registry.register(burners[i].address, `Burner ${i}`);
    }
    for (let i = 0; i < council.length; i++) {
      await registry.register(council[i].address, `Council ${i}`);
    }

    // Deploy SynodVoting
    const SynodVoting = await hre.ethers.getContractFactory("SynodVoting");
    voting = await SynodVoting.deploy(await registry.getAddress());
    await voting.waitForDeployment();

    await registry.setVotingContract(await voting.getAddress());
  });

  it("should reach quorum from burner YES votes alone when all 5 council agents vote NO", async function () {
    // ── Create proposal with quorum = 2000 ──
    const tx = await voting.submitProposal(
      "Council all-NO quorum independence test",
      hre.ethers.parseEther("1"),
      owner.address,
      COMMIT_WINDOW,
      REVEAL_WINDOW,
      QUORUM_THRESHOLD
    );
    await tx.wait();
    const proposalId = Number(await voting.proposalCount());

    // ── Burner votes: 4 YES, 1 NO (mirrors hardcoded 80/20 split) ──
    const burnerSalts = burners.map((_, i) => hre.ethers.id(`burner-salt-${i}`));
    const burnerChoices = [true, true, true, true, false]; // 4 YES, 1 NO

    // ── Council votes: ALL NO ──
    const councilSalts = council.map((_, i) => hre.ethers.id(`council-salt-${i}`));
    const councilChoices = [false, false, false, false, false]; // 5 NO

    // ── COMMIT (all 10) ──
    for (let i = 0; i < burners.length; i++) {
      const hash = computeHash(burnerChoices[i], burnerSalts[i], burners[i].address);
      await voting.connect(burners[i]).commitVote(proposalId, hash);
    }
    for (let i = 0; i < council.length; i++) {
      const hash = computeHash(councilChoices[i], councilSalts[i], council[i].address);
      await voting.connect(council[i]).commitVote(proposalId, hash);
    }

    expect(await voting.getVoterCount(proposalId)).to.equal(10);

    // ── Advance past commit window ──
    await time.increase(COMMIT_WINDOW + 1);

    // ── REVEAL (all 10) ──
    for (let i = 0; i < burners.length; i++) {
      await voting.connect(burners[i])["revealVote(uint256,bool,bytes32)"](
        proposalId, burnerChoices[i], burnerSalts[i]
      );
    }
    for (let i = 0; i < council.length; i++) {
      await voting.connect(council[i])["revealVote(uint256,bool,bytes32)"](
        proposalId, councilChoices[i], councilSalts[i]
      );
    }

    // ── Advance past reveal window ──
    await time.increase(REVEAL_WINDOW + 1);

    // ── TALLY ──
    await voting.tallyVotes(proposalId);

    // ── ASSERTIONS ──
    const p = await voting.getProposal(proposalId);

    // 1. YES weight = 4 burner × 500 = 2000
    expect(p.yesWeight).to.equal(2000);
    // 2. NO weight = 1 burner × 500 + 5 council × 500 = 3000
    expect(p.noWeight).to.equal(3000);
    // 3. YES counts
    expect(p.yesCount).to.equal(4);
    // 4. NO counts
    expect(p.noCount).to.equal(6);
    // 5. Quorum IS met: yesWeight (2000) >= quorumThreshold (2000)
    expect(p.yesWeight).to.be.greaterThanOrEqual(p.quorumThreshold);

    // 6. Outcome is Rejected because noWeight > yesWeight.
    //    This is expected and correct — council NO votes legitimately
    //    affect the outcome, but they DON'T prevent quorum from being met.
    //    The quorum bar is independently satisfied by burner YES votes alone.
    expect(p.status).to.equal(2); // Rejected

    console.log("  ✅ Quorum met by burner YES weight alone (2000 >= 2000)");
    console.log("  ✅ Council 5× NO added 2500 to noWeight but did NOT block quorum");
    console.log("  ✅ Outcome: Rejected (3000 NO > 2000 YES) — council votes are advisory, not load-bearing for quorum");
  });

  it("should approve when council votes are mixed (not all NO)", async function () {
    // Same setup but council has 2 YES / 3 NO instead of 5 NO.
    // YES: 4 burner + 2 council = 3000 weight
    // NO:  1 burner + 3 council = 2000 weight → Approved
    const tx = await voting.submitProposal(
      "Council mixed vote test",
      hre.ethers.parseEther("1"),
      owner.address,
      COMMIT_WINDOW,
      REVEAL_WINDOW,
      QUORUM_THRESHOLD
    );
    await tx.wait();
    const proposalId = Number(await voting.proposalCount());

    const burnerSalts = burners.map((_, i) => hre.ethers.id(`mix-burner-salt-${i}`));
    const burnerChoices = [true, true, true, true, false];

    const councilSalts = council.map((_, i) => hre.ethers.id(`mix-council-salt-${i}`));
    const councilChoices = [true, true, false, false, false]; // 2 YES, 3 NO

    for (let i = 0; i < burners.length; i++) {
      const hash = computeHash(burnerChoices[i], burnerSalts[i], burners[i].address);
      await voting.connect(burners[i]).commitVote(proposalId, hash);
    }
    for (let i = 0; i < council.length; i++) {
      const hash = computeHash(councilChoices[i], councilSalts[i], council[i].address);
      await voting.connect(council[i]).commitVote(proposalId, hash);
    }

    await time.increase(COMMIT_WINDOW + 1);

    for (let i = 0; i < burners.length; i++) {
      await voting.connect(burners[i])["revealVote(uint256,bool,bytes32)"](
        proposalId, burnerChoices[i], burnerSalts[i]
      );
    }
    for (let i = 0; i < council.length; i++) {
      await voting.connect(council[i])["revealVote(uint256,bool,bytes32)"](
        proposalId, councilChoices[i], councilSalts[i]
      );
    }

    await time.increase(REVEAL_WINDOW + 1);
    await voting.tallyVotes(proposalId);

    const p = await voting.getProposal(proposalId);

    // YES: 4 burner + 2 council = 6 × 500 = 3000
    expect(p.yesWeight).to.equal(3000);
    // NO:  1 burner + 3 council = 4 × 500 = 2000
    expect(p.noWeight).to.equal(2000);
    // Approved (3000 > 2000 and 3000 >= 2000 quorum)
    expect(p.status).to.equal(1);

    console.log("  ✅ With council 2 YES / 3 NO: Approved (3000 YES > 2000 NO)");
    console.log("  ✅ Council YES votes add weight but are not required for quorum");
  });
});
