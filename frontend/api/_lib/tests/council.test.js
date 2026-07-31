import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// We test runCouncilVote by mocking fetch and env vars.
// Import after mocking so the module picks up our mocks.

describe('runCouncilVote', () => {
  let originalFetch;
  let originalEnv;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalEnv = { ...process.env };
    // Set required env vars
    process.env.SARVAM_API_KEY = 'test-sarvam-key';
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.USE_CACHED_LLM = 'false';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  function mockFetchSuccess(vote = 'YES', rationale = 'Looks good.') {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ vote, rationale }) } }],
      }),
    });
  }

  function mockFetchPerAgent(responses) {
    let callIndex = 0;
    globalThis.fetch = async () => {
      const response = responses[callIndex++];
      if (response.error) throw new Error(response.error);
      if (response.timeout) {
        // Simulate a timeout via AbortError
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: response.content } }],
        }),
      };
    };
  }

  it('should return 5 live results when all agents succeed', async () => {
    mockFetchSuccess('YES', 'Strong proposal.');

    const { runCouncilVote } = await import('../council.js');
    const results = await runCouncilVote({
      description: 'Test proposal',
      amount: '0.001',
      target: '0x1234',
    });

    assert.strictEqual(results.length, 5);
    results.forEach(r => {
      assert.strictEqual(r.source, 'live');
      assert.strictEqual(r.vote, 'YES');
      assert.strictEqual(r.rationale, 'Strong proposal.');
    });
  });

  it('should fall back to cached when an agent returns malformed JSON', async () => {
    // Agent 0 (Sarvam/Arjun) returns malformed, others succeed
    mockFetchPerAgent([
      { content: 'not valid json' },           // Arjun - will fail parse
      { content: '{"vote":"NO","rationale":"Bad timing."}' },  // Nova
      { content: '{"vote":"YES","rationale":"Compliant."}' },  // Sentinel
      { content: '{"vote":"YES","rationale":"Numbers check out."}' }, // Cipher
      { content: '{"vote":"NO","rationale":"Macro headwinds."}' },   // Oracle
    ]);

    const { runCouncilVote } = await import('../council.js');
    const results = await runCouncilVote({
      description: 'Test proposal',
      amount: '0.001',
      target: '0x1234',
    });

    assert.strictEqual(results.length, 5);
    // Arjun should have fallen back (source: 'cached')
    assert.strictEqual(results[0].source, 'cached');
    assert.strictEqual(results[0].name, 'Arjun');
    // Others should be live
    assert.strictEqual(results[1].source, 'live');
    assert.strictEqual(results[2].source, 'live');
    assert.strictEqual(results[3].source, 'live');
    assert.strictEqual(results[4].source, 'live');
  });

  it('should fall back to cached when an agent network fails', async () => {
    mockFetchPerAgent([
      { error: 'Network error' },   // Arjun fails
      { content: '{"vote":"YES","rationale":"Good."}' },
      { content: '{"vote":"YES","rationale":"Good."}' },
      { content: '{"vote":"YES","rationale":"Good."}' },
      { content: '{"vote":"YES","rationale":"Good."}' },
    ]);

    const { runCouncilVote } = await import('../council.js');
    const results = await runCouncilVote({
      description: 'Test',
      amount: '0.001',
      target: '0x1234',
    });

    assert.strictEqual(results[0].source, 'cached');
    assert.strictEqual(results[0].name, 'Arjun');
    for (let i = 1; i < 5; i++) {
      assert.strictEqual(results[i].source, 'live');
    }
  });

  it('should return all cached when USE_CACHED_LLM=true', async () => {
    process.env.USE_CACHED_LLM = 'true';
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) };
    };

    const { runCouncilVote } = await import('../council.js');
    const results = await runCouncilVote({
      description: 'Test',
      amount: '0.001',
      target: '0x1234',
    });

    assert.strictEqual(fetchCalled, false, 'fetch should not be called in cached mode');
    assert.strictEqual(results.length, 5);
    results.forEach(r => {
      assert.strictEqual(r.source, 'cached');
    });
  });

  it('should use cached source when agent fails and cache exists from prior run', async () => {
    mockFetchPerAgent([
      { error: 'Timeout' },
      { content: '{"vote":"YES","rationale":"Good."}' },
      { content: '{"vote":"YES","rationale":"Good."}' },
      { content: '{"vote":"YES","rationale":"Good."}' },
      { content: '{"vote":"YES","rationale":"Good."}' },
    ]);

    const { runCouncilVote } = await import('../council.js');
    const results = await runCouncilVote({
      description: 'Test',
      amount: '0.001',
      target: '0x1234',
    });

    // Arjun failed — should fall back to cached (from earlier test runs)
    assert.strictEqual(results[0].source, 'cached');
    assert.strictEqual(results[0].name, 'Arjun');
    // Vote and rationale should be defined (from cache or fallback)
    assert.ok(results[0].vote === 'YES' || results[0].vote === 'NO');
    assert.ok(typeof results[0].rationale === 'string' && results[0].rationale.length > 0);
  });
});
