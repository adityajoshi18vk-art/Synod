import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * End-to-end CLI script for Phase 1.
 *
 * 1. Registers 5 test agent addresses in AgentRegistry
 * 2. Submits one proposal in SynodVoting
 * 3. Commits + reveals votes from those agents
 * 4. Prints the raw tally (no reputation weighting)
 *
 * NOTE: This runs on a local Hardhat fork / in-process network
 *       because we need to fast-forward time for the commit/reveal
 *       windows, which isn't possible on a live testnet.
 *       Run with:  npx hardhat run scripts/e2eVoting.js
 */

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

  console.log("═══════════════════════════════════════════");
  console.log("  Synod Phase 1 — E2E Voting CLI");
  console.log("═══════════════════════════════════════════\n");

  // ── 1. Deploy fresh contracts (local network) ─────────────────
  console.log("1) Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  console.log(`   AgentRegistry: ${await registry.getAddress()}`);

  console.log("   Deploying SynodVoting...");
  const SynodVoting = await hre.ethers.getContractFactory("SynodVoting");
  const voting = await SynodVoting.deploy(await registry.getAddress());
  await voting.waitForDeployment();
  console.log(`   SynodVoting:   ${await voting.getAddress()}\n`);

  // ── 2. Register 5 agents ──────────────────────────────────────
  const agents = signers.slice(1, 6); // 5 agents
  const labels = [
    "Agent Alpha",
    "Agent Beta",
    "Agent Gamma",
    "Agent Delta",
    "Agent Epsilon",
  ];

  console.log("2) Registering 5 agents:");
  for (let i = 0; i < agents.length; i++) {
    await registry.register(agents[i].address, labels[i]);
    const agent = await registry.agents(agents[i].address);
    console.log(`   ✓ ${labels[i]} (${agents[i].address}) — reputation: ${agent.reputationScore}`);
  }

  // ── 3. Submit a proposal ──────────────────────────────────────
  const COMMIT_WINDOW = 300; // 5 minutes
  const REVEAL_WINDOW = 300; // 5 minutes
  const QUORUM = 3;

  console.log("\n3) Submitting proposal...");
  const tx = await voting.submitProposal(
    "Execute trade: buy 10 ETH at $3,200",
    hre.ethers.parseEther("10"),
    deployer.address,
    COMMIT_WINDOW,
    REVEAL_WINDOW,
    QUORUM
  );
  await tx.wait();
  const proposalId = 1;

  const proposal = await voting.getProposal(proposalId);
  console.log(`   Proposal #${proposal.id}: "${proposal.description}"`);
  console.log(`   Amount: ${hre.ethers.formatEther(proposal.amount)} ETH`);
  console.log(`   Quorum: ${proposal.quorumThreshold} votes`);

  // ── 4. Commit votes ───────────────────────────────────────────
  // Agents 0-2 vote YES, agents 3-4 vote NO
  const choices = [true, true, true, false, false];
  const salts = agents.map((_, i) => hre.ethers.id(`salt-agent-${i}`));

  console.log("\n4) Commit phase:");
  for (let i = 0; i < agents.length; i++) {
    const hash = hre.ethers.solidityPackedKeccak256(
      ["bool", "bytes32", "address"],
      [choices[i], salts[i], agents[i].address]
    );
    await voting.connect(agents[i]).commitVote(proposalId, hash);
    console.log(`   ✓ ${labels[i]} committed (vote hidden)`);
  }

  // ── 5. Fast-forward past commit window ────────────────────────
  console.log("\n   ⏩ Fast-forwarding past commit window...");
  await hre.network.provider.send("evm_increaseTime", [COMMIT_WINDOW + 1]);
  await hre.network.provider.send("evm_mine");

  // ── 6. Reveal votes ───────────────────────────────────────────
  console.log("\n5) Reveal phase:");
  for (let i = 0; i < agents.length; i++) {
    await voting.connect(agents[i]).revealVote(proposalId, choices[i], salts[i]);
    console.log(`   ✓ ${labels[i]} revealed: ${choices[i] ? "YES ✅" : "NO ❌"}`);
  }

  // ── 7. Fast-forward past reveal window ────────────────────────
  console.log("\n   ⏩ Fast-forwarding past reveal window...");
  await hre.network.provider.send("evm_increaseTime", [REVEAL_WINDOW + 1]);
  await hre.network.provider.send("evm_mine");

  // ── 8. Tally ──────────────────────────────────────────────────
  console.log("\n6) Tallying...");
  await voting.tallyVotes(proposalId);

  const result = await voting.getProposal(proposalId);
  const statusLabels = ["Pending", "Approved", "Rejected", "Executed"];

  console.log("\n═══════════════════════════════════════════");
  console.log("  TALLY RESULTS (raw — no rep weighting)");
  console.log("═══════════════════════════════════════════");
  console.log(`  Proposal: "${result.description}"`);
  console.log(`  YES: ${result.yesVotes}`);
  console.log(`  NO:  ${result.noVotes}`);
  console.log(`  Quorum met: ${Number(result.yesVotes) + Number(result.noVotes) >= Number(result.quorumThreshold) ? "YES" : "NO"}`);
  console.log(`  Status: ${statusLabels[Number(result.status)]}`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
