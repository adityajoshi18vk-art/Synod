import { createWalletClient, http, fallback, parseEther, formatEther, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import { publicClient, ADDRESSES, BURNER_KEYS, COUNCIL_KEYS, getTemplatedRationale } from './config.js';
import { VOTING_ABI, ESCROW_ABI } from './abis.js';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const withTimeout = (promise, ms, label) => 
  Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms on ${label}`)), ms)
    )
  ]);

/**
 * Send a commit TX and wait for receipt. Returns the agent on success, null on failure.
 * Designed to run concurrently — each agent has its own wallet client / nonce.
 */
async function commitAgent(agent, label, proposalId) {
  try {
    console.log(
      `🔍 [${label}] PRE-COMMIT: addr=${agent.account.address} ` +
      `choice=${agent.choice} (${agent.choice ? 'YES' : 'NO'})`
    );

    const hashData = keccak256(encodePacked(
      ['bool', 'bytes32', 'address'],
      [agent.choice, agent.salt, agent.account.address]
    ));

    const hash = await withTimeout(
      agent.client.writeContract({
        address: ADDRESSES.voting,
        abi: VOTING_ABI,
        functionName: 'commitVote',
        args: [BigInt(proposalId), hashData],
        gas: 100000n,
      }),
      8000,
      `Commit TX Send (${label})`
    );

    console.log(`[${label}] TX Sent: ${hash}. Waiting for receipt...`);

    await withTimeout(
      publicClient.waitForTransactionReceipt({ hash }),
      8000,
      `Receipt Wait (${label})`
    );

    console.log(`✅ [${label}] Commit confirmed!`);
    return agent;
  } catch (err) {
    if (label.includes("Arjun") || label.includes("Council")) {
      console.error(`🚨 [${label}] FULL COMMIT ERROR OBJECT:`, err);
    } else {
      console.error(`⚠️ [${label}] Commit failed:`, err.shortMessage || err.message);
    }
    return null;
  }
}

/**
 * Send a reveal TX and wait for receipt. Returns the agent on success, null on failure.
 * Designed to run concurrently — each agent has its own wallet client / nonce.
 */
async function revealAgent(agent, label, proposalId) {
  const rationale = agent.tag === 'Council'
    ? agent.rationale
    : getTemplatedRationale(agent.choice, agent.idx);
  try {
    console.log(
      `🔍 [${label}] PRE-REVEAL: addr=${agent.account.address} ` +
      `choice=${agent.choice} (${agent.choice ? 'YES' : 'NO'})`
    );

    const hash = await withTimeout(
      agent.client.writeContract({
        address: ADDRESSES.voting,
        abi: VOTING_ABI,
        functionName: 'revealVote',
        args: [BigInt(proposalId), agent.choice, agent.salt, rationale],
        gas: 150000n,
      }),
      8000,
      `Reveal TX Send (${label})`
    );

    console.log(`[${label}] TX Sent: ${hash}. Waiting for receipt...`);

    await withTimeout(
      publicClient.waitForTransactionReceipt({ hash }),
      8000,
      `Receipt Wait (${label})`
    );

    console.log(`✅ [${label}] Reveal confirmed: ${agent.choice ? 'YES' : 'NO'}`);
    return agent;
  } catch (err) {
    console.error(`⚠️ [${label}] Reveal failed or timed out:`, err.shortMessage || err.message);
    return null;
  }
}

/** Human-readable label for an agent. */
function agentLabel(agent) {
  return agent.tag === 'Council' ? `Council ${agent.name}` : `Burner ${agent.idx}`;
}

/**
 * Build the list of Council agents from COUNCIL_KEYS + LLM decisions.
 * Returns an array of { account, client, choice, salt, name, rationale, tag }
 * suitable for the unified commit/reveal flow.
 *
 * @param {Array<{ name: string, vote: string, rationale: string }>} councilDecisions
 */
function buildCouncilAgents(councilDecisions) {
  if (!COUNCIL_KEYS || COUNCIL_KEYS.length === 0 || !councilDecisions || councilDecisions.length === 0) {
    return [];
  }

  return COUNCIL_KEYS.map((pk, idx) => {
    const decision = councilDecisions[idx];
    if (!decision) return null;

    const account = privateKeyToAccount(pk);
    const client = createWalletClient({
      account,
      chain: monadTestnet,
      transport: fallback([
        http(import.meta.env.VITE_RPC_URL_PRIMARY),
        http(import.meta.env.VITE_RPC_URL_FALLBACK)
      ]),
    });
    const choice = decision.vote === 'YES';
    const salt = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    // ── Diagnostic log (requested by user) ──
    console.log(
      `🔍 [Council ${decision.name}] addr=${account.address} ` +
      `rawVote="${decision.vote}" boolChoice=${choice}`
    );

    return { account, client, choice, salt, name: decision.name, rationale: decision.rationale, tag: 'Council' };
  }).filter(Boolean);
}

/**
 * Unified demo swarm + council voting lifecycle.
 *
 * Runs ALL voters (burner swarm agents AND council agents) through
 * a single commit → wait → reveal → wait → tally pipeline so that
 * every voter participates in the same on-chain windows.
 *
 * Commits and reveals are fired via Promise.allSettled (parallel).
 * The only sequential dependency is: council decisions must be known
 * before building their commit hashes (enforced by the caller passing
 * councilDecisions in after the LLM call resolves).
 *
 * @param {string} proposalId
 * @param {Array<{ name: string, vote: string, rationale: string }>} [councilDecisions]
 */
export async function triggerDemoSwarm(proposalId, councilDecisions) {
  // ── Build Burner agents ─────────────────────────────────────────
  const burnerAgents = BURNER_KEYS.map((pk, idx) => {
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({
      account,
      chain: monadTestnet,
      transport: fallback([
        http(import.meta.env.VITE_RPC_URL_PRIMARY),
        http(import.meta.env.VITE_RPC_URL_FALLBACK)
      ]),
    });
    // Hardcoded vote split: first 4 vote YES (80%), last 1 votes NO (20%)
    const choice = idx < Math.ceil(BURNER_KEYS.length * 0.8);
    const salt = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');

    return { account, client, choice, salt, idx, tag: 'Burner' };
  });

  // ── Build Council agents (if decisions supplied) ────────────────
  const councilAgents = buildCouncilAgents(councilDecisions);

  // Combine into a single list; council agents go after burner agents
  const allAgents = [...burnerAgents, ...councilAgents];

  console.log(
    `🚀 Triggering demo for Proposal #${proposalId}: ` +
    `${burnerAgents.length} burner + ${councilAgents.length} council = ${allAgents.length} agents`
  );

  // --- 1. COMMIT PHASE (parallel via Promise.allSettled) ---
  console.log("🔒 Starting Commit Phase (parallel)...");

  if (allAgents.length > 0) {
    const balance = await publicClient.getBalance({ address: allAgents[0].account.address });
    console.log(`[Agent 0] Balance: ${formatEther(balance)} MON`);
    if (balance === 0n) {
      console.warn(`⚠️ Agent 0 has 0 MON! Funding needed.`);
    }
  }

  console.log("diagnostics: enqueued addresses for commit Phase:", allAgents.map(a => a.account.address));

  const commitResults = await Promise.allSettled(
    allAgents.map((agent, i) => 
      new Promise(resolve => setTimeout(() => resolve(commitAgent(agent, agentLabel(agent), proposalId)), i * 1000))
    )
  );

  const successfulCommits = commitResults
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  if (successfulCommits.length === 0) {
    throw new Error("All agents failed to commit. Swarm aborted.");
  }

  console.log(`✅ Commit Phase done. ${successfulCommits.length}/${allAgents.length} succeeded.`);

  if (typeof window !== 'undefined') {
    alert(`Votes committed! Waiting for the blockchain commit window to close before revealing...`);
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

  // --- 3. REVEAL PHASE (parallel via Promise.allSettled) ---
  console.log("🔓 Starting Reveal Phase (parallel)...");

  const revealResults = await Promise.allSettled(
    successfulCommits.map((agent, i) => 
      new Promise(resolve => setTimeout(() => resolve(revealAgent(agent, agentLabel(agent), proposalId)), i * 1000))
    )
  );

  const successfulReveals = revealResults
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  console.log(`✅ Reveal Phase done. ${successfulReveals.length}/${successfulCommits.length} succeeded.`);

  // Log council-specific summary
  const councilReveals = successfulReveals.filter(a => a.tag === 'Council');
  const burnerReveals  = successfulReveals.filter(a => a.tag === 'Burner');
  if (councilReveals.length > 0) {
    const councilYes = councilReveals.filter(a => a.choice).length;
    const councilNo  = councilReveals.length - councilYes;
    console.log(`🧠 Council: ${councilReveals.length} revealed (${councilYes} YES / ${councilNo} NO)`);
  }
  if (burnerReveals.length > 0) {
    const burnerYes = burnerReveals.filter(a => a.choice).length;
    const burnerNo  = burnerReveals.length - burnerYes;
    console.log(`🤖 Burner:  ${burnerReveals.length} revealed (${burnerYes} YES / ${burnerNo} NO)`);
  }

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
  if (successfulReveals.length > 0) {
    const tallyAgent = successfulReveals[0];
    try {
      const txHash = await withTimeout(
        tallyAgent.client.writeContract({
          address: ADDRESSES.voting,
          abi: VOTING_ABI,
          functionName: 'tallyVotes',
          args: [BigInt(proposalId)],
          gas: 400000n,
        }),
        8000,
        `Tally TX Send`
      );

      await withTimeout(
        publicClient.waitForTransactionReceipt({ hash: txHash }),
        8000,
        `Tally Receipt Wait`
      );
      console.log(`🎉 Tally complete! (tx: ${txHash})`);
    } catch (err) {
      console.error("Tally failed:", err.shortMessage || err.message);
    }
  }

  console.log("🏁 Demo Swarm finished.");
}

