import { triggerDemoSwarm } from '../src/lib/simulator.js';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import { ADDRESSES, publicClient } from '../src/lib/config.js';
import { VOTING_ABI, ESCROW_ABI } from '../src/lib/abis.js';

// Setup a deployer client using Hardhat account 1 just for proposing
// Ensure this account has MON!
const deployerPk = '00658ab558bf712a46326e5818608d29b431f789f262f0d117e82c93ced05a2f'; 
const account = privateKeyToAccount(`0x${deployerPk}`);
const deployer = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(import.meta.env.VITE_RPC_URL),
});

async function runSwarmCycle(cycleNum) {
  console.log(`\n===========================================`);
  console.log(`  SWARM CYCLE ${cycleNum}`);
  console.log(`===========================================\n`);

  // 1. Create Proposal
  console.log("Submitting proposal...");
  const { request } = await publicClient.simulateContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'submitProposal',
    args: ["Test Load " + cycleNum, parseEther("0.001"), deployer.account.address, 30n, 30n, 1000n],
    account,
  });
  const txHash = await deployer.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Get Proposal ID
  const count = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'proposalCount'
  });
  const proposalId = count;
  console.log(`Created Proposal #${proposalId}`);

  // Deposit to escrow
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
  await publicClient.waitForTransactionReceipt({ hash: escrowTx });

  // 2. Trigger Swarm
  const mockDecisions = [
    { name: 'Arjun', vote: 'YES', rationale: 'Test YES' },
    { name: 'Nova', vote: 'YES', rationale: 'Test YES' },
    { name: 'Sentinel', vote: 'NO', rationale: 'Test NO' },
    { name: 'Cipher', vote: 'YES', rationale: 'Test YES' },
    { name: 'Oracle', vote: 'NO', rationale: 'Test NO' }
  ];
  await triggerDemoSwarm(proposalId.toString(), mockDecisions);

  console.log(`Cycle ${cycleNum} Complete!`);
}

async function main() {
  for(let i=1; i<=1; i++) {
    await runSwarmCycle(i);
  }
}

main().catch(console.error);
