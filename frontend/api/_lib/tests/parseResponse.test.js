import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseResponse } from '../parseResponse.js';

describe('parseResponse', () => {
  it('should parse valid JSON with correct shape', () => {
    const input = JSON.stringify({ vote: 'YES', rationale: 'Strong fundamentals support this.' });
    const result = parseResponse(input);
    assert.deepStrictEqual(result, { vote: 'YES', rationale: 'Strong fundamentals support this.' });
  });

  it('should parse NO vote correctly', () => {
    const input = JSON.stringify({ vote: 'NO', rationale: 'Risk too high.' });
    const result = parseResponse(input);
    assert.deepStrictEqual(result, { vote: 'NO', rationale: 'Risk too high.' });
  });

  it('should return null for invalid vote value', () => {
    const input = JSON.stringify({ vote: 'MAYBE', rationale: 'Not sure.' });
    assert.strictEqual(parseResponse(input), null);
  });

  it('should return null for lowercase vote', () => {
    const input = JSON.stringify({ vote: 'yes', rationale: 'Looks good.' });
    assert.strictEqual(parseResponse(input), null);
  });

  it('should return null for missing vote key', () => {
    const input = JSON.stringify({ rationale: 'No vote here.' });
    assert.strictEqual(parseResponse(input), null);
  });

  it('should return null for missing rationale key', () => {
    const input = JSON.stringify({ vote: 'YES' });
    assert.strictEqual(parseResponse(input), null);
  });

  it('should return null for empty rationale', () => {
    const input = JSON.stringify({ vote: 'YES', rationale: '' });
    assert.strictEqual(parseResponse(input), null);
  });

  it('should return null for rationale over 20 words', () => {
    const longRationale = Array(21).fill('word').join(' ');
    const input = JSON.stringify({ vote: 'YES', rationale: longRationale });
    assert.strictEqual(parseResponse(input), null);
  });

  it('should accept rationale of exactly 20 words', () => {
    const rationale = Array(20).fill('word').join(' ');
    const input = JSON.stringify({ vote: 'YES', rationale });
    const result = parseResponse(input);
    assert.ok(result);
    assert.strictEqual(result.vote, 'YES');
  });

  it('should return null for malformed JSON', () => {
    assert.strictEqual(parseResponse('not json at all'), null);
  });

  it('should return null for empty string', () => {
    assert.strictEqual(parseResponse(''), null);
  });

  it('should return null for null input', () => {
    assert.strictEqual(parseResponse(null), null);
  });

  it('should return null for undefined input', () => {
    assert.strictEqual(parseResponse(undefined), null);
  });

  it('should return null for numeric input', () => {
    assert.strictEqual(parseResponse(42), null);
  });

  it('should return null for JSON array', () => {
    assert.strictEqual(parseResponse('[1, 2, 3]'), null);
  });

  it('should ignore extra fields and still parse correctly', () => {
    const input = JSON.stringify({ vote: 'NO', rationale: 'Too risky.', confidence: 0.9, extra: true });
    const result = parseResponse(input);
    assert.deepStrictEqual(result, { vote: 'NO', rationale: 'Too risky.' });
  });
});
