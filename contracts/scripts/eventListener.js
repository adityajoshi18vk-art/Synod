import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Event listener / indexer.
 * 
 * Listens to VoteCommitted, VoteRevealed, ProposalResolved, EscrowReleased,
 * and EscrowRefunded events from SynodVoting and SynodEscrow contracts.
 * 
 * Dumps all events to console as a live feed for Phase 3 frontend integration.
 * No database — purely client-side event indexing.
 * 
 * Run with: npx hardhat run scripts/eventListener.js --network monadTestnet
 */

// ── Canned rationale templates ──────────────────────────────────
const YES_RATIONALES = [
  "Risk assessment indicates favorable market conditions for this trade.",
  "Technical indicators align with the proposed action. Consensus is strong.",
  "Historical patterns support this decision. Proceeding with confidence.",
  "Volatility metrics are within acceptable bounds. Approving execution.",
];

const NO_RATIONALES = [
  "Current market conditions present elevated risk. Recommending caution.",
  "Insufficient data to support this action. Abstaining from approval.",
  "Counterparty risk exceeds acceptable thresholds. Voting against.",
  "Timing misalignment detected. Suggesting deferral of this action.",
];

export function getTemplatedRationale(choice, agentIndex = 0) {
  const templates = choice ? YES_RATIONALES : NO_RATIONALES;
  return templates[agentIndex % templates.length];
}

async function main() {
  const votingAddr = process.env.VOTING_ADDRESS;
  const escrowAddr = process.env.ESCROW_ADDRESS;

  if (!votingAddr) {
    throw new Error("Set VOTING_ADDRESS in .env");
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("  Synod Event Listener (live feed)");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Voting:  ${votingAddr}`);
  if (escrowAddr) console.log(`  Escrow:  ${escrowAddr}`);
  console.log("  Listening for events... (Ctrl+C to stop)\n");

  const voting = await hre.ethers.getContractAt("SynodVoting", votingAddr);

  // ── SynodVoting events ──────────────────────────────────────
  voting.on("ProposalCreated", (proposalId, proposer, description, amount, target, commitDeadline, revealDeadline, quorumThreshold) => {
    console.log(`[${new Date().toISOString()}] 📋 PROPOSAL CREATED`);
    console.log(`  ID: ${proposalId} | Proposer: ${proposer}`);
    console.log(`  "${description}"`);
    console.log(`  Amount: ${hre.ethers.formatEther(amount)} MON → ${target}`);
    console.log(`  Commit until: ${new Date(Number(commitDeadline) * 1000).toISOString()}`);
    console.log(`  Reveal until: ${new Date(Number(revealDeadline) * 1000).toISOString()}`);
    console.log(`  Quorum: ${quorumThreshold}\n`);
  });

  voting.on("VoteCommitted", (proposalId, voter, weight) => {
    console.log(`[${new Date().toISOString()}] 🔒 VOTE COMMITTED`);
    console.log(`  Proposal #${proposalId} | Voter: ${voter} | Weight: ${weight}\n`);
  });

  voting.on("VoteRevealed", (proposalId, voter, choice, weight, rationale) => {
    console.log(`[${new Date().toISOString()}] 🔓 VOTE REVEALED`);
    console.log(`  Proposal #${proposalId} | Voter: ${voter}`);
    console.log(`  Choice: ${choice ? "YES ✅" : "NO ❌"} | Weight: ${weight}`);
    if (rationale) console.log(`  Rationale: "${rationale}"`);
    console.log("");
  });

  voting.on("ProposalResolved", (proposalId, status, yesWeight, noWeight, yesCount, noCount) => {
    const statusLabels = ["Pending", "Approved", "Rejected", "Executed"];
    console.log(`[${new Date().toISOString()}] ⚖️  PROPOSAL RESOLVED`);
    console.log(`  Proposal #${proposalId} → ${statusLabels[Number(status)]}`);
    console.log(`  YES: ${yesWeight} weight (${yesCount} votes) | NO: ${noWeight} weight (${noCount} votes)\n`);
  });

  // ── SynodEscrow events ──────────────────────────────────────
  if (escrowAddr) {
    const escrow = await hre.ethers.getContractAt("SynodEscrow", escrowAddr);

    escrow.on("EscrowFunded", (depositId, proposalId, depositor, amount) => {
      console.log(`[${new Date().toISOString()}] 💰 ESCROW FUNDED`);
      console.log(`  Deposit #${depositId} | Proposal #${proposalId}`);
      console.log(`  ${depositor} deposited ${hre.ethers.formatEther(amount)} MON\n`);
    });

    escrow.on("EscrowReleased", (depositId, proposalId, target, amount) => {
      console.log(`[${new Date().toISOString()}] 🚀 ESCROW RELEASED`);
      console.log(`  Deposit #${depositId} | Proposal #${proposalId}`);
      console.log(`  ${hre.ethers.formatEther(amount)} MON → ${target}\n`);
    });

    escrow.on("EscrowRefunded", (depositId, proposalId, depositor, amount) => {
      console.log(`[${new Date().toISOString()}] ↩️  ESCROW REFUNDED`);
      console.log(`  Deposit #${depositId} | Proposal #${proposalId}`);
      console.log(`  ${hre.ethers.formatEther(amount)} MON → ${depositor}\n`);
    });

    escrow.on("EscrowPaused", (by) => {
      console.log(`[${new Date().toISOString()}] ⛔ ESCROW PAUSED by ${by}\n`);
    });

    escrow.on("EscrowUnpaused", (by) => {
      console.log(`[${new Date().toISOString()}] ✅ ESCROW UNPAUSED by ${by}\n`);
    });
  }

  // Keep the process alive
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
