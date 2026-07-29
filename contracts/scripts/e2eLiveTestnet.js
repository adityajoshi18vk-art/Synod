import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Live Testnet E2E script.
 *
 * Tests commit-reveal against real Monad testnet block times.
 * Uses the deployer wallet as a single agent with short windows
 * (30s commit, 30s reveal) and waits real time.
 *
 * Run with: npx hardhat run scripts/e2eLiveTestnet.js --network monadTestnet
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const registryAddr = process.env.CONTRACT_ADDRESS;
  const votingAddr = process.env.VOTING_ADDRESS;

  if (!registryAddr || !votingAddr) {
    throw new Error("Set CONTRACT_ADDRESS and VOTING_ADDRESS in .env");
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("  Synod — Live Testnet E2E (real block times)");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Deployer:       ${deployer.address}`);
  console.log(`  AgentRegistry:  ${registryAddr}`);
  console.log(`  SynodVoting:    ${votingAddr}\n`);

  // Attach to deployed contracts
  const registry = await hre.ethers.getContractAt("AgentRegistry", registryAddr);
  const voting = await hre.ethers.getContractAt("SynodVoting", votingAddr);

  // ── 1. Register the deployer as an agent (skip if already registered) ──
  const isReg = await registry.isRegistered(deployer.address);
  if (!isReg) {
    console.log("1) Registering deployer as agent...");
    const regTx = await registry.register(deployer.address, "Deployer Agent");
    await regTx.wait();
    console.log("   ✓ Registered\n");
  } else {
    console.log("1) Deployer already registered ✓\n");
  }

  // ── 2. Submit proposal with SHORT windows ──
  const COMMIT_WINDOW = 30; // 30 seconds
  const REVEAL_WINDOW = 30; // 30 seconds
  const QUORUM = 1;

  console.log("2) Submitting proposal (30s commit, 30s reveal)...");
  const submitTx = await voting.submitProposal(
    "Live testnet smoke test",
    hre.ethers.parseEther("0.001"),
    deployer.address,
    COMMIT_WINDOW,
    REVEAL_WINDOW,
    QUORUM
  );
  const submitReceipt = await submitTx.wait();
  const proposalId = await voting.proposalCount();
  console.log(`   ✓ Proposal #${proposalId} created (tx: ${submitReceipt.hash})`);

  const proposal = await voting.getProposal(proposalId);
  const commitDeadline = Number(proposal.commitDeadline);
  const revealDeadline = Number(proposal.revealDeadline);
  console.log(`   Commit deadline: ${new Date(commitDeadline * 1000).toISOString()}`);
  console.log(`   Reveal deadline: ${new Date(revealDeadline * 1000).toISOString()}\n`);

  // ── 3. Commit vote ──
  const choice = true;
  const salt = hre.ethers.id("live-testnet-salt-" + Date.now());
  const hash = hre.ethers.solidityPackedKeccak256(
    ["bool", "bytes32", "address"],
    [choice, salt, deployer.address]
  );

  console.log("3) Committing vote...");
  const commitTx = await voting.commitVote(proposalId, hash);
  const commitReceipt = await commitTx.wait();
  console.log(`   ✓ Committed (tx: ${commitReceipt.hash})\n`);

  // ── 4. Wait for commit window to close ──
  console.log("4) Waiting for commit window to close...");
  while (true) {
    const block = await hre.ethers.provider.getBlock("latest");
    const remaining = commitDeadline - block.timestamp;
    if (remaining <= 0) break;
    process.stdout.write(`   ⏳ ${remaining}s remaining...\r`);
    await sleep(3000);
  }
  console.log("   ✓ Commit window closed                   \n");

  // ── 5. Reveal vote ──
  console.log("5) Revealing vote...");
  const revealTx = await voting.revealVote(proposalId, choice, salt);
  const revealReceipt = await revealTx.wait();
  console.log(`   ✓ Revealed: YES ✅ (tx: ${revealReceipt.hash})\n`);

  // ── 6. Wait for reveal window to close ──
  console.log("6) Waiting for reveal window to close...");
  while (true) {
    const block = await hre.ethers.provider.getBlock("latest");
    const remaining = revealDeadline - block.timestamp;
    if (remaining <= 0) break;
    process.stdout.write(`   ⏳ ${remaining}s remaining...\r`);
    await sleep(3000);
  }
  console.log("   ✓ Reveal window closed                   \n");

  // ── 7. Tally ──
  console.log("7) Tallying votes...");
  const tallyTx = await voting.tallyVotes(proposalId);
  const tallyReceipt = await tallyTx.wait();

  const result = await voting.getProposal(proposalId);
  const statusLabels = ["Pending", "Approved", "Rejected", "Executed"];

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  LIVE TESTNET TALLY RESULTS");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Proposal: "${result.description}"`);
  console.log(`  YES: ${result.yesVotes}`);
  console.log(`  NO:  ${result.noVotes}`);
  console.log(`  Status: ${statusLabels[Number(result.status)]}`);
  console.log(`  Tally tx: ${tallyReceipt.hash}`);
  console.log("═══════════════════════════════════════════════════\n");

  console.log("🎉 Live testnet E2E passed! Commit-reveal works with real block times.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
