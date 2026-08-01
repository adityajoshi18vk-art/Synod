import { publicClient, ADDRESSES, BURNER_KEYS, COUNCIL_KEYS } from '../src/lib/config.js';
import { VOTING_ABI } from '../src/lib/abis.js';
import { REGISTRY_ABI } from '../src/lib/abis.js';
import { privateKeyToAccount } from 'viem/accounts';

async function main() {
  // Check registration status for all 10 agents
  console.log('=== AGENT REGISTRATION STATUS ===\n');
  
  const burnerAddresses = BURNER_KEYS.map(pk => privateKeyToAccount(pk).address);
  const councilAddresses = COUNCIL_KEYS.map(pk => privateKeyToAccount(pk).address);
  
  for (let i = 0; i < burnerAddresses.length; i++) {
    const addr = burnerAddresses[i];
    try {
      const isReg = await publicClient.readContract({
        address: ADDRESSES.registry,
        abi: REGISTRY_ABI,
        functionName: 'isRegistered',
        args: [addr],
      });
      console.log(`  Burner ${i} (${addr}): registered=${isReg}`);
    } catch (e) {
      console.log(`  Burner ${i} (${addr}): ERROR - ${e.message}`);
    }
  }
  
  for (let i = 0; i < councilAddresses.length; i++) {
    const addr = councilAddresses[i];
    try {
      const isReg = await publicClient.readContract({
        address: ADDRESSES.registry,
        abi: REGISTRY_ABI,
        functionName: 'isRegistered',
        args: [addr],
      });
      console.log(`  Council ${i} (${addr}): registered=${isReg}`);
    } catch (e) {
      console.log(`  Council ${i} (${addr}): ERROR - ${e.message}`);
    }
  }

  // Check all agents registered in the registry
  console.log('\n=== ALL REGISTERED AGENTS ===\n');
  const agentCount = await publicClient.readContract({
    address: ADDRESSES.registry,
    abi: REGISTRY_ABI,
    functionName: 'getAgentCount',
  });
  console.log(`  Total registered agents: ${agentCount}`);
  for (let i = 0; i < Number(agentCount); i++) {
    const addr = await publicClient.readContract({
      address: ADDRESSES.registry,
      abi: REGISTRY_ABI,
      functionName: 'agentList',
      args: [BigInt(i)],
    });
    const agent = await publicClient.readContract({
      address: ADDRESSES.registry,
      abi: REGISTRY_ABI,
      functionName: 'agents',
      args: [addr],
    });
    console.log(`  [${i}] ${addr} label="${agent[1]}" rep=${agent[2]} registered=${agent[0]}`);
  }
}

main().catch(console.error);
