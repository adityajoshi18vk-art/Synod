import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const registryAddress = process.env.CONTRACT_ADDRESS;
  if (!registryAddress) {
    throw new Error("Set CONTRACT_ADDRESS (AgentRegistry) in .env first.");
  }

  console.log(`Deploying SynodVoting linked to AgentRegistry at ${registryAddress}...`);

  const SynodVoting = await hre.ethers.getContractFactory("SynodVoting");
  const voting = await SynodVoting.deploy(registryAddress);

  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log(`SynodVoting deployed to: ${address}`);
  console.log(`\nAdd this to your .env:\nVOTING_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
