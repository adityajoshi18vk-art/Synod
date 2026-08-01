import { publicClient, ADDRESSES } from '../src/lib/config.js';
import { VOTING_ABI } from '../src/lib/abis.js';
const c = await publicClient.readContract({ address: ADDRESSES.voting, abi: VOTING_ABI, functionName: 'proposalCount' });
console.log('proposalCount:', c.toString());
