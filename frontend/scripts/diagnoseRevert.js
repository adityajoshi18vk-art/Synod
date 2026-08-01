import { publicClient, ADDRESSES } from '../src/lib/config.js';
import { VOTING_ABI } from '../src/lib/abis.js';

// Proposal #28
const PROPOSAL_ID = 28n;

// Commit tx hashes for timing reference
const COMMIT_TXS = [
  { label: 'Burner 0 commit',   hash: '0xb72433701b68d8cc31a85e4f4c967a42f8398f5d66a7b1a675033ed83e7ba1ce' },
  { label: 'Council Oracle commit (last)', hash: '0x4c175e10757bb6869760841aa0119342b4e17a0d7ef007bfd2a803960e06dfa8' },
];

const REVEAL_TXS = [
  { label: 'Burner 0 reveal',     hash: '0xa35650ab281afc2fb56880bc5e00f4e2b8dc090873e06126fdcf099392de249d' },
];

async function main() {
  // 1. Get proposal on-chain state
  const proposal = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'getProposal',
    args: [PROPOSAL_ID],
  });

  console.log('=== PROPOSAL #28 ON-CHAIN STATE ===');
  console.log(`  commitDeadline:  ${proposal.commitDeadline} (${new Date(Number(proposal.commitDeadline) * 1000).toISOString()})`);
  console.log(`  revealDeadline:  ${proposal.revealDeadline} (${new Date(Number(proposal.revealDeadline) * 1000).toISOString()})`);
  console.log(`  status:          ${proposal.status} (0=Pending, 1=Approved, 2=Rejected)`);
  console.log(`  tallied:         ${proposal.tallied}`);
  console.log(`  yesWeight:       ${proposal.yesWeight}`);
  console.log(`  noWeight:        ${proposal.noWeight}`);
  console.log(`  yesCount:        ${proposal.yesCount}`);
  console.log(`  noCount:         ${proposal.noCount}`);

  // 2. Get block timestamps for key txs
  console.log('\n=== KEY TRANSACTION TIMESTAMPS ===');
  for (const tx of [...COMMIT_TXS, ...REVEAL_TXS]) {
    const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    console.log(`  ${tx.label.padEnd(35)} block=${receipt.blockNumber} timestamp=${block.timestamp} (${new Date(Number(block.timestamp) * 1000).toISOString()}) status=${receipt.status}`);
  }

  // 3. Check: was commitDeadline already past when reveals were sent?
  // The first reveal (Burner 0) was at block 50011860
  const firstRevealReceipt = await publicClient.getTransactionReceipt({ hash: '0xa35650ab281afc2fb56880bc5e00f4e2b8dc090873e06126fdcf099392de249d' });
  const firstRevealBlock = await publicClient.getBlock({ blockNumber: firstRevealReceipt.blockNumber });
  
  console.log(`\n=== TIMING ANALYSIS ===`);
  console.log(`  commitDeadline timestamp: ${proposal.commitDeadline}`);
  console.log(`  First reveal block timestamp: ${firstRevealBlock.timestamp}`);
  console.log(`  Was commitDeadline passed when first reveal was mined? ${Number(firstRevealBlock.timestamp) > Number(proposal.commitDeadline) ? 'YES ✅' : 'NO ❌ — reveals were sent DURING commit window'}`);
  console.log(`  revealDeadline timestamp: ${proposal.revealDeadline}`);
  console.log(`  Was revealDeadline passed when first reveal was mined? ${Number(firstRevealBlock.timestamp) > Number(proposal.revealDeadline) ? 'YES — too late' : 'NO — within reveal window'}`);
}

main().catch(console.error);
