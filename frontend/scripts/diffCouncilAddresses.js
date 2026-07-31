/**
 * Diagnostic: compare council-panel addresses vs on-chain voter addresses.
 *
 * Run:  node --experimental-vm-modules scripts/diffCouncilAddresses.js
 * (from frontend/)
 *
 * Prints:
 *   - 5 council-panel addresses (derived from VITE_COUNCIL_PK_*)
 *   - 5 burner-swarm addresses  (derived from VITE_BURNER_PK_*)
 *   - All on-chain voter addresses for the latest proposal
 *   - Which set the on-chain voters belong to
 */

import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Parse .env manually (no Vite) ────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) env[t.slice(0, eq)] = t.slice(eq + 1);
}

// ── Derive addresses ─────────────────────────────────────────────
const councilPKs = [
  env.VITE_COUNCIL_PK_1,
  env.VITE_COUNCIL_PK_2,
  env.VITE_COUNCIL_PK_3,
  env.VITE_COUNCIL_PK_4,
  env.VITE_COUNCIL_PK_5,
].filter(Boolean);

const burnerPKs = [
  env.VITE_BURNER_PK_1,
  env.VITE_BURNER_PK_2,
  env.VITE_BURNER_PK_3,
  env.VITE_BURNER_PK_4,
  env.VITE_BURNER_PK_5,
].filter(Boolean);

const councilAddrs = councilPKs.map(pk => privateKeyToAccount(pk).address.toLowerCase());
const burnerAddrs  = burnerPKs.map(pk => privateKeyToAccount(pk).address.toLowerCase());

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  COUNCIL PANEL ADDRESSES  (from VITE_COUNCIL_PK_*)');
console.log('═══════════════════════════════════════════════════════════');
councilAddrs.forEach((a, i) => console.log(`  [Council ${i}]  ${a}`));

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  BURNER SWARM ADDRESSES   (from VITE_BURNER_PK_*)');
console.log('═══════════════════════════════════════════════════════════');
burnerAddrs.forEach((a, i) => console.log(`  [Burner  ${i}]  ${a}`));

// ── Fetch on-chain voters for latest proposal ────────────────────
const VOTING_ADDRESS = env.VITE_VOTING_ADDRESS;
const REGISTRY_ADDRESS = env.VITE_AGENT_REGISTRY_ADDRESS;
const RPC_URL = env.VITE_RPC_URL;

// Minimal ABIs — just the functions we need
const VOTING_ABI = [
  { name: 'proposalCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getVoters', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address[]' }] },
  { name: 'getVote', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }, { type: 'address' }], outputs: [{ type: 'bytes32', name: 'commitHash' }, { type: 'bool', name: 'choice' }, { type: 'bytes32', name: 'salt' }, { type: 'bool', name: 'revealed' }, { type: 'uint256', name: 'weight' }, { type: 'string', name: 'rationale' }] },
];
const REGISTRY_ABI = [
  { name: 'getAgentCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'agentList', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'isRegistered', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
];

const client = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });

try {
  // Latest proposal
  const proposalCount = await client.readContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: 'proposalCount' });
  console.log(`\n  Latest proposal ID: ${proposalCount}`);

  if (proposalCount === 0n) {
    console.log('  No proposals found. Cannot diff.');
    process.exit(0);
  }

  // On-chain voters
  const voters = await client.readContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: 'getVoters', args: [proposalCount] });
  const voterAddrs = voters.map(v => v.toLowerCase());

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ON-CHAIN VOTERS  (Proposal #${proposalCount}, ${voterAddrs.length} total)`);
  console.log('═══════════════════════════════════════════════════════════');

  for (const addr of voterAddrs) {
    // Fetch vote details
    let voteInfo = '';
    try {
      const vote = await client.readContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: 'getVote', args: [proposalCount, addr] });
      if (vote.revealed) {
        voteInfo = `  vote=${vote.choice ? 'YES' : 'NO'}  weight=${vote.weight}`;
      } else {
        voteInfo = '  (committed, not revealed)';
      }
    } catch { voteInfo = '  (could not fetch vote)'; }

    const inCouncil = councilAddrs.includes(addr);
    const inBurner  = burnerAddrs.includes(addr);
    const tag = inCouncil ? ' ← COUNCIL' : inBurner ? ' ← BURNER' : ' ← UNKNOWN';
    console.log(`  ${addr}${tag}${voteInfo}`);
  }

  // ── Diff ────────────────────────────────────────────────────────
  const councilOnChain = voterAddrs.filter(a => councilAddrs.includes(a));
  const burnerOnChain  = voterAddrs.filter(a => burnerAddrs.includes(a));
  const unknownOnChain = voterAddrs.filter(a => !councilAddrs.includes(a) && !burnerAddrs.includes(a));

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DIFF RESULT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Council addresses on-chain: ${councilOnChain.length} / ${councilAddrs.length}`);
  console.log(`  Burner  addresses on-chain: ${burnerOnChain.length} / ${burnerAddrs.length}`);
  console.log(`  Unknown addresses on-chain: ${unknownOnChain.length}`);

  if (councilOnChain.length === councilAddrs.length) {
    console.log('\n  ✅ All 5 council addresses ARE present on-chain.');
    console.log('     → The mismatch is a data-conversion bug in the council commit/reveal path.');
  } else if (councilOnChain.length === 0) {
    console.log('\n  ❌ ZERO council addresses found on-chain!');
    console.log('     → The votes you see are from the BURNER SWARM (hardcoded 4 YES / 1 NO),');
    console.log('       NOT from the council agents. Council agents were never registered or');
    console.log('       their commits failed silently.');
  } else {
    console.log(`\n  ⚠️  Only ${councilOnChain.length}/5 council addresses found on-chain.`);
    console.log('     → Partial council participation. Check commit errors above.');
  }

  // Check registration status
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AGENT REGISTRY STATUS');
  console.log('═══════════════════════════════════════════════════════════');

  for (let i = 0; i < councilAddrs.length; i++) {
    try {
      const registered = await client.readContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: 'isRegistered', args: [councilAddrs[i]] });
      console.log(`  [Council ${i}]  ${councilAddrs[i]}  registered=${registered}`);
    } catch (err) {
      console.log(`  [Council ${i}]  ${councilAddrs[i]}  ERROR: ${err.shortMessage || err.message}`);
    }
  }
  for (let i = 0; i < burnerAddrs.length; i++) {
    try {
      const registered = await client.readContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, functionName: 'isRegistered', args: [burnerAddrs[i]] });
      console.log(`  [Burner  ${i}]  ${burnerAddrs[i]}  registered=${registered}`);
    } catch (err) {
      console.log(`  [Burner  ${i}]  ${burnerAddrs[i]}  ERROR: ${err.shortMessage || err.message}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DONE');
  console.log('═══════════════════════════════════════════════════════════');
} catch (err) {
  console.error('Fatal error:', err.shortMessage || err.message);
  process.exit(1);
}
