import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Activity, Settings, Play, Users } from 'lucide-react';
import { formatEther } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { useSynodEvents } from '../hooks/useSynodEvents';
import { triggerDemoSwarm, autoResolveProposal } from '../lib/simulator';
import { useCouncilVote } from '../hooks/useCouncilVote';
import CouncilPanel from '../components/CouncilPanel';
import ErrorBanner from '../components/ErrorBanner';
import { publicClient, ADDRESSES, CANONICAL_AGENT_ADDRESSES } from '../lib/config';
import { REGISTRY_ABI } from '../lib/abis';
import { withBackoff } from '../lib/rpcHelper';

export default function Dashboard() {
  const navigate = useNavigate();
  const { events, activeProposal, rpcError, retry } = useSynodEvents();
  const { councilMeta, councilLoading, councilError, triggerCouncilVote } = useCouncilVote();
  const [isSimulating, setIsSimulating] = useState(false);
  const [swarmError, setSwarmError] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardError, setLeaderboardError] = useState(null);

  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true);

  const liveYesWeight = useMemo(() => {
    if (!activeProposal) return 0n;
    let base = BigInt(activeProposal.yesWeight || 0);
    let eventSum = 0n;
    const seen = new Set();
    
    // Aggregate yes weights from local events (VoteRevealed with choice === true)
    for (const ev of events) {
      if (ev.type === 'VoteRevealed' && ev.choice === true && !seen.has(ev.voter)) {
        eventSum += BigInt(ev.weight);
        seen.add(ev.voter);
      }
    }
    
    return base > eventSum ? base : eventSum;
  }, [activeProposal, events]);

  const fetchLeaderboard = async () => {
    setIsLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const count = await withBackoff(() => publicClient.readContract({
        address: ADDRESSES.registry,
        abi: REGISTRY_ABI,
        functionName: 'getAgentCount',
      }));

      // 1. Multicall to get all agent addresses
      const listCalls = [];
      for (let i = 0; i < count; i++) {
        listCalls.push({
          address: ADDRESSES.registry,
          abi: REGISTRY_ABI,
          functionName: 'agentList',
          args: [BigInt(i)]
        });
      }
      const agentAddrsResult = await withBackoff(() => publicClient.multicall({
        contracts: listCalls,
        allowFailure: true
      }));
      const agentAddrs = agentAddrsResult
        .filter(r => r.status === 'success')
        .map(r => r.result);

      // 2. Multicall to get agent details from the public `agents` mapping
      const dataCalls = [];
      for (const addr of agentAddrs) {
        dataCalls.push({ address: ADDRESSES.registry, abi: REGISTRY_ABI, functionName: 'agents', args: [addr] });
      }
      const dataResults = await withBackoff(() => publicClient.multicall({
        contracts: dataCalls,
        allowFailure: true
      }));

      // 3. Assemble results
      const results = [];
      for (let i = 0; i < agentAddrs.length; i++) {
        const agentResult = dataResults[i];
        
        if (agentResult.status === 'success') {
          const [isRegistered, label, reputationScore, totalVotes, correctVotes] = agentResult.result;
          results.push({
            address: agentAddrs[i],
            reputation: Number(reputationScore),
            label: label || 'Unknown'
          });
        }
      }

      results.sort((a, b) => b.reputation - a.reputation);
      // Display-only filter: only show the 10 canonical agents (5 burner + 5 council).
      // Orphaned/duplicate registry entries are excluded without any on-chain changes.
      setLeaderboard(results.filter(a => CANONICAL_AGENT_ADDRESSES.has(a.address.toLowerCase())));
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      setLeaderboardError("Failed to fetch agents. Rate limit exceeded.");
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [activeProposal?.status]); // Refresh when proposal status changes (like when resolved)

  useEffect(() => {
    if (!activeProposal || Number(activeProposal.status) !== 0) return;

    let timeoutId;
    const now = Date.now();
    const revealDeadlineMs = Number(activeProposal.revealDeadline) * 1000;
    
    if (now > revealDeadlineMs) {
      // Deadline passed before page loaded or just now
      autoResolveProposal(activeProposal.id).catch(console.error);
    } else {
      // Set timer to trigger right when deadline hits
      timeoutId = setTimeout(() => {
        autoResolveProposal(activeProposal.id).catch(console.error);
      }, revealDeadlineMs - now + 2000); // 2 second buffer
    }

    return () => clearTimeout(timeoutId);
  }, [activeProposal]);

  const handleSimulate = async (e) => {
    e?.preventDefault();
    if (!activeProposal || Number(activeProposal.status) !== 0) return; // Must be Pending (0)
    setIsSimulating(true);
    setSwarmError(null);
    console.log("🚀 [Demo] Trigger Demo Swarm clicked!");
    
    try {
      console.log("🧠 [Demo] Fetching AI Council decisions...");
      
      // 1. Await the LLM API call FIRST
      const councilDecisions = await triggerCouncilVote(activeProposal);
      
      console.log("⚡ [Demo] Submitting all on-chain transactions (unified swarm + council)...");
      
      // 2. Run the unified commit → reveal → tally pipeline
      //    Council decisions are passed in so both burner and council agents
      //    share the same on-chain commit/reveal windows.
      await triggerDemoSwarm(activeProposal.id.toString(), councilDecisions);
      
      console.log("✅ [Demo] All Swarm and Council transactions completed!");
      
    } catch (err) {
      console.error("💥 [Fatal Demo Error]:", err);
      setSwarmError(err.message || "Simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (Number(status)) {
      case 0: return <span className="px-3 py-1 bg-pending/20 text-pending rounded-full text-sm font-medium border border-pending/30">Pending</span>;
      case 1: return (
        <span className="px-3 py-1 bg-success/20 text-success rounded-full text-sm font-medium border border-success/30 flex items-center gap-1">
          Consensus reached — trade executed
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.escrow}`} target="_blank" rel="noreferrer" className="underline ml-1 opacity-80 hover:opacity-100">Tx</a>
        </span>
      );
      case 2: return <span className="px-3 py-1 bg-error/20 text-error rounded-full text-sm font-medium border border-error/30">Quorum not reached — trade blocked, funds returned</span>;
      case 3: return <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium border border-blue-500/30">Executed</span>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-bg p-6 text-gray-200 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex items-center justify-between mb-8 border-b border-border pb-6">
        <div className="flex items-center gap-3" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <ShieldCheck className="text-monad" size={32} />
          <h1 className="text-2xl font-bold tracking-tight">Synod Mission Control</h1>
        </div>
        <button 
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-border border border-border rounded-lg transition-colors text-sm"
        >
          <Settings size={16} /> Admin Panel
        </button>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <ErrorBanner error={rpcError} onRetry={retry} />

          {/* Active Proposal Card */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 bg-monad h-full" />
            
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity size={16} className="text-monad" /> Trade Under Review
            </h2>

            {activeProposal ? (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{activeProposal.description}</h3>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>Amount: <strong className="text-white">{formatEther(activeProposal.amount)} MON</strong></span>
                      <span>Target: <span className="font-mono text-xs bg-black/50 px-2 py-1 rounded">{activeProposal.target}</span></span>
                    </div>
                  </div>
                  {getStatusBadge(activeProposal.status)}
                </div>

                {Number(activeProposal.status) === 0 && (
                  <div className="pt-4 border-t border-border flex flex-col gap-4">
                    {swarmError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                        {swarmError}
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-400">Awaiting agent consensus...</p>
                      <button 
                        type="button"
                        onClick={handleSimulate}
                        disabled={isSimulating}
                        className="flex items-center gap-2 px-6 py-3 bg-monad hover:bg-monad-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-[0_0_20px_rgba(138,43,226,0.2)]"
                      >
                        {isSimulating ? <Activity size={18} className="animate-spin" /> : <Play size={18} />}
                        {isSimulating ? 'Agents Running...' : 'Trigger Demo Swarm'}
                      </button>
                    </div>
                  </div>
                )}
                
                {Number(activeProposal.status) !== 0 && (
                  <div className="pt-4 border-t border-border">
                    <button 
                      onClick={() => navigate(`/proposal/${activeProposal.id}`)}
                      className="text-monad hover:text-monad-light text-sm font-medium underline underline-offset-4"
                    >
                      View Full Details & Tx Receipts →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-4">No active proposals found.</p>
                <button 
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 bg-border hover:bg-gray-700 rounded-md text-white transition-colors"
                >
                  Create Proposal
                </button>
              </div>
            )}
          </div>

          {/* Council Panel — LLM-backed agents */}
          <CouncilPanel
            councilMeta={councilMeta}
            councilLoading={councilLoading}
            councilError={councilError}
            events={events}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quorum Progress */}
            {activeProposal && (
              <div className="bg-card rounded-2xl border border-border p-6 shadow-xl">
                <h3 className="text-lg font-semibold mb-4 text-white">Risk Committee Threshold</h3>
                <div className="w-full bg-black rounded-full h-6 relative overflow-hidden border border-border">
                  <div 
                    className="absolute top-0 left-0 h-full bg-success transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, (Number(liveYesWeight) / Number(activeProposal.quorumThreshold)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm text-gray-400">
                  <span>0</span>
                  <span>{liveYesWeight.toString()} / {activeProposal.quorumThreshold.toString()} Weight</span>
                </div>
              </div>
            )}

            {/* Agent Leaderboard */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                <Users size={20} className="text-monad" /> Agent Leaderboard
              </h3>
              <div className="space-y-3">
                {leaderboardError ? (
                  <div className="p-2 bg-red-500/10 rounded flex items-center justify-between">
                    <p className="text-sm text-red-400">{leaderboardError}</p>
                    <button onClick={fetchLeaderboard} className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded border border-red-500/30">Retry</button>
                  </div>
                ) : isLeaderboardLoading ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Activity size={14} className="animate-spin" />
                    <p className="text-sm">Retrying/Loading agents...</p>
                  </div>
                ) : (
                  leaderboard.map((agent, idx) => (
                    <div key={agent.address} className="flex justify-between items-center text-sm p-2 rounded-lg bg-black/40 border border-border">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 font-mono w-4">{idx + 1}.</span>
                        <span className="font-medium text-gray-300">{agent.label || "Agent"}</span>
                        <span className="font-mono text-xs text-gray-600 hidden sm:inline">{agent.address.slice(0,6)}...</span>
                      </div>
                      <span className="text-monad font-medium font-mono">{agent.reputation}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Feed */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-xl flex flex-col h-[calc(100vh-140px)]">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Activity size={16} className="text-monad animate-pulse" /> Live Event Feed
          </h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            <AnimatePresence>
              {events.length === 0 ? (
                <div className="text-center text-gray-500 text-sm mt-10">Listening for events on Monad Testnet...</div>
              ) : (
                events.map((ev) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="p-3 bg-black/40 border border-border rounded-lg text-sm"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-monad-light">{ev.type}</span>
                      <span className="text-xs text-gray-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    </div>
                    
                    {ev.type === 'VoteCommitted' && (
                      <p className="text-gray-400">Agent <span className="font-mono text-xs">{ev.voter.slice(0,6)}...</span> locked vote. Weight: {ev.weight}</p>
                    )}
                    {ev.type === 'VoteRevealed' && (
                      <div>
                        <p className="text-gray-400">Agent <span className="font-mono text-xs">{ev.voter.slice(0,6)}...</span> revealed: {ev.choice ? <span className="text-success font-bold">YES</span> : <span className="text-error font-bold">NO</span>}</p>
                        <p className="text-xs text-gray-500 mt-1 italic">"{ev.rationale}"</p>
                      </div>
                    )}
                    {ev.type === 'ProposalResolved' && (
                      <p className="text-white">Resolved: {Number(ev.status) === 1 ? 'Approved ✅' : 'Rejected ❌'} ({ev.yes} Yes, {ev.no} No)</p>
                    )}
                    {ev.type === 'EscrowReleased' && (
                      <p className="text-success">Funds released to {ev.target.slice(0,6)}...</p>
                    )}
                    {ev.type === 'EscrowRefunded' && (
                      <p className="text-pending">Funds refunded to proposer.</p>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>
    </div>
  );
}
