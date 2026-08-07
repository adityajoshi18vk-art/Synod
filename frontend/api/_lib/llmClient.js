/**
 * Thin OpenAI-compatible chat completions client.
 * Handles provider-specific quirks:
 *   - Sarvam: uses `api-subscription-key` header, `reasoning_effort: null`, supports `response_format`
 *   - Groq: uses `Authorization: Bearer`, supports `response_format`
 *
 * Returns the raw message content string. Throws on network/timeout errors.
 */

const TIMEOUT_MS = 15000;

/**
 * @param {object} opts
 * @param {string} opts.baseUrl  - e.g. "https://api.sarvam.ai/v1/chat/completions"
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {Array}  opts.messages - OpenAI-format messages array
 * @returns {Promise<string>}   - The assistant's message content
 */
export async function callLLM({ baseUrl, apiKey, model, messages }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const isSarvam = baseUrl.includes('sarvam');

  // Provider-specific headers
  const headers = {
    'Content-Type': 'application/json',
  };
  if (isSarvam) {
    headers['api-subscription-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Build payload
  const payload = {
    model,
    messages,
  };

  // Sarvam: enforce JSON mode + disable Thinking Mode for speed
  if (isSarvam) {
    payload.response_format = { type: 'json_object' };
    payload.reasoning_effort = null;
  }
  
  // Groq: enforce JSON mode
  const isGroq = baseUrl.includes('groq');
  if (isGroq) {
    payload.response_format = { type: 'json_object' };
  }
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM API error ${res.status}: ${errText}`);
    }

    // ── RAW RESPONSE PROBE (audit log) ───────────────────────────
    const rawBody = await res.text();
    const provider = isSarvam ? 'Sarvam' : 'Groq';
    console.log(
      `[LLM-PROBE] ${provider} | model=${model} | HTTP ${res.status}` +
      ` | bytes=${rawBody.length}` +
      ` | raw(first 500)=${rawBody.slice(0, 500)}`
    );
    // ─────────────────────────────────────────────────────────────

    const data = JSON.parse(rawBody);
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}
