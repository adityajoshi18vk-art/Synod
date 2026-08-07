import { triggerDemoSwarm } from '../src/lib/simulator.js';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import { ADDRESSES, publicClient } from '../src/lib/config.js';
import { VOTING_ABI, ESCROW_ABI } from '../src/lib/abis.js';
import 'dotenv/config';

const deployerPk = '00658ab558bf712a46326e5818608d29b431f789f262f0d117e82c93ced05a2f'; 
const account = privateKeyToAccount(`0x${deployerPk}`);
const deployer = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(process.env.VITE_RPC_URL_PRIMARY || import.meta.env.VITE_RPC_URL_PRIMARY),
});

// Two council patterns: majority-YES and majority-NO
const COUNCIL_PATTERNS = [
  { label: 'Council majority YES', decisions: [
    { name: 'Arjun', vote: 'YES', rationale: 'Test: Council agrees YES' },
    { name: 'Nova', vote: 'YES', rationale: 'Test: Council agrees YES' },
    { name: 'Sentinel', vote: 'YES', rationale: 'Test: Council agrees YES' },
    { name: 'Cipher', vote: 'NO', rationale: 'Test: Council dissents NO' },
    { name: 'Oracle', vote: 'NO', rationale: 'Test: Council dissents NO' },
  ]},
  { label: 'Council majority NO', decisions: [
    { name: 'Arjun', vote: 'NO', rationale: 'Test: Council dissents NO' },
    { name: 'Nova', vote: 'NO', rationale: 'Test: Council dissents NO' },
    { name: 'Sentinel', vote: 'NO', rationale: 'Test: Council dissents NO' },
    { name: 'Cipher', vote: 'YES', rationale: 'Test: Council agrees YES' },
    { name: 'Oracle', vote: 'NO', rationale: 'Test: Council dissents NO' },
  ]},
];

const results = [];

async function runCycle(cycleNum, councilPattern) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CYCLE ${cycleNum} — ${councilPattern.label}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Create Proposal
  console.log("Submitting proposal...");
  const { request } = await publicClient.simulateContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'submitProposal',
    args: [`ReducedSwarm Test ${cycleNum} @ ${Date.now()}`, parseEther("0.001"), deployer.account.address, 90n, 90n, 1000n],
    account,
  });
  const txHash = await deployer.writeContract(request);
  const proposalReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (proposalReceipt.status === 'reverted') throw new Error(`Proposal creation reverted`);

  const count = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'proposalCount'
  });
  const proposalId = count;
  console.log(`  Created Proposal #${proposalId}`);

  // 2. Deposit to escrow
  console.log("Depositing to escrow...");
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

  // 3. Trigger swarm
  await triggerDemoSwarm(proposalId.toString(), councilPattern.decisions);

  // 4. Read final on-chain state
  const proposal = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'getProposal',
    args: [BigInt(proposalId)],
  });

  const result = {
    cycle: cycleNum,
    proposalId: Number(proposalId),
    councilLabel: councilPattern.label,
    status: Number(proposal.status),
    statusLabel: Number(proposal.status) === 1 ? 'APPROVED' : Number(proposal.status) === 2 ? 'REJECTED' : 'PENDING',
    yesWeight: Number(proposal.yesWeight),
    noWeight: Number(proposal.noWeight),
    yesCount: Number(proposal.yesCount),
    noCount: Number(proposal.noCount),
    tallied: proposal.tallied,
    quorum: Number(proposal.quorumThreshold),
  };
  results.push(result);

  console.log(`\n  📊 RESULT: ${result.statusLabel}`);
  console.log(`     YES: weight=${result.yesWeight} count=${result.yesCount}`);
  console.log(`     NO:  weight=${result.noWeight} count=${result.noCount}`);
  console.log(`     Total weight: ${result.yesWeight + result.noWeight} (quorum: ${result.quorum})`);
  console.log(`     Tallied: ${result.tallied}`);

  return result;
}

async function main() {
  const TOTAL_CYCLES = 5;
  
  // Alternate patterns: cycles 1,3,5 use Council-YES; cycles 2,4 use Council-NO
  for (let i = 1; i <= TOTAL_CYCLES; i++) {
    const pattern = COUNCIL_PATTERNS[(i - 1) % 2]; // alternate
    await runCycle(i, pattern);
  }

  // Final Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SUMMARY — ${TOTAL_CYCLES} CYCLES`);
  console.log(`${'='.repeat(60)}`);

  const quorumReached = results.filter(r => r.tallied && (r.yesWeight + r.noWeight) >= r.quorum);
  const quorumMissed = results.filter(r => !r.tallied || (r.yesWeight + r.noWeight) < r.quorum);
  const approved = results.filter(r => r.statusLabel === 'APPROVED');
  const rejected = results.filter(r => r.statusLabel === 'REJECTED');

  console.log(`\n  Quorum reached: ${quorumReached.length}/${results.length}`);
  console.log(`  Quorum missed:  ${quorumMissed.length}/${results.length}`);
  console.log(`  Approved:       ${approved.length}/${results.length}`);
  console.log(`  Rejected:       ${rejected.length}/${results.length}`);

  console.log(`\n  Per-cycle breakdown:`);
  for (const r of results) {
    const swing = r.yesWeight !== r.noWeight ? 
      `(delta=${Math.abs(r.yesWeight - r.noWeight)})` : '(TIED)';
    console.log(`    Cycle ${r.cycle} [${r.councilLabel}]: ${r.statusLabel} — YES=${r.yesWeight} NO=${r.noWeight} ${swing} total=${r.yesWeight+r.noWeight} quorum=${r.quorum}`);
  }

  // Key question: Did council-NO cycles actually produce different outcomes?
  const councilYesCycles = results.filter(r => r.councilLabel === 'Council majority YES');
  const councilNoCycles = results.filter(r => r.councilLabel === 'Council majority NO');
  
  console.log(`\n  Council influence analysis:`);
  console.log(`    Council-YES cycles: ${councilYesCycles.map(r => r.statusLabel).join(', ')}`);
  console.log(`    Council-NO  cycles: ${councilNoCycles.map(r => r.statusLabel).join(', ')}`);

  const councilSwung = councilNoCycles.some(r => r.statusLabel === 'REJECTED');
  console.log(`\n  🔑 Council disagreement swung outcome? ${councilSwung ? 'YES ✅' : 'NOT IN THIS RUN ⚠️'}`);
  console.log(`  🔑 Quorum reliable? ${quorumMissed.length === 0 ? 'YES ✅' : 'NO ❌ — ' + quorumMissed.length + ' missed'}`);
}

main().catch(err => {
  console.error("\n❌ FATAL ERROR:", err.message || err);
  process.exit(1);
});
