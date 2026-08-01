import { publicClient } from '../src/lib/config.js';

const REVEAL_TXS = [
  { label: 'Burner 0 (YES)',            hash: '0xa35650ab281afc2fb56880bc5e00f4e2b8dc090873e06126fdcf099392de249d' },
  { label: 'Burner 1 (YES)',            hash: '0xd1e970c4f32f8e86a3865c14f8a0ead5d2b6dbcbeb6547df9bd275a16e4e2f78' },
  { label: 'Burner 2 (YES)',            hash: '0x5e3532bf472b9271f097461903279ea85a3f7d40c589d0d65889bc8399fa3f0c' },
  { label: 'Burner 3 (YES)',            hash: '0x2b2d2d8280cc29b570e719a2f3a561e1269a901e3079f65256b5f24064c8744d' },
  { label: 'Burner 4 (NO)',             hash: '0xf5d0935cc1cda338e57f94fd5724eac51241b079ee113bbc7dd51c482588a06e' },
  { label: 'Council Arjun (NO)',        hash: '0x357dba154364785ccfa2ce1e543593a4ef55fb1b71db8483e562a52def5ffcee' },
  { label: 'Council Nova (YES)',        hash: '0x64825ed915a7068e8e18bbbd9cd79cf652509e0af3939c4101c0f90db60df917' },
  { label: 'Council Sentinel (NO)',     hash: '0xe0ff701575aa396bc4ea2293e876a4e82dfca016a13d7cf9479cbbc397a341bd' },
  { label: 'Council Cipher (YES)',      hash: '0xe098473d8e920a2f923d5a0c7a6016053bf3bac6a783d6eecba7618d3295ea47' },
  { label: 'Council Oracle (YES)',      hash: '0x3fa358272a3868405251943f3bb721f84fe293f3b5fde231b1d78500cd0749fa' },
];

const TALLY_TX = {
  label: 'tallyVotes',
  hash: '0x2c6b12268ac0f0c267645457b0a7318a9c3c413a7af978e17b789dcc44899981',
};

async function main() {
  const allTxs = [...REVEAL_TXS, TALLY_TX];

  const results = [];

  for (const tx of allTxs) {
    const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    results.push({
      label: tx.label,
      hash: tx.hash,
      status: receipt.status,
      blockNumber: Number(receipt.blockNumber),
      timestamp: Number(block.timestamp),
      timestampISO: new Date(Number(block.timestamp) * 1000).toISOString(),
    });
  }

  // Sort by blockNumber for easy comparison
  results.sort((a, b) => a.blockNumber - b.blockNumber);

  const tallyBlock = results.find(r => r.label === 'tallyVotes').blockNumber;

  console.log('\n=== BLOCK NUMBERS FOR ALL 11 TRANSACTIONS (sorted) ===\n');
  for (const r of results) {
    const relation = r.label === 'tallyVotes'
      ? '  <-- TALLY'
      : r.blockNumber > tallyBlock
        ? '  ⚠️ MINED AFTER TALLY'
        : r.blockNumber === tallyBlock
          ? '  ⚠️ SAME BLOCK AS TALLY'
          : '  ✅ before tally';
    console.log(
      `  ${r.label.padEnd(30)} block=${r.blockNumber}  status=${r.status}  time=${r.timestampISO}${relation}`
    );
  }

  const revealsAfterTally = results.filter(
    r => r.label !== 'tallyVotes' && r.blockNumber >= tallyBlock
  );

  console.log(`\n=== SUMMARY ===`);
  console.log(`Tally block: ${tallyBlock}`);
  console.log(`Reveals mined AT or AFTER tally block: ${revealsAfterTally.length}`);
  if (revealsAfterTally.length > 0) {
    console.log('RACE CONDITION CONFIRMED: these reveals were not counted:');
    for (const r of revealsAfterTally) {
      console.log(`  - ${r.label} (block ${r.blockNumber})`);
    }
  } else {
    console.log('No race condition detected — all reveals mined before tally.');
  }
}

main().catch(console.error);
