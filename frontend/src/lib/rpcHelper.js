export const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Wraps an async function with exponential backoff retries.
 * Useful for rate-limited RPC calls (429s).
 * @param {Function} fn - The async function to execute.
 * @param {number} maxRetries - Maximum number of retries (default 3).
 * @param {number} baseDelayMs - Base delay in ms for the first retry (default 500).
 * @returns {Promise<any>}
 */
export async function withBackoff(fn, maxRetries = 3, baseDelayMs = 500) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries) {
        throw err;
      }
      
      const isRateLimit = err.message?.includes('429') || err.message?.includes('Too Many Requests') || err.message?.includes('rate limit');
      const isTimeout = err.message?.includes('Timeout') || err.message?.includes('socket hang up') || err.message?.includes('fetch failed');
      
      // We generally want to retry on timeouts or rate limits
      if (!isRateLimit && !isTimeout && err.name !== 'HttpRequestError') {
        // If it's a completely unrelated error (e.g. contract revert), don't retry, just throw
        // However, generic viem errors sometimes obscure the 429, so we err on the side of retrying
      }
      
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[RPC Backoff] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delayMs}ms... Error: ${err.shortMessage || err.message}`);
      
      await delay(delayMs);
      attempt++;
    }
  }
}
