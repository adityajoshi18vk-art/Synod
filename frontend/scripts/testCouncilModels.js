/**
 * Test script: Verify all 5 AI Council models respond correctly.
 * Sends a sample proposal to each agent and validates the JSON response.
 *
 * Run: node scripts/testCouncilModels.js
 */
import * as dotenv from 'dotenv';
dotenv.config();

const TIMEOUT_MS = 20000;

const COUNCIL_ROSTER = [
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
    model: 'qwen/qwen3.6-27b',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    persona: 'You are Nova, a momentum-driven trend strategist. Favor proposals aligned with strong market trends.',
  },
  {
    name: 'Sentinel',
    title: 'Compliance Auditor',
    provider: 'Groq',
    model: 'openai/gpt-oss-20b',
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

const SAMPLE_PROPOSAL = {
  description: 'Allocate 500 USDC to expand liquidity on Uniswap V3 MON/USDC pool',
  amount: '500 USDC',
  target: '0x1234567890abcdef1234567890abcdef12345678',
};

async function callAgent(agent) {
  const apiKey = process.env[agent.envKey];
  if (!apiKey) {
    return { agent: agent.name, status: '❌ FAIL', error: `Missing env var: ${agent.envKey}` };
  }

  const isSarvam = agent.baseUrl.includes('sarvam');
  const isGroq = agent.baseUrl.includes('groq');

  const headers = { 'Content-Type': 'application/json' };
  if (isSarvam) {
    headers['api-subscription-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const payload = {
    model: agent.model,
    messages: [
      {
        role: 'system',
        content: `${agent.persona} You will receive a proposal. Respond with ONLY a JSON object: {"vote": "YES" or "NO", "rationale": "<one sentence, under 20 words>"}.`,
      },
      {
        role: 'user',
        content: `Proposal: ${SAMPLE_PROPOSAL.description}. Amount: ${SAMPLE_PROPOSAL.amount}. Target: ${SAMPLE_PROPOSAL.target}.`,
      },
    ],
  };

  if (isSarvam) {
    payload.response_format = { type: 'json_object' };
    payload.reasoning_effort = null;
  }
  if (isGroq) {
    payload.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const start = Date.now();
  try {
    const res = await fetch(agent.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const latency = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { agent: agent.name, status: '❌ FAIL', error: `HTTP ${res.status}: ${errText.slice(0, 200)}`, latency };
    }

    const rawBody = await res.text();
    const data = JSON.parse(rawBody);
    const content = data.choices?.[0]?.message?.content ?? '';

    // Parse and validate the response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { agent: agent.name, status: '⚠️ PARSE FAIL', error: `Non-JSON response: ${content.slice(0, 100)}`, latency };
    }

    if (parsed.vote !== 'YES' && parsed.vote !== 'NO') {
      return { agent: agent.name, status: '⚠️ BAD VOTE', error: `vote="${parsed.vote}"`, response: parsed, latency };
    }

    return {
      agent: agent.name,
      status: '✅ PASS',
      model: agent.model,
      provider: agent.provider,
      vote: parsed.vote,
      rationale: parsed.rationale,
      latency: `${latency}ms`,
    };
  } catch (err) {
    const latency = Date.now() - start;
    if (err.name === 'AbortError') {
      return { agent: agent.name, status: '❌ TIMEOUT', error: `Exceeded ${TIMEOUT_MS}ms`, latency };
    }
    return { agent: agent.name, status: '❌ FAIL', error: err.message, latency };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 SYNOD AI COUNCIL — MODEL API TEST');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Proposal: "${SAMPLE_PROPOSAL.description}"`);
  console.log(`  Amount:   ${SAMPLE_PROPOSAL.amount}`);
  console.log('───────────────────────────────────────────────────────────\n');

  const results = await Promise.allSettled(
    COUNCIL_ROSTER.map((agent) => callAgent(agent))
  );

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const r = result.status === 'fulfilled' ? result.value : { status: '❌ ERROR', error: result.reason };

    if (r.status === '✅ PASS') {
      passed++;
      console.log(`  ${r.status}  ${r.agent.padEnd(10)} │ ${r.provider.padEnd(10)} │ ${r.model.padEnd(26)} │ Vote: ${r.vote.padEnd(3)} │ ${r.latency.padStart(7)} │ "${r.rationale}"`);
    } else {
      failed++;
      console.log(`  ${r.status}  ${r.agent.padEnd(10)} │ Error: ${r.error}`);
    }
  }

  console.log('\n───────────────────────────────────────────────────────────');
  console.log(`  Results: ${passed}/5 passed, ${failed}/5 failed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
