import { publicClient } from '../src/lib/config.js';

const P31_HASHES = [
  '0xa59c247b240f253d88fa1778af5e6da7dd33ffeff6e98824aae292be643658f6', // Commit Burner 0
  '0x4bddf3f0f547775aefa9248e15cad2b69be09dde4e8022fc7f555c066fd8066b', // Reveal Burner 0
];

async function main() {
  console.log("=== GAS CHECK ===");
  for (const h of P31_HASHES) {
    const tx = await publicClient.getTransaction({ hash: h });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: h });
    console.log(`TX ${h}:`);
    console.log(`  status: ${receipt.status}`);
    console.log(`  gas limit (estimated by viem): ${tx.gas}`);
    console.log(`  gas used (actual): ${receipt.gasUsed}`);
  }
}
main().catch(console.error);