/**
 * Automatically tally and release/refund a proposal once the reveal deadline has passed.
 * Gracefully handles cases where it's already tallied or already released.
 * @param {string|number|bigint} proposalId 
 */
export async function autoResolveProposal(proposalId) {
  try {
    const proposal = await publicClient.readContract({
      address: ADDRESSES.voting,
      abi: VOTING_ABI,
      functionName: 'getProposal',
      args: [BigInt(proposalId)],
    });

    const now = Date.now();
    const revealDeadline = Number(proposal.revealDeadline) * 1000;

    if (now <= revealDeadline) {
      return; // Not ready yet
    }

    // We need a wallet client to send transactions. Use burner 0.
    const account = privateKeyToAccount(BURNER_KEYS[0]);
    const client = createWalletClient({
      account,
      chain: monadTestnet,
      transport: fallback([
        http(import.meta.env.VITE_RPC_URL_PRIMARY),
        http(import.meta.env.VITE_RPC_URL_FALLBACK)
      ]),
    });

    // 1. Tally if pending
    if (Number(proposal.status) === 0 && !proposal.tallied) {
      console.log(`[AutoResolve] Tallying proposal ${proposalId} at ${new Date().toISOString()}...`);
      console.log(`[AutoResolve] Executing tallyVotes(${proposalId}) via wallet client...`);
      try {
        const hash = await client.writeContract({
          address: ADDRESSES.voting,
          abi: VOTING_ABI,
          functionName: 'tallyVotes',
          args: [BigInt(proposalId)],
          gas: 400000n,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`[AutoResolve] Tally confirmed: ${hash}`);
      } catch (err) {
        if (!err.message.includes("Already tallied") && !err.message.includes("Proposal not pending")) {
          console.error("[AutoResolve] Tally failed:", err.shortMessage || err.message);
        }
      }
    }

    // Fetch updated proposal to check if approved/rejected
    const updatedProposal = await publicClient.readContract({
      address: ADDRESSES.voting,
      abi: VOTING_ABI,
      functionName: 'getProposal',
      args: [BigInt(proposalId)],
    });

    // 2. Release or Refund Escrow
    const depositId = await publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: ESCROW_ABI,
      functionName: 'proposalDeposit',
      args: [BigInt(proposalId)],
    });

    if (depositId > 0n) {
      const deposit = await publicClient.readContract({
        address: ADDRESSES.escrow,
        abi: ESCROW_ABI,
        functionName: 'deposits',
        args: [depositId],
      });

      const [depositor, amount, pid, released, refunded] = deposit;
      
      if (!released && !refunded) {
        if (Number(updatedProposal.status) === 1) { // Approved
          console.log(`[AutoResolve] Proposal Approved. Releasing funds for ${proposalId} at ${new Date().toISOString()}...`);
          console.log(`[AutoResolve] Executing release(${proposalId}) via wallet client...`);
          try {
            const hash = await client.writeContract({
              address: ADDRESSES.escrow,
              abi: ESCROW_ABI,
              functionName: 'release',
              args: [BigInt(proposalId)],
              gas: 200000n,
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`[AutoResolve] Release confirmed: ${hash}`);
          } catch (err) {
            if (!err.message.includes("Already released")) {
              console.error("[AutoResolve] Release failed:", err.shortMessage || err.message);
            }
          }
        } else if (Number(updatedProposal.status) === 2 || (now > revealDeadline && !updatedProposal.tallied)) { // Rejected or stale
          console.log(`[AutoResolve] Proposal Rejected/Stale. Refunding escrow for ${proposalId} at ${new Date().toISOString()}...`);
          console.log(`[AutoResolve] Executing refund(${proposalId}) via wallet client...`);
          try {
            const hash = await client.writeContract({
              address: ADDRESSES.escrow,
              abi: ESCROW_ABI,
              functionName: 'refund',
              args: [BigInt(proposalId)],
              gas: 200000n,
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`[AutoResolve] Refund confirmed: ${hash}`);
          } catch (err) {
            if (!err.message.includes("Already refunded")) {
              console.error("[AutoResolve] Refund failed:", err.shortMessage || err.message);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[AutoResolve] Error:", error);
  }
}
