import hre from "hardhat";
import { parseEther } from "viem";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const votingAddr = process.env.VOTING_ADDRESS;
  const escrowAddr = process.env.ESCROW_ADDRESS;

  const voting = await hre.ethers.getContractAt("SynodVoting", votingAddr);
  const escrow = await hre.ethers.getContractAt("SynodEscrow", escrowAddr);

  console.log("Submitting 5 proposals back to back...");

  for (let i = 1; i <= 5; i++) {
    const tx = await voting.submitProposal(
      `Load Test Proposal ${i}`,
      hre.ethers.parseEther("0.001"),
      deployer.address,
      30, // 30s commit
      30, // 30s reveal
      1000 // 1000 weight quorum
    );
    const receipt = await tx.wait();
    
    // get proposal ID
    const filter = voting.filters.ProposalCreated();
    const events = await voting.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
    const pid = events[events.length - 1].args.proposalId;
    
    console.log(`Created Proposal #${pid}, funding escrow...`);
    const escrowTx = await escrow.deposit(pid, { value: hre.ethers.parseEther("0.001") });
    await escrowTx.wait();
    console.log(`Proposal #${pid} ready!`);
  }
}

main().catch(console.error);
