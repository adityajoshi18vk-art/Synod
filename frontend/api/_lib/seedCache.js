/**
 * One-shot script to seed the council cache by calling live LLMs.
 * Run: node api/_lib/seedCache.js
 * 
 * Reads API keys from ../.env (the frontend .env), calls all 5 agents,
 * populates cachedResponses.json.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env manually (can't use import.meta.env outside Vite)
const envPath = join(__dirname, '..', '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
}

// Inject into process.env
process.env.SARVAM_API_KEY = envVars.SARVAM_API_KEY;
process.env.GROQ_API_KEY = envVars.GROQ_API_KEY;
process.env.USE_CACHED_LLM = 'false'; // Force live calls

console.log('🧠 Seeding council cache with live LLM calls...');
console.log(`   SARVAM_API_KEY: ${process.env.SARVAM_API_KEY ? '✅ set' : '❌ missing'}`);
console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ set' : '❌ missing'}`);
console.log('');

const { runCouncilVote } = await import('./council.js');

const proposal = {
  description: 'Fund AI research initiative for decentralized governance optimization',
  amount: '0.5 MON',
  target: '0x1234567890abcdef1234567890abcdef12345678',
};

console.log(`📋 Proposal: "${proposal.description}"`);
console.log(`   Amount: ${proposal.amount}, Target: ${proposal.target}`);
console.log('');
console.log('🔄 Calling all 5 agents in parallel (6s timeout each)...');
console.log('');

try {
  const results = await runCouncilVote(proposal);

  console.log('═══════════════════════════════════════════════');
  console.log('  COUNCIL VOTE RESULTS');
  console.log('═══════════════════════════════════════════════');

  for (const agent of results) {
    const icon = agent.vote === 'YES' ? '✅' : '❌';
    const src = agent.source === 'live' ? '🟢 live' : '🟡 cached';
    console.log(`  ${icon} ${agent.name} (${agent.provider} / ${agent.model})`);
    console.log(`     Vote: ${agent.vote} | Source: ${src}`);
    console.log(`     "${agent.rationale}"`);
    console.log('');
  }

  const liveCount = results.filter(r => r.source === 'live').length;
  console.log('═══════════════════════════════════════════════');
  console.log(`  ${liveCount}/5 agents responded live`);

  // Verify cache was written
  const cachePath = join(__dirname, 'cachedResponses.json');
  const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
  const cacheKeys = Object.keys(cache);
  console.log(`  Cache now has ${cacheKeys.length} entries: ${cacheKeys.join(', ')}`);
  console.log('═══════════════════════════════════════════════');

  if (liveCount === 5) {
    console.log('\n🎉 All 5 agents cached successfully! Cache is seeded.');
  } else {
    console.log(`\n⚠️  Only ${liveCount}/5 live. Re-run to fill remaining entries.`);
  }
} catch (err) {
  console.error('💥 Fatal error:', err);
  process.exit(1);
}
