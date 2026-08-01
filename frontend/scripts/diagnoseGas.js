import { publicClient } from '../src/lib/config.js';
import { decodeErrorResult } from 'viem';
import { VOTING_ABI } from '../src/lib/abis.js';

// Pick a commit tx that reverted
const TX_HASH = '0xb72433701b68d8cc31a85e4f4c967a42f8398f5d66a7b1a675033ed83e7ba1ce';

async function main() {
  // Get the full tx
  const tx = await publicClient.getTransaction({ hash: TX_HASH });
  const receipt = await publicClient.getTransactionReceipt({ hash: TX_HASH });
  
  console.log('=== REVERTED COMMIT TX DETAILS ===');
  console.log(`  hash: ${tx.hash}`);
  console.log(`  from: ${tx.from}`);
  console.log(`  to: ${tx.to}`);
  console.log(`  gas limit: ${tx.gas}`);
  console.log(`  gas used: ${receipt.gasUsed}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  gasUsed/gasLimit: ${Number(receipt.gasUsed) / Number(tx.gas) * 100}%`);
  
  if (Number(receipt.gasUsed) >= Number(tx.gas) * 0.99) {
    console.log('  ⚠️ GAS EXHAUSTION LIKELY — gasUsed ≈ gasLimit');
  }
  
  // Try to simulate the tx at the block it was mined to get the revert reason
  console.log('\n=== ATTEMPTING CALL SIMULATION FOR REVERT REASON ===');
  try {
    await publicClient.call({
      data: tx.input,
      to: tx.to,
      from: tx.from,
      gas: tx.gas,
      blockNumber: receipt.blockNumber,
    });
    console.log('  Simulation did NOT revert (unexpected)');
  } catch (err) {
    console.log(`  Revert reason: ${err.cause?.reason || err.shortMessage || err.message}`);
    // Try to decode
    if (err.cause?.data) {
      try {
        const decoded = decodeErrorResult({ abi: VOTING_ABI, data: err.cause.data });
        console.log(`  Decoded error: ${decoded}`);
      } catch { /* no custom error */ }
    }
  }
}

main().catch(console.error);
