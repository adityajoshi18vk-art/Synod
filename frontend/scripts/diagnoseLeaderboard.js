import { createPublicClient, http } from 'viem';
import { monadTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const REGISTRY_ADDRESS = '0xcfd66702906F90c933d49a78C9b34a03075389Dc';

const REGISTRY_ABI = [
  { inputs: [{ type: 'uint256' }], name: 'agentList', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getAgentCount', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'address' }], name: 'agents', outputs: [{ type: 'bool', name: 'isRegistered' }, { type: 'string', name: 'label' }, { type: 'uint256', name: 'reputationScore' }, { type: 'uint256', name: 'totalVotes' }, { type: 'uint256', name: 'correctVotes' }], stateMutability: 'view', type: 'function' },
];

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http('https://testnet-rpc.monad.xyz', { timeout: 30_000 }),
});

// Keys from .env
const BURNER_KEYS = [
  '0xcfb1f31f1f326402f265dcfa1042e29dbbe2e4d76c836905df87ae89dc4aad11',
  '0xe48ca96119d8fa1b07aa43b262faec113284b424075b480bc44f8dd2a2397960',
  '0x4a9c06d7507f658540dad1949cfeccc2f9e0dd810526abfc193661312661e0b2',
  '0x2f671a2f71d9ee8d8ccb4f941cb669396843368c02bf3483e0e669d1683487c3',
  '0x6bbe5f439aa12550bafd27282555e6ddd13c2fe29d5a52463a6a2bf3bbef16d6',
];

const COUNCIL_KEYS = [
  '0xebc6241fe6aaa4fec07ea8a24a41941238f1edbae61fdd90732e1ac387a2871a',
  '0xb01bc5d048972b6070a3a6063367ebf7511ef734a080f61cc29f30260e24a96c',
  '0xa18143fcebc7a67e9b4ed46fb48bf35a3cc9910974a9f544bba9f6fc79623f2e',
  '0xc8604050c0e43c09ee1352f326dd8636bd3ebb4acce90bfd4135b66ec39fede8',
  '0xb91b9070aa576dd69773d866dbc73c8aa2a97a8c87b1b361ad17b904e054b04e',
];

console.log('=== Addresses derived from .env keys ===');
console.log('\nBurner addresses:');
const burnerAddrs = BURNER_KEYS.map((k, i) => {
  const addr = privateKeyToAccount(k).address;
  console.log(`  Burner ${i+1}: ${addr}`);
  return addr.toLowerCase();
});

console.log('\nCouncil addresses:');
const councilAddrs = COUNCIL_KEYS.map((k, i) => {
  const addr = privateKeyToAccount(k).address;
  console.log(`  Council ${i+1}: ${addr}`);
  return addr.toLowerCase();
});

const allEnvAddrs = new Set([...burnerAddrs, ...councilAddrs]);

console.log('\n=== Querying on-chain registry ===');
try {
  const count = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getAgentCount',
  });
  console.log(`Agent count on-chain: ${count}`);

  for (let i = 0; i < Number(count); i++) {
    const addr = await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'agentList',
      args: [BigInt(i)],
    });
    
    const agentData = await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'agents',
      args: [addr],
    });
    
    const [isRegistered, label, reputationScore, totalVotes, correctVotes] = agentData;
    const inEnv = allEnvAddrs.has(addr.toLowerCase());
    
    console.log(`\n  Agent #${i}: ${addr}`);
    console.log(`    Label: ${label || '(empty)'}`);
    console.log(`    Registered: ${isRegistered}`);
    console.log(`    Reputation: ${reputationScore}`);
    console.log(`    TotalVotes: ${totalVotes}, CorrectVotes: ${correctVotes}`);
    console.log(`    In .env keys? ${inEnv ? '✅ YES' : '❌ NO'}`);
  }
} catch (err) {
  console.error('Error querying on-chain:', err.message);
}
