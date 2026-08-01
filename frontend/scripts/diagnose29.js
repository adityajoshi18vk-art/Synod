import { publicClient, ADDRESSES } from '../src/lib/config.js';
import { VOTING_ABI } from '../src/lib/abis.js';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import 'dotenv/config';

// Replace with actual hashes from task-281
const P29_COMMITS = [
  '0xb095db60000a6358c8ecb74d4719b36ed7d1175628b088365287515d978a6ff6', // Burner 0
  '0xefad2f91f24d31405e3f436be896796eb0eb29de0bfdff31201ce8d7ffce414d', // Council Oracle
];

const P29_REVEALS = [
  '0xbb4fb50529d2f2d93eef250785f7e7161b9a9fcd0fbece4750c18d189f7f0237', // Burner 0
  '0x4d2cf0a88b1ac798150665ebfeb4a2f48ef26d6a59e4be5be55d1e099af67cd5', // Council Oracle
];

async function main() {
  const account = privateKeyToAccount('0x00658ab558bf712a46326e5818608d29b431f789f262f0d117e82c93ced05a2f');
  const client = createWalletClient({ account, chain: monadTestnet, transport: http(process.env.VITE_RPC_URL_PRIMARY) });

  console.log("=== TRYING TO TALLY PROPOSAL 29 ===");
  try {
    const { request } = await publicClient.simulateContract({
      address: ADDRESSES.voting,
      abi: VOTING_ABI,
      functionName: 'tallyVotes',
      args: [29n],
      account,
    });
    const hash = await client.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Tally TX: ${hash}, status=${receipt.status}`);
  } catch (e) {
    console.log(`Tally failed: ${e.shortMessage || e.message}`);
  }

  console.log("\n=== GAS CHECK ===");
  // Check one commit and one reveal
  for (const h of [P29_COMMITS[0], P29_REVEALS[0]]) {
    const tx = await publicClient.getTransaction({ hash: h });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: h });
    console.log(`TX ${h}:`);
    console.log(`  status: ${receipt.status}`);
    console.log(`  gas limit: ${tx.gas}`);
    console.log(`  gas used: ${receipt.gasUsed}`);
    try {
      const est = await publicClient.estimateGas({
        data: tx.input, to: tx.to, from: tx.from,
        blockNumber: receipt.blockNumber - 1n
      });
      console.log(`  gas estimated (historical): ${est}`);
    } catch(e) {
      console.log(`  gas estimated (historical): failed - ${e.shortMessage}`);
    }
  }

  const p = await publicClient.readContract({
    address: ADDRESSES.voting, abi: VOTING_ABI, functionName: 'getProposal', args: [29n]
  });
  console.log(`\nFinal Weights: YES=${p.yesWeight}, NO=${p.noWeight}`);
}
main().catch(console.error);
