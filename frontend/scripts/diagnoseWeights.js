import { publicClient, ADDRESSES, BURNER_KEYS, COUNCIL_KEYS } from '../src/lib/config.js';
import { VOTING_ABI } from '../src/lib/abis.js';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

async function main() {
  const proposalId = 31n;
  console.log(`=== WEIGHTS FOR PROPOSAL 31 ===`);
  
  let totalSum = 0n;

  console.log(`\n-- BURNERS --`);
  for (let i=0; i<BURNER_KEYS.length; i++) {
    const addr = privateKeyToAccount(BURNER_KEYS[i]).address;
    const vote = await publicClient.readContract({
      address: ADDRESSES.voting,
      abi: VOTING_ABI,
      functionName: 'getVote',
      args: [proposalId, addr]
    });
    console.log(`Burner ${i} (${addr}):`, vote);
    if (vote[2] || vote.revealed) totalSum += vote.weight || vote[1] || 0n;
  }

  console.log(`\n-- COUNCIL --`);
  for (let i=0; i<COUNCIL_KEYS.length; i++) {
    const addr = privateKeyToAccount(COUNCIL_KEYS[i]).address;
    const vote = await publicClient.readContract({
      address: ADDRESSES.voting,
      abi: VOTING_ABI,
      functionName: 'getVote',
      args: [proposalId, addr]
    });
    console.log(`Council ${i} (${addr}):`, vote);
    if (vote[2] || vote.revealed) totalSum += vote.weight || vote[1] || 0n;
  }

  console.log(`\nTotal sum of revealed weights: ${totalSum}`);
  
  const proposal = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'getProposal',
    args: [proposalId]
  });
  console.log(`Proposal state: yesWeight=${proposal.yesWeight}, noWeight=${proposal.noWeight}`);
  console.log(`Proposal total weight (yes + no): ${proposal.yesWeight + proposal.noWeight}`);
}

main().catch(console.error);
