import { callLLM } from './llmClient.js';
import { parseResponse } from './parseResponse.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Agent Roster ──────────────────────────────────────────────

export const COUNCIL_ROSTER = [
  {
    name: 'Arjun',
    title: 'Risk Assessor',
    provider: 'Sarvam AI',
    model: 'sarvam-105b',
    baseUrl: 'https://api.sarvam.ai/v1/chat/completions',
    envKey: 'SARVAM_API_KEY',
    persona: 'You are Arjun, a conservative risk analyst. Flag downside exposure, capital risk, and volatility.',
  },
  {
    name: 'Nova',
    title: 'Trend Strategist',
    provider: 'Groq',
    model: 'mixtral-8x7b-32768',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    persona: 'You are Nova, a momentum-driven trend strategist. Favor proposals aligned with strong market trends.',
  },
  {
    name: 'Sentinel',
    title: 'Compliance Auditor',
    provider: 'Groq',
    model: 'gemma2-9b-it',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    persona: 'You are Sentinel, a compliance auditor. Check for regulatory, contractual, or governance red flags.',
  },
  {
    name: 'Cipher',
    title: 'Quant Analyst',
    provider: 'Groq',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    persona: 'You are Cipher, a quantitative analyst. Evaluate purely on metrics, amounts, and on-chain data.',
  },
  {
    name: 'Oracle',
    title: 'Macro Economist',
    provider: 'Groq',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    persona: 'You are Oracle, a macro economist. Consider broad economic and geopolitical implications.',
  },
];

// ── Cache Helpers ─────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, 'cachedResponses.json');

function readCache() {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

// ── Core Orchestrator ─────────────────────────────────────────

/**
 * Run council vote for a proposal. Returns an array of 5 agent results.
 *
 * @param {{ description: string, amount: string, target: string }} proposal
 * @returns {Promise<Array<{ name, title, provider, model, vote, rationale, source }>>}
 */
export async function runCouncilVote(proposal) {
  const useCached = process.env.USE_CACHED_LLM === 'true';
  const cache = readCache();

  if (useCached) {
    return COUNCIL_ROSTER.map((agent) => {
      const cached = cache[agent.name];
      if (cached) {
        return {
          name: agent.name,
          title: agent.title,
          provider: agent.provider,
          model: agent.model,
          vote: cached.vote,
          rationale: cached.rationale,
          source: 'cached',
        };
      }
      // No cache entry at all — return a clear failure indicator
      return {
        name: agent.name,
        title: agent.title,
        provider: agent.provider,
        model: agent.model,
        vote: 'NO',
        rationale: 'No cached response available.',
        source: 'cached',
      };
    });
  }

  // Live mode: fire all 5 in parallel
  const promises = COUNCIL_ROSTER.map(async (agent) => {
    const apiKey = process.env[agent.envKey];
    if (!apiKey) {
      throw new Error(`Missing env var: ${agent.envKey}`);
    }

    const messages = [
      {
        role: 'system',
        content: `${agent.persona} You will receive a proposal. Respond with ONLY a JSON object: {"vote": "YES" or "NO", "rationale": "<one sentence, under 20 words>"}.`,
      },
      {
        role: 'user',
        content: `Proposal: ${proposal.description}. Amount: ${proposal.amount}. Target: ${proposal.target}.`,
      },
    ];

    const rawContent = await callLLM({
      baseUrl: agent.baseUrl,
      apiKey,
      model: agent.model,
      messages,
    });

    const parsed = parseResponse(rawContent);
    if (!parsed) {
      throw new Error(`Failed to parse response from ${agent.name}: ${rawContent}`);
    }

    return parsed;
  });

  const results = await Promise.allSettled(promises);
  const updatedCache = { ...cache };

  const agentResults = results.map((result, idx) => {
    const agent = COUNCIL_ROSTER[idx];

    if (result.status === 'fulfilled') {
      const { vote, rationale } = result.value;
      // Update cache with this agent's successful response
      updatedCache[agent.name] = { vote, rationale };
      return {
        name: agent.name,
        title: agent.title,
        provider: agent.provider,
        model: agent.model,
        vote,
        rationale,
        source: 'live',
      };
    }

    // Failed or timed out — fall back to cached
    console.error(`Council agent ${agent.name} failed:`, result.reason?.message || result.reason);
    const cached = cache[agent.name];
    if (cached) {
      return {
        name: agent.name,
        title: agent.title,
        provider: agent.provider,
        model: agent.model,
        vote: cached.vote,
        rationale: cached.rationale,
        source: 'cached',
      };
    }

    // No cache available either — hard failure for this agent
    return {
      name: agent.name,
      title: agent.title,
      provider: agent.provider,
      model: agent.model,
      vote: 'NO',
      rationale: 'Agent unavailable, no cached fallback.',
      source: 'cached',
    };
  });

  // Persist updated cache
  try {
    writeCache(updatedCache);
  } catch (err) {
    console.error('Failed to write cache:', err);
  }

  return agentResults;
}
