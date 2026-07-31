import { runCouncilVote } from '../_lib/council.js';

/**
 * POST /api/council/vote
 * Body: { description: string, amount: string, target: string }
 * Returns: { agents: [...] }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { description, amount, target } = req.body;

    if (!description || !amount || !target) {
      return res.status(400).json({ error: 'Missing required fields: description, amount, target' });
    }

    const agents = await runCouncilVote({ description, amount, target });

    return res.status(200).json({ agents });
  } catch (err) {
    console.error('Council vote error:', err);
    return res.status(500).json({ error: 'Council vote failed', detail: err.message });
  }
}
