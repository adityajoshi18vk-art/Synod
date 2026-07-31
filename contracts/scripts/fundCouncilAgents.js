import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Phase 3b: Generate, fund, and register 5 Council agent wallets.
 * Mirrors the existing fundBurners.js pattern.
 *
 * Run: npx hardhat run scripts/fundCouncilAgents.js --network monadTestnet
 */

const COUNCIL_LABELS = [
  "Arjun — Risk Assessor",
  "Nova — Trend Strategist",
  "Sentinel — Compliance Auditor",
  "Cipher — Quant Analyst",
  "Oracle — Macro Economist",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Funding council agents from:", deployer.address);

  // Generate 5 fresh random wallets
  const agents = Array.from({ length: 5 }).map(() => hre.ethers.Wallet.createRandom());

  console.log("\n--- COUNCIL AGENT KEYS (add to frontend/.env) ---");
  for (let i = 0; i < agents.length; i++) {
    console.log(`VITE_COUNCIL_PK_${i + 1}=${agents[i].privateKey}`);
  }
  console.log("--------------------------------------------------\n");

  const amount = hre.ethers.parseEther("0.05");

  // Fund each wallet
  for (let i = 0; i < agents.length; i++) {
    const tx = await deployer.sendTransaction({
      to: agents[i].address,
      value: amount,
    });
    await tx.wait();
    console.log(`Funded ${COUNCIL_LABELS[i]} (${agents[i].address}) with 0.05 MON`);
  }

  // Register in AgentRegistry with persona labels
  const registryAddr = process.env.CONTRACT_ADDRESS;
  if (!registryAddr) {
    throw new Error("Set CONTRACT_ADDRESS in .env");
  }
  const registry = await hre.ethers.getContractAt("AgentRegistry", registryAddr);

  for (let i = 0; i < agents.length; i++) {
    const tx = await registry.register(agents[i].address, COUNCIL_LABELS[i]);
    await tx.wait();
    console.log(`Registered ${COUNCIL_LABELS[i]} in AgentRegistry`);
  }

  console.log("\n✅ All 5 Council agents funded and registered!");
  console.log("   Copy the VITE_COUNCIL_PK_* lines above into frontend/.env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
