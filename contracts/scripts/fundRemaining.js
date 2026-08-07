import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  const keys = [
    // Cipher
    '0xc8604050c0e43c09ee1352f326dd8636bd3ebb4acce90bfd4135b66ec39fede8',
    // Oracle
    '0xb91b9070aa576dd69773d866dbc73c8aa2a97a8c87b1b361ad17b904e054b04e'
  ];

  console.log(`Funding ${keys.length} remaining agents...`);

  for (let pk of keys) {
    const w = new hre.ethers.Wallet(pk);
    console.log(`Funding ${w.address}`);
    const tx = await deployer.sendTransaction({
      to: w.address,
      value: hre.ethers.parseEther("2.0") // 2.0 MON each
    });
    await tx.wait();
  }
  console.log("Done! Remaining agents funded.");
}

main().catch(console.error);
