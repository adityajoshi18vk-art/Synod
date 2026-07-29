import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Funding burners from:", deployer.address);

  // Generate 5 brand new random wallets to ensure they are fresh EOAs
  const burners = Array.from({length: 5}).map(() => hre.ethers.Wallet.createRandom());

  console.log("\n--- NEW BURNER KEYS ---");
  for (let i = 0; i < burners.length; i++) {
    console.log(`VITE_BURNER_PK_${i+1}=${burners[i].privateKey}`);
  }
  console.log("-----------------------\n");

  const amount = hre.ethers.parseEther("0.05"); 
  
  for (let i = 0; i < burners.length; i++) {
    const tx = await deployer.sendTransaction({
      to: burners[i].address,
      value: amount,
    });
    await tx.wait();
    console.log(`Funded burner ${i + 1} (${burners[i].address}) with 0.05 MON`);
  }

  // Register them
  const registryAddr = process.env.CONTRACT_ADDRESS;
  const registry = await hre.ethers.getContractAt("AgentRegistry", registryAddr);
  
  for (let i = 0; i < burners.length; i++) {
    const tx = await registry.register(burners[i].address, `Demo Agent ${i + 1}`);
    await tx.wait();
    console.log(`Registered burner ${i + 1} in AgentRegistry`);
  }

  console.log("Done!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
