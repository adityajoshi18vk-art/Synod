import { publicClient, ADDRESSES, BURNER_KEYS } from '../src/lib/config.js';
import { VOTING_ABI, REGISTRY_ABI } from '../src/lib/abis.js';
import { privateKeyToAccount } from 'viem/accounts';

async function main() {
  // What registry does SynodVoting point to?
  const votingRegistryAddr = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'registry',
  });
  
  console.log('SynodVoting.registry():', votingRegistryAddr);
  console.log('ADDRESSES.registry (from .env):', ADDRESSES.registry);
  console.log('Match:', votingRegistryAddr.toLowerCase() === ADDRESSES.registry.toLowerCase());
  
  // Check if Burner 0 is registered in the registry that SynodVoting uses
  const addr = privateKeyToAccount(BURNER_KEYS[0]).address;
  const isRegInVotingRegistry = await publicClient.readContract({
    address: votingRegistryAddr,
    abi: REGISTRY_ABI,
    functionName: 'isRegistered',
    args: [addr],
  });
  console.log(`\nBurner 0 registered in SynodVoting's registry? ${isRegInVotingRegistry}`);
  
  const isRegInEnvRegistry = await publicClient.readContract({
    address: ADDRESSES.registry,
    abi: REGISTRY_ABI,
    functionName: 'isRegistered',
    args: [addr],
  });
  console.log(`Burner 0 registered in .env registry? ${isRegInEnvRegistry}`);
}

main().catch(console.error);
