import { publicClient, BURNER_KEYS } from '../src/lib/config.js';
import { privateKeyToAccount } from 'viem/accounts';

const TX_HASH = '0xb72433701b68d8cc31a85e4f4c967a42f8398f5d66a7b1a675033ed83e7ba1ce';

async function main() {
  const tx = await publicClient.getTransaction({ hash: TX_HASH });
  console.log('TX from:', tx.from);
  console.log('Expected Burner 0:', privateKeyToAccount(BURNER_KEYS[0]).address);
  console.log('Match:', tx.from.toLowerCase() === privateKeyToAccount(BURNER_KEYS[0]).address.toLowerCase());
}

main().catch(console.error);
