import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Shield, TrendingUp, Cpu, ChevronDown, ChevronUp, Timer, CheckCircle, XCircle, AlertCircle, Copy, Check } from 'lucide-react';
import { COUNCIL_AGENTS, COUNCIL_KEYS } from '../lib/config';
import { privateKeyToAccount } from 'viem/accounts';

const COUNCIL_ADDRESSES = COUNCIL_KEYS.map(pk => {
  try {
    return privateKeyToAccount(pk).address.toLowerCase();
  } catch {
    return null;
  }
}).filter(Boolean);

const AGENT_ICONS = {
  Arjun: Shield,
  Nova: TrendingUp,
  Sentinel: Shield,
  Cipher: Cpu,
  Oracle: Brain,
};

export default function MissionControlPanel({ 
  activeProposal, 
  liveYesWeight, 
  liveNoWeight, 
  councilMeta, 
  councilLoading, 
  councilError, 
  events,
  isSimulating 
}) {
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [commitTime, setCommitTime] = useState(0);
  const [revealTime, setRevealTime] = useState(0);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [timerActive, setTimerActive] = useState(false);

  const isPending = activeProposal && Number(activeProposal.status) === 0;
  
  // Latch timer on when simulation starts — stays active through the full commit→reveal cycle
  useEffect(() => {
    if (isSimulating && !timerActive) {
      setTimerActive(true);
    }
  }, [isSimulating, timerActive]);

  // Reset timer latch when proposal status changes away from Pending
  useEffect(() => {
    if (activeProposal && Number(activeProposal.status) !== 0) {
      setTimerActive(false);
      setCommitTime(0);
      setRevealTime(0);
    }
  }, [activeProposal?.status]);

  // On-Chain Timers — only count down when timer is active
  useEffect(() => {
    if (!activeProposal || !timerActive) {
      if (!timerActive) {
        setCommitTime(0);
        setRevealTime(0);
      }
      return;
    }

    const updateTimers = () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const cDeadline = Number(activeProposal.commitDeadline || 0);
        const rDeadline = Number(activeProposal.revealDeadline || 0);
        
        if (!cDeadline || !rDeadline) {
          setCommitTime(0);
          setRevealTime(0);
          return;
        }
        
        const cRemaining = Math.max(0, cDeadline - now);
        const rRemaining = Math.max(0, rDeadline - now);
        
        setCommitTime(cRemaining);
        setRevealTime(cRemaining > 0 ? 0 : rRemaining); // Reveal only starts after commit ends
      } catch (err) {
        console.error('[MissionControl] Timer error:', err);
        setCommitTime(0);
        setRevealTime(0);
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [activeProposal, timerActive]);

  const handleCopy = (address) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const revealedOnChain = new Set();
  if (events) {
    events.forEach(ev => {
      try {
        if (ev.type === 'VoteRevealed' && ev.voter) {
          const voterAddr = String(ev.voter).toLowerCase();
          if (COUNCIL_ADDRESSES.includes(voterAddr)) {
            revealedOnChain.add(voterAddr);
          }
        }
      } catch { /* skip malformed event */ }
    });
  }

  const getAgentAddress = (idx) => COUNCIL_ADDRESSES[idx] || null;
  const quorumThreshold = activeProposal ? Number(activeProposal.quorumThreshold) : 1000;
  const yesW = Number(liveYesWeight || 0);
  const noW = Number(liveNoWeight || 0);
  const totalW = yesW + noW;
  const maxW = Math.max(quorumThreshold * 1.5, totalW); // Scale for the bar

  const yesPercent = maxW > 0 ? (yesW / maxW) * 100 : 0;
  const noPercent = maxW > 0 ? (noW / maxW) * 100 : 0;
  const thresholdPercent = maxW > 0 ? (quorumThreshold / maxW) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. Live Quorum Voting Bar */}
      <div className="backdrop-blur-md bg-[#111116]/80 rounded-2xl border border-white/10 p-6 shadow-[0_0_30px_rgba(139,92,246,0.05)] relative overflow-hidden">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ActivityIcon /> Live Quorum Weight
          </span>
          <span className="text-purple-400 font-mono text-xs">Threshold: {quorumThreshold}</span>
        </h3>
        
        <div className="relative w-full h-8 bg-black/50 rounded-lg border border-white/5 overflow-hidden flex">
          {/* YES Bar */}
          <div 
            className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-700 ease-out flex items-center px-2 shadow-[0_0_15px_rgba(34,197,94,0.4)]"
            style={{ width: `${yesPercent}%` }}
          >
            {yesPercent > 10 && <span className="text-[10px] font-bold text-black font-mono">{yesW}</span>}
          </div>
          
          {/* NO Bar */}
          <div 
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-700 ease-out flex items-center px-2 justify-end shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            style={{ width: `${noPercent}%` }}
          >
            {noPercent > 10 && <span className="text-[10px] font-bold text-black font-mono">{noW}</span>}
          </div>
          
          {/* Threshold Marker */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-purple-500 shadow-[0_0_10px_rgba(139,92,246,1)] z-10"
            style={{ left: `${thresholdPercent}%` }}
          />
        </div>
        
        <div className="flex justify-between mt-3 text-xs font-mono text-gray-500">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>YES ({yesW})</div>
          <div className="flex items-center gap-2">NO ({noW})<div className="w-2 h-2 rounded-full bg-red-500"></div></div>
        </div>
      </div>

      {/* Main Council Roster Panel */}
      <div className="backdrop-blur-md bg-[#111116]/80 rounded-2xl border border-white/10 p-6 shadow-[0_0_30px_rgba(139,92,246,0.05)] relative overflow-hidden">
        
        {/* Header & Timers */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-white/10 pb-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Brain size={16} className="text-purple-500" /> AI Council Roster
          </h2>
          
          <div className="flex gap-4">
            <div className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border ${commitTime > 0 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-white/5 border-white/10 text-gray-500'}`}>
              <Timer size={14} className={commitTime > 0 ? 'animate-pulse' : ''} />
              Commit: {commitTime}s
            </div>
            <div className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border ${(commitTime === 0 && revealTime > 0) ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-500'}`}>
              <Timer size={14} className={(commitTime === 0 && revealTime > 0) ? 'animate-pulse' : ''} />
              Reveal: {revealTime}s
            </div>
          </div>
        </div>

        {councilError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={16} /> Council error: {councilError}
          </div>
        )}

        {/* Loading Skeleton */}
        {councilLoading && !councilMeta && (
          <div className="space-y-4">
            {COUNCIL_AGENTS.map((agent, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-1/4" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Idle State */}
        {!councilLoading && !councilMeta && !councilError && (
          <div className="text-center py-12 text-gray-500 text-sm">
            <Brain size={32} className="mx-auto mb-4 text-purple-500/30" />
            Agents are standing by. Trigger demo swarm to evaluate proposal.
          </div>
        )}

        {/* Council Agents List */}
        {councilMeta && (
          <div className="space-y-4">
            <AnimatePresence>
              {councilMeta.map((agent, idx) => {
                const IconComponent = AGENT_ICONS[agent.name] || Brain;
                const isYes = agent.vote === 'YES';
                const address = getAgentAddress(idx);
                const isOnChain = address ? revealedOnChain.has(address) : false;
                const truncAddress = address ? `${address.slice(0,6)}...${address.slice(-4)}` : '';
                const isExpanded = expandedAgent === agent.name;

                return (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.1 }}
                    className="flex flex-col bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/30 transition-colors"
                  >
                    {/* Main Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4 cursor-pointer" onClick={() => setExpandedAgent(isExpanded ? null : agent.name)}>
                      
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                        isYes ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>
                        <IconComponent size={24} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-base">{agent.name}</span>
                          <span className="text-xs text-gray-400 hidden sm:inline">— {agent.title}</span>
                          <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider rounded border border-white/10 bg-black text-gray-300 flex items-center gap-1.5">
                            <span className="uppercase">{agent.provider}</span>
                            {agent.model && <span className="text-gray-500 border-l border-white/10 pl-1.5">{agent.model}</span>}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                          <div 
                            className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleCopy(address); }}
                          >
                            {copiedAddress === address ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            {truncAddress}
                          </div>
                          <span>|</span>
                          <span className="text-purple-400/80">EMA: 890</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                        {/* Vote Badge */}
                        <div className="flex flex-col items-end gap-1">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                            isYes ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                          }`}>
                            {isYes ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {isYes ? 'APPROVED (YES)' : 'REJECTED (NO)'}
                          </div>
                          
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            {isOnChain ? (
                              <span className="text-green-400">● On-chain</span>
                            ) : (
                              <span className="text-yellow-500 animate-pulse">● Pending tx</span>
                            )}
                          </div>
                        </div>

                        {/* Accordion Toggle */}
                        <div className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Reasoning Drawer (Accordion) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-white/5 bg-black/40"
                        >
                          <div className="p-4 sm:p-6 text-sm text-gray-300 font-mono">
                            <div className="flex items-center gap-2 mb-3 text-purple-400 text-xs">
                              <TerminalIcon /> {agent.name.toLowerCase()}@synod:~$ cat reasoning.log
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-gray-400 pl-4 border-l-2 border-purple-500/30">
                              {agent.rationale}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// Helpers
function ActivityIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
