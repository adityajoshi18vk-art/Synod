import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Cpu, Zap, Shield, TrendingUp } from 'lucide-react';
import { COUNCIL_AGENTS, COUNCIL_KEYS } from '../lib/config';
import { privateKeyToAccount } from 'viem/accounts';

// Derive council agent addresses for matching against event feed
const COUNCIL_ADDRESSES = COUNCIL_KEYS.map(pk => {
  try {
    return privateKeyToAccount(pk).address.toLowerCase();
  } catch {
    return null;
  }
}).filter(Boolean);

// Icon per agent for visual variety
const AGENT_ICONS = {
  Arjun: Shield,
  Nova: TrendingUp,
  Sentinel: Shield,
  Cipher: Cpu,
  Oracle: Brain,
};

/**
 * CouncilPanel — displays the 5 LLM-backed Council agents' votes.
 *
 * Reads from two sources:
 * - councilMeta: LLM decisions + source tags (from useCouncilVote)
 * - events: live event feed (from useSynodEvents) for on-chain confirmation
 *
 * Shows councilMeta data (vote, rationale, source badge) immediately after
 * LLM response. On-chain VoteRevealed events provide confirmation.
 */
export default function CouncilPanel({ councilMeta, councilLoading, councilError, events }) {
  // Find on-chain revealed votes for council agents
  const revealedOnChain = new Set();
  if (events) {
    events.forEach(ev => {
      if (ev.type === 'VoteRevealed' && ev.voter) {
        if (COUNCIL_ADDRESSES.includes(ev.voter.toLowerCase())) {
          revealedOnChain.add(ev.voter.toLowerCase());
        }
      }
    });
  }

  // Get the on-chain address for a council agent by index
  const getAgentAddress = (idx) => COUNCIL_ADDRESSES[idx] || null;

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-xl relative overflow-hidden">
      {/* Accent bar */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-monad via-purple-400 to-blue-500" />

      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
        <Brain size={16} className="text-monad" />
        AI Council
        <span className="text-xs font-normal text-gray-600 ml-1">
          — 5 independent risk reviewers
        </span>
      </h2>

      {/* Error state */}
      {councilError && (
        <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error">
          Council error: {councilError}
        </div>
      )}

      {/* Loading skeleton */}
      {councilLoading && !councilMeta && (
        <div className="space-y-3">
          {COUNCIL_AGENTS.map((agent, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 bg-black/40 border border-border rounded-xl animate-pulse">
              <div className="w-10 h-10 rounded-full bg-border" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-border rounded w-32" />
                <div className="h-3 bg-border rounded w-48" />
              </div>
              <div className="w-12 h-6 bg-border rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Idle state */}
      {!councilLoading && !councilMeta && !councilError && (
        <div className="text-center py-8 text-gray-500 text-sm">
          <Zap size={24} className="mx-auto mb-3 text-gray-600" />
          Council agents await a proposal trigger.
        </div>
      )}

      {/* Results */}
      {councilMeta && (
        <AnimatePresence>
          <div className="space-y-3">
            {councilMeta.map((agent, idx) => {
              const IconComponent = AGENT_ICONS[agent.name] || Brain;
              const isYes = agent.vote === 'YES';
              const address = getAgentAddress(idx);
              const isOnChain = address ? revealedOnChain.has(address) : false;

              return (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className="flex items-start gap-4 p-4 bg-black/40 border border-border rounded-xl hover:border-monad/30 transition-colors"
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isYes ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                  }`}>
                    <IconComponent size={18} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-white text-sm">{agent.name}</span>
                      <span className="text-xs text-gray-500">— {agent.title}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-monad/15 text-monad-light font-mono">
                        {agent.provider}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 italic truncate" title={agent.rationale}>
                      "{agent.rationale}"
                    </p>
                  </div>

                  {/* Vote + badges */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${
                      isYes
                        ? 'bg-success/20 text-success border border-success/30'
                        : 'bg-error/20 text-error border border-error/30'
                    }`}>
                      {agent.vote}
                    </span>
                    <div className="flex gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        agent.source === 'live'
                          ? 'bg-success/10 text-success/80'
                          : agent.source === 'offline-fallback'
                            ? 'bg-error/10 text-error/80'
                            : 'bg-pending/10 text-pending/80'
                      }`}>
                        {agent.source === 'live' ? '● live' : agent.source === 'offline-fallback' ? '⊘ offline' : '○ cached'}
                      </span>
                      {isOnChain && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-monad/10 text-monad-light">
                          on-chain ✓
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Loading overlay when re-running */}
      {councilLoading && councilMeta && (
        <div className="absolute inset-0 bg-card/80 flex items-center justify-center rounded-2xl">
          <div className="flex items-center gap-2 text-monad text-sm">
            <Zap size={16} className="animate-pulse" />
            Querying council...
          </div>
        </div>
      )}
    </div>
  );
}
