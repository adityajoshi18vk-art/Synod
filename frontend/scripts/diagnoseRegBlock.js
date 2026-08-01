import { publicClient, ADDRESSES, BURNER_KEYS } from '../src/lib/config.js';
import { REGISTRY_ABI } from '../src/lib/abis.js';
import { privateKeyToAccount } from 'viem/accounts';

async function main() {
  const addr = privateKeyToAccount(BURNER_KEYS[0]).address;
  
  // Check registration at different blocks
  const blocks = [50011770n, 50011770n - 100n, 50011770n + 100n];
  
  for (const blockNum of blocks) {
    try {
      const isReg = await publicClient.readContract({
        address: ADDRESSES.registry,
        abi: REGISTRY_ABI,
        functionName: 'isRegistered',
        args: [addr],
        blockNumber: blockNum,
      });
      console.log(`  Burner 0 at block ${blockNum}: registered=${isReg}`);
    } catch (e) {
      console.log(`  Burner 0 at block ${blockNum}: ERROR - ${e.shortMessage || e.message}`);
    }
  }
  
  // Find when Burner 0 was registered by checking the latest block
  const latestIsReg = await publicClient.readContract({
    address: ADDRESSES.registry,
    abi: REGISTRY_ABI,
    functionName: 'isRegistered',
    args: [addr],
  });
  console.log(`\n  Burner 0 at LATEST: registered=${latestIsReg}`);
  
  // Check total agent count at block 50011770 vs now
  try {
    const countThen = await publicClient.readContract({
      address: ADDRESSES.registry,
      abi: REGISTRY_ABI,
      functionName: 'getAgentCount',
      blockNumber: 50011770n,
    });
    console.log(`  Agent count at block 50011770: ${countThen}`);
  } catch(e) {
    console.log(`  Agent count at block 50011770: ERROR - ${e.shortMessage || e.message}`);
  }
  
  const countNow = await publicClient.readContract({
    address: ADDRESSES.registry,
    abi: REGISTRY_ABI,
    functionName: 'getAgentCount',
  });
  console.log(`  Agent count at LATEST: ${countNow}`);
}

main().catch(console.error);
