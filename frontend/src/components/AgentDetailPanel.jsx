import React, { useState, useEffect } from 'react';
import { Brain, Clock, ChevronDown, Activity, ActivitySquare, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AgentDetailPanel({ leaderboard = [] }) {
  const [logs, setLogs] = useState([]);

  // Find Arjun's on-chain data from leaderboard (match by label containing "Arjun")
  const arjunData = leaderboard.find(a => a.label && a.label.includes('Arjun'));

  // Derive live metrics with safe fallbacks to mock values
  const reputation = arjunData?.reputation ?? 744;
  const totalVotes = arjunData?.totalVotes ?? 450;
  const correctVotes = arjunData?.correctVotes ?? 435;
  const address = arjunData?.address ?? '0xFe76...';

  const successRate = totalVotes > 0
    ? ((correctVotes / totalVotes) * 100).toFixed(1)
    : '98.2';
  const dissentCount = totalVotes - correctVotes;
  const dissentRatio = totalVotes > 0
    ? ((dissentCount / totalVotes) * 100).toFixed(1)
    : '3.3';

  // Determine reputation tier based on score (0-1000 scale)
  const getTier = (score) => {
    if (score >= 700) return 'Top-Tier';
    if (score >= 400) return 'Mid-Tier';
    return 'Low-Tier';
  };
  const tier = getTier(reputation);
  const truncAddr = arjunData
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '0xFe76...';

  // Mock live execution feed
  useEffect(() => {
    const mockEvents = [
      { agent: '#3 (Oracle)', action: 'Refreshed global macro data stream' },
      { agent: '#1 (Arjun)', action: 'Validating on-chain liquidity depth (ETH/USDC)' },
      { agent: '#2 (Sentinel)', action: 'Checking smart contract risk parameters' },
      { agent: '#7 (Demo 2)', action: 'Simulated trade impact model' },
      { agent: '#5 (Nova)', action: 'Aggregated trend sentiment data' },
      { agent: 'Consensus Monitor', action: 'Forming preliminary multi-agent agreement' },
    ];
    
    let currentIndex = 0;
    
    // Add first 3 immediately
    setLogs(mockEvents.slice(0, 3).map(ev => ({
      ...ev,
      time: new Date(Date.now() - Math.random() * 10000).toLocaleTimeString([], { hour12: false }),
      id: Math.random()
    })));
    currentIndex = 3;

    const interval = setInterval(() => {
      if (currentIndex < mockEvents.length) {
        setLogs(prev => [
          {
            ...mockEvents[currentIndex],
            time: new Date().toLocaleTimeString([], { hour12: false }),
            id: Math.random()
          },
          ...prev
        ]);
        currentIndex++;
      } else {
        // Reset or add generic ping
        setLogs(prev => [
          {
            agent: 'System',
            action: 'Heartbeat ping...',
            time: new Date().toLocaleTimeString([], { hour12: false }),
            id: Math.random()
          },
          ...prev
        ].slice(0, 8)); // keep max 8
      }
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6 h-full">
      
      {/* Upper Card: Agent Profile */}
      <div className="backdrop-blur-md bg-[#111116] rounded-2xl border border-purple-500/20 p-5 shadow-[0_0_30px_rgba(139,92,246,0.05)] relative overflow-hidden flex flex-col">
        {/* Glow effect behind */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/10 rounded-full blur-[40px] pointer-events-none"></div>

        <div className="flex justify-between items-start mb-5">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Brain size={16} className="text-purple-400" />
            Agent Profile — Arjun <span className="font-mono text-xs text-gray-500 font-normal">({truncAddr})</span>
          </h3>
          <div className="flex items-center gap-1 text-xs text-gray-400 bg-white/5 border border-white/10 px-2 py-1 rounded-md cursor-pointer hover:bg-white/10 transition-colors">
            24 Hrs <ChevronDown size={12} />
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border border-purple-500/30 flex items-center justify-center bg-purple-500/10 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
              <ActivitySquare size={20} className="text-purple-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#111116] rounded-full animate-pulse"></div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Reputation Tier</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              {tier} <span className="text-purple-400 font-mono">({reputation})</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-black/30 rounded-lg p-3 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Avg. Success</div>
            <div className="text-sm font-mono text-green-400">{successRate}%</div>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Dissent Ratio</div>
            <div className="text-sm font-mono text-purple-400">{dissentCount}/{totalVotes} ({dissentRatio}%)</div>
          </div>
        </div>

        {/* Mock Performance Graph */}
        <div className="h-16 w-full mb-4 relative flex items-end gap-1">
          {/* Simple CSS bars for mock graph */}
          {[40, 60, 50, 80, 70, 90, 85, 95, 100].map((h, i) => (
            <div key={i} className="flex-1 bg-purple-500/20 rounded-t-sm hover:bg-purple-500/40 transition-colors" style={{ height: `${h}%` }}>
              <div className="w-full h-0.5 bg-purple-400 absolute bottom-0 left-0"></div>
            </div>
          ))}
          <div className="absolute top-2 left-2 text-[10px] text-gray-500">Consensus Rate (30d)</div>
        </div>

        <div className="mt-auto pt-3 border-t border-white/10 text-xs text-gray-400">
          <span className="text-gray-500">Last Dissent:</span> <span className="italic">"Liquidity Depth Insufficient (ETH/USDC)"</span>
        </div>
      </div>

      {/* Lower Card: Live Multi-Agent Execution Feed */}
      <div className="backdrop-blur-md bg-[#111116] rounded-2xl border border-white/10 p-5 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex-1 flex flex-col min-h-[220px]">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
          <Clock size={16} className="text-monad" />
          Live Execution Feed
        </h3>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            <AnimatePresence>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="text-[11px] font-mono leading-relaxed"
                >
                  <span className="text-gray-600 mr-2">[{log.time}]</span>
                  <span className={`font-semibold mr-2 ${log.agent?.includes('#1') || log.agent?.includes('#3') ? 'text-purple-400' : 'text-gray-400'}`}>
                    {log.agent}
                  </span>
                  <span className="text-gray-300">{log.action}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

    </div>
  );
}
