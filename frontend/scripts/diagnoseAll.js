import { publicClient, ADDRESSES } from '../src/lib/config.js';
import { VOTING_ABI } from '../src/lib/abis.js';

// Proposal #28 commit txs
const COMMIT_TXS = [
  { label: 'Burner 0 commit',          hash: '0xb72433701b68d8cc31a85e4f4c967a42f8398f5d66a7b1a675033ed83e7ba1ce' },
  { label: 'Burner 1 commit',          hash: '0x795c0a60bd5fb5cd00870349d25ec28ad4adc8cc34396d632103aee031b0ceb9' },
  { label: 'Burner 2 commit',          hash: '0xca393dbab4a21b2f4ecae54d89cf57fb09c8c691b57bb41b0d0a30e93d14758d' },
  { label: 'Burner 3 commit',          hash: '0x073955447a2b28ffa11837c7c062e015b6030b326a1931dd0bfc4594c860faae' },
  { label: 'Burner 4 commit',          hash: '0x59a38d843a6d3eaca0de2bd7266dbce46c0d0fd4a06b9cfe5b65d4bd329d1c3a' },
  { label: 'Council Arjun commit',     hash: '0xfa183c27897b2bd7d48434abd87f31da2a0213c5c5e7784ab7c4f2832631b1a9' },
  { label: 'Council Nova commit',      hash: '0x898491ba5866ca4736edc2e3e3b9f27ed3ec25a71551ecf3f6e329194bc7206a' },
  { label: 'Council Sentinel commit',  hash: '0x088ef7f809cb7ab00e7e8fee368edcc8dc2889ec2193bb95c987e88363a5018d' },
  { label: 'Council Cipher commit',    hash: '0x1eb5196163cd00ddbcdda823342500288661968c84ec9222f34bfff803180dcf' },
  { label: 'Council Oracle commit',    hash: '0x4c175e10757bb6869760841aa0119342b4e17a0d7ef007bfd2a803960e06dfa8' },
];

const REVEAL_TXS = [
  { label: 'Burner 0 reveal',          hash: '0xa35650ab281afc2fb56880bc5e00f4e2b8dc090873e06126fdcf099392de249d' },
  { label: 'Burner 1 reveal',          hash: '0xd1e970c4f32f8e86a3865c14f8a0ead5d2b6dbcbeb6547df9bd275a16e4e2f78' },
  { label: 'Burner 2 reveal',          hash: '0x5e3532bf472b9271f097461903279ea85a3f7d40c589d0d65889bc8399fa3f0c' },
  { label: 'Burner 3 reveal',          hash: '0x2b2d2d8280cc29b570e719a2f3a561e1269a901e3079f65256b5f24064c8744d' },
  { label: 'Burner 4 reveal',          hash: '0xf5d0935cc1cda338e57f94fd5724eac51241b079ee113bbc7dd51c482588a06e' },
  { label: 'Council Arjun reveal',     hash: '0x357dba154364785ccfa2ce1e543593a4ef55fb1b71db8483e562a52def5ffcee' },
  { label: 'Council Nova reveal',      hash: '0x64825ed915a7068e8e18bbbd9cd79cf652509e0af3939c4101c0f90db60df917' },
  { label: 'Council Sentinel reveal',  hash: '0xe0ff701575aa396bc4ea2293e876a4e82dfca016a13d7cf9479cbbc397a341bd' },
  { label: 'Council Cipher reveal',    hash: '0xe098473d8e920a2f923d5a0c7a6016053bf3bac6a783d6eecba7618d3295ea47' },
  { label: 'Council Oracle reveal',    hash: '0x3fa358272a3868405251943f3bb721f84fe293f3b5fde231b1d78500cd0749fa' },
];

const TALLY_TX = { label: 'tally', hash: '0x2c6b12268ac0f0c267645457b0a7318a9c3c413a7af978e17b789dcc44899981' };

async function main() {
  // Get proposal state
  const proposal = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'getProposal',
    args: [28n],
  });
  console.log('=== PROPOSAL #28 ===');
  console.log(`  commitDeadline: ${proposal.commitDeadline} (${new Date(Number(proposal.commitDeadline)*1000).toISOString()})`);
  console.log(`  revealDeadline: ${proposal.revealDeadline} (${new Date(Number(proposal.revealDeadline)*1000).toISOString()})`);

  console.log('\n=== ALL 21 TRANSACTIONS (10 commits + 10 reveals + 1 tally) ===\n');
  const allTxs = [...COMMIT_TXS, ...REVEAL_TXS, TALLY_TX];
  
  for (const tx of allTxs) {
    const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const ts = Number(block.timestamp);
    const commitDL = Number(proposal.commitDeadline);
    const revealDL = Number(proposal.revealDeadline);
    
    let window;
    if (ts <= commitDL) window = 'COMMIT_WINDOW';
    else if (ts <= revealDL) window = 'REVEAL_WINDOW';
    else window = 'AFTER_REVEAL';
    
    console.log(
      `  ${tx.label.padEnd(30)} block=${String(receipt.blockNumber).padEnd(10)} ` +
      `ts=${ts} status=${receipt.status.padEnd(10)} window=${window} ` +
      `logs=${receipt.logs.length}`
    );
  }

  // Check: did proposal #27 (previous) overlap with #28?
  console.log('\n=== PROPOSAL #27 TIMING (previous) ===');
  try {
    const p27 = await publicClient.readContract({
      address: ADDRESSES.voting,
      abi: VOTING_ABI,
      functionName: 'getProposal',
      args: [27n],
    });
    console.log(`  commitDeadline: ${p27.commitDeadline} (${new Date(Number(p27.commitDeadline)*1000).toISOString()})`);
    console.log(`  revealDeadline: ${p27.revealDeadline} (${new Date(Number(p27.revealDeadline)*1000).toISOString()})`);
    console.log(`  status: ${p27.status}, tallied: ${p27.tallied}`);
  } catch (e) {
    console.log(`  Could not fetch: ${e.message}`);
  }
}

main().catch(console.error);
