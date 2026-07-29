import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const keys = [
    '0x3983ba8563dfbf01820a33e187cd37da895f9b21159b754d3ff928d809e14234',
    '0x4518de9dc908da43df142e6f30481ad0aad15e4e52bdda5adccbce01f078bc07',
    '0x3876b63538c81ade9aeba3cba1dbd93177909e32ce174b2f36f40b80015dce18',
    '0x7d0ad3d512224d03e6c7b7128001d6f495a7790d1ccebe9298f867a58cf8e7e4',
    '0x7eebcdd227eb2c318f5096bb367cdd86990ed87f019caeb6119da8b3e8ed648a'
  ];

  for (let pk of keys) {
    const w = new hre.ethers.Wallet(pk);
    console.log("Funding", w.address);
    const tx = await deployer.sendTransaction({
      to: w.address,
      value: hre.ethers.parseEther("2") // 2 MON each
    });
    await tx.wait();
    console.log("Funded!");
  }
}

main().catch(console.error);
