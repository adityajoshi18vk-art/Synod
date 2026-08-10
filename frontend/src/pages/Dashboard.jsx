import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Activity, Settings, Play, Users } from 'lucide-react';
import { formatEther } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { useSynodEvents } from '../hooks/useSynodEvents';
import { triggerDemoSwarm, autoResolveProposal } from '../lib/simulator';
import { useCouncilVote } from '../hooks/useCouncilVote';
import MissionControlPanel from '../components/MissionControlPanel';
import AgentDetailPanel from '../components/AgentDetailPanel';
import ErrorBanner from '../components/ErrorBanner';
import { publicClient, ADDRESSES } from '../lib/config';
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
    
    for (const ev of events) {
      if (ev.type === 'VoteRevealed' && ev.choice === true && !seen.has(ev.voter)) {
        eventSum += BigInt(ev.weight);
        seen.add(ev.voter);
      }
    }
    
    return base > eventSum ? base : eventSum;
  }, [activeProposal, events]);

  const liveNoWeight = useMemo(() => {
    if (!activeProposal) return 0n;
    let base = BigInt(activeProposal.noWeight || 0);
    let eventSum = 0n;
    const seen = new Set();
    
    for (const ev of events) {
      if (ev.type === 'VoteRevealed' && ev.choice === false && !seen.has(ev.voter)) {
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
            totalVotes: Number(totalVotes),
            correctVotes: Number(correctVotes),
            label: label || 'Unknown'
          });
        }
      }

      results.sort((a, b) => b.reputation - a.reputation);
      // Display-only filter: only show the 7 active agents (5 council + 2 demo burners).
      // 3 unused burner agents are hidden from UI without any on-chain changes.
      const ACTIVE_AGENT_ADDRESSES = new Set([
        "0x4F2295662756a5B613C517c3d5d7e3Bd34bB1f02", // Demo Agent 1 (Burner 1)
        "0x8206c69302eAe52D5EF4D0d390177bf60CdaAd4a", // Demo Agent 2 (Burner 2)
        "0xFe767bf3135B918922FAd6047e9A852b8579624C", // Arjun (Council 1)
        "0x29a733e6fE9D909047758c3D56F0bC8860309adb", // Nova (Council 2)
        "0x3577BAa4b973d45675F68BB41cA12C31c016Dc93", // Sentinel (Council 3)
        "0xEDEbb4507b49df4AFBACf26e13A9E083C3567381", // Cipher (Council 4)
        "0x0DD9Db32668732d8C295Aec76904F62b32af744e", // Oracle (Council 5)
      ].map(a => a.toLowerCase()));
      setLeaderboard(results.filter(a => ACTIVE_AGENT_ADDRESSES.has(a.address.toLowerCase())));
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

  // Stabilize dependency to primitive values to avoid re-firing on every object reference change
  const proposalId = activeProposal?.id?.toString();
  const proposalStatus = activeProposal ? Number(activeProposal.status) : -1;
  const revealDeadline = activeProposal ? Number(activeProposal.revealDeadline) : 0;

  useEffect(() => {
    if (!proposalId || proposalStatus !== 0 || !revealDeadline) return;

    let timeoutId;
    const now = Date.now();
    const revealDeadlineMs = revealDeadline * 1000;
    
    if (now > revealDeadlineMs) {
      // Deadline passed before page loaded or just now
      autoResolveProposal(proposalId).catch(console.error);
    } else {
      // Set timer to trigger right when deadline hits
      timeoutId = setTimeout(() => {
        autoResolveProposal(proposalId).catch(console.error);
      }, revealDeadlineMs - now + 2000); // 2 second buffer
    }

    return () => clearTimeout(timeoutId);
  }, [proposalId, proposalStatus, revealDeadline]);

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
    try {
      const yW = Number(activeProposal?.yesWeight ?? liveYesWeight ?? 0);
      const nW = Number(activeProposal?.noWeight ?? liveNoWeight ?? 0);
      const threshold = Number(activeProposal?.quorumThreshold ?? 1000);

      switch (Number(status)) {
        case 0: return <span className="px-3 py-1 bg-pending/20 text-pending rounded-full text-sm font-medium border border-pending/30">Pending</span>;
        case 1:
        case 2:
        case 3: {
          const totalWeight = yW + nW;

          // 1. Quorum Failed
          if (totalWeight < threshold) {
            return (
              <span className="px-3 py-1 text-red-500 bg-red-950/30 border border-red-900/50 rounded-full text-sm font-medium">
                Quorum not reached — trade blocked, funds returned
              </span>
            );
          }

          // 2. Rejected by AI Council
          if (nW > yW) {
            return (
              <span className="px-3 py-1 text-red-400 bg-red-950/30 border border-red-500/30 rounded-full text-sm font-medium">
                Proposal Rejected — AI Council blocked high-risk trade
              </span>
            );
          }

          // 3. Approved / Consensus Reached
          return (
            <span className="px-3 py-1 text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 rounded-full text-sm font-medium flex items-center gap-1">
              Consensus reached — trade executed
              <a href={`https://testnet.monadscan.com/address/${ADDRESSES.escrow}`} target="_blank" rel="noreferrer" className="underline ml-1 opacity-80 hover:opacity-100">Tx</a>
            </span>
          );
        }
        default: return null;
      }
    } catch (err) {
      console.error('[getStatusBadge] Render error:', err);
      return <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm font-medium border border-gray-500/30">Unknown</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#08080a] p-6 text-gray-200 font-sans relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>
      {/* Header */}
      <header className="max-w-7xl mx-auto flex items-center justify-between mb-8 border-b border-white/10 pb-6 relative z-10">
        <div className="flex items-center gap-3" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <ShieldCheck className="text-monad" size={32} />
          <h1 className="text-2xl font-bold tracking-tight">Synod Mission Control</h1>
        </div>
        <button 
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 px-4 py-2 bg-[#111116] hover:bg-white/5 border border-white/10 rounded-lg transition-colors text-sm backdrop-blur-md"
        >
          <Settings size={16} /> Admin Panel
        </button>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <ErrorBanner error={rpcError} onRetry={retry} />

          {/* Active Proposal Card */}
          <div className="backdrop-blur-md bg-[#111116]/80 rounded-2xl border border-purple-500/20 p-6 shadow-[0_0_30px_rgba(139,92,246,0.05)] relative overflow-hidden hover:border-purple-500/40 transition-colors z-10">
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
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] hover:scale-105 disabled:hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 border border-white/10"
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

          {/* Mission Control Panel — High Density UI */}
          <MissionControlPanel
            activeProposal={activeProposal}
            liveYesWeight={liveYesWeight}
            liveNoWeight={liveNoWeight}
            councilMeta={councilMeta}
            councilLoading={councilLoading}
            councilError={councilError}
            events={events}
            isSimulating={isSimulating}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[2fr,3fr] gap-6">
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
            
            {/* Right Side Column (Agent Detail & Live Exec) */}
            <AgentDetailPanel leaderboard={leaderboard} />
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
