import { createWalletClient, http, parseEther, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import { publicClient, ADDRESSES, BURNER_KEYS, getTemplatedRationale } from './config.js';
import { VOTING_ABI } from './abis.js';

export async function triggerDemoSwarm(proposalId) {
  if (!BURNER_KEYS || BURNER_KEYS.length === 0) {
    throw new Error("No burner keys found. Add VITE_BURNER_PK_* to .env");
  }

  // Set up accounts and clients for each burner
  const agents = BURNER_KEYS.map((pk, idx) => {
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(import.meta.env.VITE_RPC_URL),
    });
    // Hardcoded vote split: first 4 vote YES (80%), last 1 votes NO (20%)
    const choice = idx < Math.ceil(BURNER_KEYS.length * 0.8);
    // Create a random salt (32 bytes hex)
    const salt = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    
    return { account, client, choice, salt, idx };
  });

  console.log(`🚀 Triggering demo swarm for Proposal #${proposalId} with ${agents.length} agents`);

  // --- 1. COMMIT PHASE ---
  console.log("🔒 Starting Commit Phase...");
  const commitPromises = agents.map(async (agent) => {
    try {
      const hash = keccak256(encodePacked(
        ['bool', 'bytes32', 'address'],
        [agent.choice, agent.salt, agent.account.address]
      ));
      const { request } = await publicClient.simulateContract({
        address: ADDRESSES.voting,
        abi: VOTING_ABI,
        functionName: 'commitVote',
        args: [BigInt(proposalId), hash],
        account: agent.account,
      });
      const txHash = await agent.client.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60000 });
      return { success: true, agent };
    } catch (err) {
      console.log(`Agent ${agent.idx} failed to commit:`, err);
      return { success: false, agent, error: err };
    }
  });

  // Use allSettled so one failure doesn't block the rest
  const commitResults = await Promise.allSettled(commitPromises);
  const successfulCommits = commitResults
    .filter(r => r.status === 'fulfilled' && r.value.success)
    .map(r => r.value.agent);

  console.log(`✅ Commit Phase done. ${successfulCommits.length}/${agents.length} succeeded.`);

  if (successfulCommits.length === 0) {
    throw new Error("All commits failed. Swarm aborted.");
  }

  // --- 2. WAIT FOR COMMIT WINDOW TO CLOSE ---
  const proposal = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'getProposal',
    args: [BigInt(proposalId)],
  });

  const commitDeadline = Number(proposal.commitDeadline) * 1000;
  let now = Date.now();
  if (now < commitDeadline) {
    const waitTime = commitDeadline - now + 2000; // wait 2 extra seconds to be safe
    console.log(`⏳ Waiting ${Math.round(waitTime / 1000)}s for commit window to close...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  } else {
    console.log("⏳ Commit window already closed. Proceeding to reveal.");
  }

  // --- 3. REVEAL PHASE ---
  console.log("🔓 Starting Reveal Phase...");
  const revealPromises = successfulCommits.map(async (agent) => {
    const rationale = getTemplatedRationale(agent.choice, agent.idx);
    try {
      const { request } = await publicClient.simulateContract({
        address: ADDRESSES.voting,
        abi: VOTING_ABI,
        functionName: 'revealVote',
        args: [BigInt(proposalId), agent.choice, agent.salt, rationale],
        account: agent.account,
      });
      const txHash = await agent.client.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60000 });
      return { success: true, agent };
    } catch (err) {
      console.error(`Agent ${agent.idx} failed to reveal:`, err.shortMessage || err.message);
      return { success: false, agent, error: err };
    }
  });

  const revealResults = await Promise.allSettled(revealPromises);
  const successfulReveals = revealResults
    .filter(r => r.status === 'fulfilled' && r.value.success)
    .map(r => r.value.agent);

  console.log(`✅ Reveal Phase done. ${successfulReveals.length}/${successfulCommits.length} succeeded.`);

  // --- 4. WAIT FOR REVEAL WINDOW TO CLOSE ---
  const revealDeadline = Number(proposal.revealDeadline) * 1000;
  now = Date.now();
  if (now < revealDeadline) {
    const waitTime = revealDeadline - now + 2000;
    console.log(`⏳ Waiting ${Math.round(waitTime / 1000)}s for reveal window to close...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // --- 5. TALLY ---
  console.log("⚖️ Tallying votes...");
  // Anyone can call tally. Let's just use the first agent that revealed successfully.
  if (successfulReveals.length > 0) {
    const tallyAgent = successfulReveals[0];
    try {
      const { request } = await publicClient.simulateContract({
        address: ADDRESSES.voting,
        abi: VOTING_ABI,
        functionName: 'tallyVotes',
        args: [BigInt(proposalId)],
        account: tallyAgent.account,
      });
      const txHash = await tallyAgent.client.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`🎉 Tally complete! (tx: ${txHash})`);
    } catch (err) {
      console.error("Tally failed:", err.shortMessage || err.message);
    }
  }

  console.log("🏁 Demo Swarm finished.");
}
