import hre from "hardhat";

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Please set CONTRACT_ADDRESS in your .env file or export it.");
  }

  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = AgentRegistry.attach(contractAddress);

  // We need an address to read. We can use the deployer's address or let the user pass it
  const signers = await hre.ethers.getSigners();
  const addressToRead = signers[0].address;

  console.log(`Reading agent state for: ${addressToRead}`);
  
  const agent = await agentRegistry.agents(addressToRead);
  console.log(`isRegistered: ${agent.isRegistered}`);
  console.log(`label: ${agent.label}`);
  console.log(`reputationScore: ${agent.reputationScore.toString()}`);
  console.log(`totalVotes: ${agent.totalVotes.toString()}`);
  console.log(`correctVotes: ${agent.correctVotes.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
