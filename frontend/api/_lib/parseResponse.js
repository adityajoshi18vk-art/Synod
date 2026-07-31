/**
 * Defensive JSON parser for LLM council agent responses.
 * Validates shape: { vote: "YES"|"NO", rationale: "<string, ≤20 words>" }
 * Returns { vote, rationale } on success, null on any failure.
 */
export function parseResponse(text) {
  if (!text || typeof text !== 'string') return null;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  // Validate vote
  const vote = parsed.vote;
  if (vote !== 'YES' && vote !== 'NO') return null;

  // Validate rationale
  const rationale = parsed.rationale;
  if (!rationale || typeof rationale !== 'string') return null;

  // Check rationale word count (≤ 20 words)
  const wordCount = rationale.trim().split(/\s+/).length;
  if (wordCount > 20) return null;

  return { vote, rationale };
}
