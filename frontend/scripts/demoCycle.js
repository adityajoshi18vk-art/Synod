import { triggerDemoSwarm } from '../src/lib/simulator.js';
import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import { ADDRESSES, publicClient } from '../src/lib/config.js';
import { VOTING_ABI, ESCROW_ABI } from '../src/lib/abis.js';
import { runCouncilVote } from '../api/_lib/council.js';
import 'dotenv/config';

const deployerPk = '00658ab558bf712a46326e5818608d29b431f789f262f0d117e82c93ced05a2f'; 
const account = privateKeyToAccount(`0x${deployerPk}`);
const deployer = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(process.env.VITE_RPC_URL_PRIMARY || import.meta.env.VITE_RPC_URL_PRIMARY),
});

async function main() {
  console.log("=== CREATING NEW PROPOSAL ===");
  const { request } = await publicClient.simulateContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'submitProposal',
    args: ["Live Swarm Demo " + Date.now(), parseEther("0.001"), deployer.account.address, 90n, 90n, 1000n],
    account,
  });
  const txHash = await deployer.writeContract(request);
  const proposalReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (proposalReceipt.status === 'reverted') throw new Error(`Proposal creation reverted`);
  console.log(`  Proposal TX: ${txHash} status=${proposalReceipt.status}`);

  const count = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'proposalCount'
  });
  const proposalId = count;
  console.log(`  Created Proposal #${proposalId}`);

  console.log("\n=== DEPOSITING TO ESCROW ===");
  const { request: escrowReq } = await publicClient.simulateContract({
    address: ADDRESSES.escrow,
    abi: ESCROW_ABI,
    functionName: 'deposit',
    args: [proposalId],
    account,
    value: parseEther("0.001"),
  });
  const escrowTx = await deployer.writeContract(escrowReq);
  const escrowReceipt = await publicClient.waitForTransactionReceipt({ hash: escrowTx });
  if (escrowReceipt.status === 'reverted') throw new Error(`Escrow deposit reverted`);
  console.log(`  Escrow TX: ${escrowTx} status=${escrowReceipt.status}`);

  console.log("\n=== FETCHING COUNCIL DECISIONS (LIVE LLM) ===");
  const councilDecisions = await runCouncilVote({ 
    description: "Live Swarm Demo", 
    amount: "0.001", 
    target: deployer.account.address 
  });
  for (const d of councilDecisions) {
    console.log(`  ${d.name}: ${d.vote} (source=${d.source})`);
  }

  console.log("\n=== TRIGGERING DEMO SWARM ===");
  await triggerDemoSwarm(proposalId.toString(), councilDecisions);

  console.log("\n=== FETCHING FINAL ON-CHAIN STATE ===");
  const proposal = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'getProposal',
    args: [BigInt(proposalId)],
  });
  console.log(`  Proposal #${proposalId}:`);
  console.log(`    status:    ${proposal.status} (0=Pending, 1=Approved, 2=Rejected)`);
  console.log(`    tallied:   ${proposal.tallied}`);
  console.log(`    yesWeight: ${proposal.yesWeight}`);
  console.log(`    noWeight:  ${proposal.noWeight}`);
  console.log(`    yesCount:  ${proposal.yesCount}`);
  console.log(`    noCount:   ${proposal.noCount}`);
}

main().catch(err => {
  console.error("\n❌ FATAL ERROR:", err.message || err);
  process.exit(1);
});
