import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import { publicClient, COUNCIL_KEYS } from '../src/lib/config.js';

// Setup deployer client
const deployerPk = '00658ab558bf712a46326e5818608d29b431f789f262f0d117e82c93ced05a2f'; 
const account = privateKeyToAccount(`0x${deployerPk}`);
const deployer = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(import.meta.env.VITE_RPC_URL),
});

import { BURNER_KEYS } from '../src/lib/config.js';

async function fundCouncil() {
  console.log(`Funding Agents from deployer ${account.address}...`);
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer balance: ${formatEther(balance)} MON`);
  
  const allKeys = [...COUNCIL_KEYS, ...BURNER_KEYS];

  for (let i = 0; i < allKeys.length; i++) {
    const councilAccount = privateKeyToAccount(allKeys[i]);
    const councilBalance = await publicClient.getBalance({ address: councilAccount.address });
    
    if (councilBalance < parseEther("0.5")) {
      console.log(`Agent ${i} (${councilAccount.address}) has ${formatEther(councilBalance)} MON. Funding 0.5 MON...`);
      const hash = await deployer.sendTransaction({
        to: councilAccount.address,
        value: parseEther("0.5")
      });
      console.log(`  Tx Sent: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  Done.`);
    } else {
      console.log(`Agent ${i} (${councilAccount.address}) already has ${formatEther(councilBalance)} MON.`);
    }
  }
}

fundCouncil().catch(console.error);
