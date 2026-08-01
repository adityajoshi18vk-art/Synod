import { publicClient, ADDRESSES } from '../src/lib/config.js';
import { VOTING_ABI } from '../src/lib/abis.js';
import 'dotenv/config';

async function main() {
  const proposal = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'getProposal',
    args: [32n]
  });
  console.log("Proposal 32 tallied:", proposal.tallied);
  console.log("Proposal 32 weights:", "YES:", proposal.yesWeight, "NO:", proposal.noWeight);
}
main().catch(console.error);
