import hre from "hardhat";

async function main() {
  console.log("Deploying AgentRegistry to Monad testnet...");

  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();

  await agentRegistry.waitForDeployment();
  
  const address = await agentRegistry.getAddress();
  console.log(`AgentRegistry deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
