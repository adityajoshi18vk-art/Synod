import { publicClient, ADDRESSES } from '../src/lib/config.js';

// Reverted commit tx from Burner 0
const TX_HASH = '0xb72433701b68d8cc31a85e4f4c967a42f8398f5d66a7b1a675033ed83e7ba1ce';

async function main() {
  const tx = await publicClient.getTransaction({ hash: TX_HASH });
  const receipt = await publicClient.getTransactionReceipt({ hash: TX_HASH });
  
  console.log('=== REVERTED TX ===');
  console.log(`  gasLimit: ${tx.gas}`);
  console.log(`  gasUsed:  ${receipt.gasUsed}`);
  console.log(`  status:   ${receipt.status}`);
  
  // Re-simulate with MUCH higher gas to get true revert reason
  console.log('\n=== SIMULATION WITH HIGH GAS (500k) ===');
  try {
    const result = await publicClient.call({
      data: tx.input,
      to: tx.to,
      from: tx.from,
      gas: 500000n,
      blockNumber: receipt.blockNumber,
    });
    console.log('  Simulation succeeded (unexpected). Result:', result);
  } catch (err) {
    console.log(`  Revert reason: ${err.cause?.reason || err.shortMessage || err.message}`);
  }
  
  // Also try simulating with no gas limit
  console.log('\n=== SIMULATION WITH NO GAS LIMIT ===');
  try {
    const result = await publicClient.call({
      data: tx.input,
      to: tx.to,
      from: tx.from,
      blockNumber: receipt.blockNumber,
    });
    console.log('  Simulation succeeded (unexpected). Result:', result);
  } catch (err) {
    console.log(`  Revert reason: ${err.cause?.reason || err.shortMessage || err.message}`);
  }

  // Check: did proposal #28 even exist at that block?
  console.log('\n=== PROPOSAL #28 AT COMMIT BLOCK ===');
  try {
    const { createPublicClient: _, ...rest } = await import('viem');
    // Decode the calldata to get proposal ID
    const { decodeFunctionData } = await import('viem');
    const { VOTING_ABI } = await import('../src/lib/abis.js');
    const decoded = decodeFunctionData({ abi: VOTING_ABI, data: tx.input });
    console.log(`  Function: ${decoded.functionName}`);
    console.log(`  Args: ${JSON.stringify(decoded.args, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
  } catch (e) {
    console.log(`  Could not decode: ${e.message}`);
  }

  // Estimate gas for the same call with high gas limit at the same block
  console.log('\n=== GAS ESTIMATION ===');
  try {
    const estimatedGas = await publicClient.estimateGas({
      data: tx.input,
      to: tx.to,
      from: tx.from,  // Use actual tx sender as `from` for the `account` param
      blockNumber: receipt.blockNumber - 1n, // one block before to avoid "already committed"
    });
    console.log(`  Estimated gas needed: ${estimatedGas}`);
    console.log(`  Gas limit used: ${tx.gas}`);
    console.log(`  Sufficient? ${estimatedGas <= tx.gas ? 'YES' : 'NO — INSUFFICIENT GAS'}`);
  } catch (e) {
    console.log(`  Gas estimation failed: ${e.shortMessage || e.message}`);
  }
}

main().catch(console.error);
