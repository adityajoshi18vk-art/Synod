import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Phase 2 deployment: deploys all contracts fresh, wires them together.
 * 
 *  1. AgentRegistry
 *  2. SynodVoting (linked to registry)
 *  3. registry.setVotingContract(voting)
 *  4. TimelockController (60s minDelay for demo)
 *  5. SynodEscrow (linked to voting + timelock as guardian)
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("");

  // 1. AgentRegistry
  console.log("1) Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`   AgentRegistry: ${registryAddr}`);

  // 2. SynodVoting
  console.log("2) Deploying SynodVoting...");
  const SynodVoting = await hre.ethers.getContractFactory("SynodVoting");
  const voting = await SynodVoting.deploy(registryAddr);
  await voting.waitForDeployment();
  const votingAddr = await voting.getAddress();
  console.log(`   SynodVoting:   ${votingAddr}`);

  // 3. Wire: registry.setVotingContract
  console.log("3) Wiring registry → voting...");
  const wireTx = await registry.setVotingContract(votingAddr);
  await wireTx.wait();
  console.log("   ✓ votingContract set");

  // 4. TimelockController
  const MIN_DELAY = 60; // 60 seconds for demo
  console.log("4) Deploying TimelockController (60s delay)...");
  const TimelockController = await hre.ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(
    MIN_DELAY,
    [deployer.address],  // proposers
    [deployer.address],  // executors
    deployer.address     // admin
  );
  await timelock.waitForDeployment();
  const timelockAddr = await timelock.getAddress();
  console.log(`   TimelockController: ${timelockAddr}`);

  // 5. SynodEscrow
  console.log("5) Deploying SynodEscrow...");
  const SynodEscrow = await hre.ethers.getContractFactory("SynodEscrow");
  const escrow = await SynodEscrow.deploy(votingAddr, timelockAddr);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log(`   SynodEscrow:   ${escrowAddr}`);

  console.log("\n═══════════════════════════════════════════");
  console.log("  All contracts deployed! Add to .env:");
  console.log("═══════════════════════════════════════════");
  console.log(`CONTRACT_ADDRESS=${registryAddr}`);
  console.log(`VOTING_ADDRESS=${votingAddr}`);
  console.log(`TIMELOCK_ADDRESS=${timelockAddr}`);
  console.log(`ESCROW_ADDRESS=${escrowAddr}`);
  console.log("═══════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
