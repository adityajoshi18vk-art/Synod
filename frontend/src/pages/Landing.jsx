import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Shield, Activity, FileCode2, Terminal } from 'lucide-react';
import { ADDRESSES } from '../lib/config';

export default function Landing() {
  const navigate = useNavigate();
  const [blockCount, setBlockCount] = useState(14829301);

  // Mock block ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockCount(prev => prev + 1);
    }, 800); // 0.8s finality mock
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#08080a] text-gray-200 relative overflow-hidden font-sans">
      
      {/* Background Grid & Radial Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>

      {/* Top Bar Ticker */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center text-xs font-mono text-gray-400 border-b border-white/5 bg-[#08080a]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Monad Testnet (Chain ID 10143)
        </div>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-purple-400" />
          <span>Block: {blockCount.toLocaleString()}</span>
        </div>
      </div>

      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 z-10 mt-16">
        
        <div className="space-y-4">
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
            Synod<span className="text-purple-500 drop-shadow-[0_0_15px_rgba(139,92,246,0.8)]">.</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
            The pre-trade risk quorum for autonomous trading agents — no AI bot moves capital alone.
          </p>
        </div>

        {/* Live Stats Bar */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 pt-4 font-mono text-sm">
          <div className="px-4 py-2 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-200 backdrop-blur-md shadow-[0_0_10px_rgba(139,92,246,0.1)] flex items-center gap-2">
            <Activity size={14} className="text-purple-400" />
            Active AI Agents: <span className="font-bold text-white">5 Council / 2 Swarm</span>
          </div>
          <div className="px-4 py-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-200 backdrop-blur-md shadow-[0_0_10px_rgba(6,182,212,0.1)] flex items-center gap-2">
            <Shield size={14} className="text-cyan-400" />
            Consensus Finality: <span className="font-bold text-white">~0.8s</span>
          </div>
          <div className="px-4 py-2 rounded-full border border-green-500/20 bg-green-500/5 text-green-200 backdrop-blur-md shadow-[0_0_10px_rgba(34,197,94,0.1)] flex items-center gap-2">
            <Rocket size={14} className="text-green-400" />
            Protected Capital: <span className="font-bold text-white">$1.2M+</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <button 
            onClick={() => navigate('/dashboard')}
            className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] flex items-center gap-3 overflow-hidden border border-white/10"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="relative z-10 flex items-center gap-3 font-semibold tracking-wide">
              Launch Mission Control <Rocket size={22} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left relative z-10">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl backdrop-blur-md bg-white/[0.02] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 transition-all duration-300 group">
            <div className="bg-purple-500/10 p-3 rounded-xl w-fit text-purple-400 mb-5 shadow-[0_0_15px_rgba(139,92,246,0.15)] group-hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-shadow">
              <Activity size={28} />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Parallel Execution</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Agents commit and reveal votes concurrently, powered by Monad's parallel EVM architecture for sub-second finality.</p>
          </div>
          {/* Card 2 */}
          <div className="p-6 rounded-2xl backdrop-blur-md bg-white/[0.02] border border-white/10 hover:border-cyan-500/40 hover:-translate-y-1 transition-all duration-300 group">
            <div className="bg-cyan-500/10 p-3 rounded-xl w-fit text-cyan-400 mb-5 shadow-[0_0_15px_rgba(6,182,212,0.15)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-shadow">
              <Shield size={28} />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Secure Escrow</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Funds are held in a ReentrancyGuard-protected escrow, strictly requiring algorithmic consensus to release capital.</p>
          </div>
          {/* Card 3 */}
          <div className="p-6 rounded-2xl backdrop-blur-md bg-white/[0.02] border border-white/10 hover:border-purple-500/40 hover:-translate-y-1 transition-all duration-300 group">
            <div className="bg-purple-500/10 p-3 rounded-xl w-fit text-purple-400 mb-5 shadow-[0_0_15px_rgba(139,92,246,0.15)] group-hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-shadow">
              <FileCode2 size={28} />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Reputation Engine</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Votes are continuously weighted by historical accuracy using an on-chain Exponential Moving Average (EMA) algorithm.</p>
          </div>
        </div>

        <div className="pt-16 border-t border-white/10 mt-16 text-sm text-gray-500 flex flex-col md:flex-row justify-center items-center gap-6 pb-8">
          <span className="font-mono">Contracts (Monad Testnet):</span>
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.registry}`} target="_blank" rel="noreferrer" className="hover:text-purple-400 transition-colors font-mono">Registry</a>
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.voting}`} target="_blank" rel="noreferrer" className="hover:text-purple-400 transition-colors font-mono">Voting</a>
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.escrow}`} target="_blank" rel="noreferrer" className="hover:text-purple-400 transition-colors font-mono">Escrow</a>
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.timelock}`} target="_blank" rel="noreferrer" className="hover:text-purple-400 transition-colors font-mono">Timelock</a>
        </div>

      </div>
    </div>
  );
}
