import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  const keys = [
    // Burners
    '0xcfb1f31f1f326402f265dcfa1042e29dbbe2e4d76c836905df87ae89dc4aad11',
    '0xe48ca96119d8fa1b07aa43b262faec113284b424075b480bc44f8dd2a2397960',
    '0x4a9c06d7507f658540dad1949cfeccc2f9e0dd810526abfc193661312661e0b2',
    '0x2f671a2f71d9ee8d8ccb4f941cb669396843368c02bf3483e0e669d1683487c3',
    '0x6bbe5f439aa12550bafd27282555e6ddd13c2fe29d5a52463a6a2bf3bbef16d6',
    // Council
    '0xebc6241fe6aaa4fec07ea8a24a41941238f1edbae61fdd90732e1ac387a2871a',
    '0xb01bc5d048972b6070a3a6063367ebf7511ef734a080f61cc29f30260e24a96c',
    '0xa18143fcebc7a67e9b4ed46fb48bf35a3cc9910974a9f544bba9f6fc79623f2e',
    '0xc8604050c0e43c09ee1352f326dd8636bd3ebb4acce90bfd4135b66ec39fede8',
    '0xb91b9070aa576dd69773d866dbc73c8aa2a97a8c87b1b361ad17b904e054b04e'
  ];

  console.log(`Funding ${keys.length} agents with 2 MON each...`);

  for (let pk of keys) {
    const w = new hre.ethers.Wallet(pk);
    console.log(`Funding ${w.address}`);
    const tx = await deployer.sendTransaction({
      to: w.address,
      value: hre.ethers.parseEther("2.0") // 2 MON each
    });
    await tx.wait();
  }
  console.log("Done! All agents funded with 2 MON.");
}

main().catch(console.error);
