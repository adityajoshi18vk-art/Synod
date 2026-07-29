import hre from "hardhat";

async function main() {
  const burners = [
    new hre.ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"),
    new hre.ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"),
    new hre.ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"),
    new hre.ethers.Wallet("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"),
    new hre.ethers.Wallet("0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"),
  ];

  for (let i = 0; i < burners.length; i++) {
    const bal = await hre.ethers.provider.getBalance(burners[i].address);
    console.log(`Burner ${i+1} (${burners[i].address}): ${hre.ethers.formatEther(bal)} MON`);
  }
}

main().catch(console.error);
