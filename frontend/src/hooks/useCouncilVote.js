import { useState, useCallback } from 'react';
import { formatEther } from 'viem';

/**
 * Hook to manage the Council vote lifecycle:
 *   1. Call /api/council/vote to get LLM decisions
 *   2. Return decisions so the caller (Dashboard) can pass them
 *      into the unified triggerDemoSwarm pipeline for on-chain commit/reveal.
 *
 * Council agent vote data itself comes from the event feed (useSynodEvents).
 * This hook manages the source tags (live/cached) and loading state.
 */
export function useCouncilVote() {
  const [councilMeta, setCouncilMeta] = useState(null); // Array of { name, source }
  const [councilLoading, setCouncilLoading] = useState(false);
  const [councilError, setCouncilError] = useState(null);

  const triggerCouncilVote = useCallback(async (activeProposal) => {
    setCouncilLoading(true);
    setCouncilError(null);

    try {
      // 1. Call serverless function for LLM decisions
      let agents = [];
      try {
        const res = await fetch('/api/council/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: activeProposal.description,
            amount: formatEther(activeProposal.amount),
            target: activeProposal.target,
          }),
        });

        if (!res.ok) {
          throw new Error(`Council API error: ${res.status}`);
        }
        
        const data = await res.json();
        agents = data.agents;
      } catch (fetchErr) {
        console.warn('API fetch failed, falling back to mock council decisions:', fetchErr);
        // Fallback mock data
        agents = [
          { name: 'Arjun', title: 'Risk Assessor', provider: 'Sarvam AI', model: 'sarvam-105b', vote: 'YES', rationale: 'Risk assessment indicates favorable market conditions for this trade.', source: 'offline-fallback' },
          { name: 'Nova', title: 'Trend Strategist', provider: 'Groq', model: 'llama-3.3-70b', vote: 'YES', rationale: 'Technical indicators align with the proposed action. Consensus is strong.', source: 'offline-fallback' },
          { name: 'Sentinel', title: 'Compliance Auditor', provider: 'Groq', model: 'llama-3.3-70b', vote: 'NO', rationale: 'Current market conditions present elevated risk. Recommending caution.', source: 'offline-fallback' },
          { name: 'Cipher', title: 'Quant Analyst', provider: 'Groq', model: 'llama-3.3-70b', vote: 'YES', rationale: 'Historical patterns support this decision. Proceeding with confidence.', source: 'offline-fallback' },
          { name: 'Oracle', title: 'Macro Economist', provider: 'Groq', model: 'llama-3.3-70b', vote: 'NO', rationale: 'Timing misalignment detected. Suggesting deferral of this action.', source: 'offline-fallback' }
        ];
      }

      // Store source metadata for badge display
      setCouncilMeta(agents.map(a => ({
        name: a.name,
        title: a.title,
        provider: a.provider,
        model: a.model,
        vote: a.vote,
        rationale: a.rationale,
        source: a.source,
      })));

      return agents;

    } catch (err) {
      console.error('Council vote failed:', err);
      setCouncilError(err.message);
    } finally {
      setCouncilLoading(false);
    }
  }, []);

  return { councilMeta, councilLoading, councilError, triggerCouncilVote };
}
