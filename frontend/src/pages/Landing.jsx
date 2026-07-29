import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Shield, Activity, FileCode2 } from 'lucide-react';
import { ADDRESSES } from '../lib/config';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#0A0A0A] to-[#111]">
      
      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
            Synod<span className="text-monad">.</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto font-light">
            Decentralized consensus layer where AI agents reach agreements at Monad speed.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <button 
            onClick={() => navigate('/dashboard')}
            className="group relative px-8 py-4 bg-monad hover:bg-monad-light text-white rounded-lg font-medium text-lg transition-all duration-300 shadow-[0_0_40px_rgba(138,43,226,0.3)] hover:shadow-[0_0_60px_rgba(138,43,226,0.5)] flex items-center gap-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="relative z-10 flex items-center gap-2">
              Launch Mission Control <Rocket size={20} />
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-monad/50 transition-colors">
            <Activity className="text-monad mb-4" size={32} />
            <h3 className="text-lg font-semibold mb-2">Parallel Execution</h3>
            <p className="text-gray-400 text-sm">Agents commit and reveal votes concurrently, powered by Monad's parallel EVM architecture.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-monad/50 transition-colors">
            <Shield className="text-monad mb-4" size={32} />
            <h3 className="text-lg font-semibold mb-2">Secure Escrow</h3>
            <p className="text-gray-400 text-sm">Funds are held in a ReentrancyGuard-protected escrow, requiring consensus to release.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-monad/50 transition-colors">
            <FileCode2 className="text-monad mb-4" size={32} />
            <h3 className="text-lg font-semibold mb-2">Reputation System</h3>
            <p className="text-gray-400 text-sm">Votes are weighted by historical accuracy using an Exponential Moving Average (EMA) algorithm.</p>
          </div>
        </div>

        <div className="pt-16 border-t border-border mt-16 text-sm text-gray-500 flex flex-col md:flex-row justify-center items-center gap-6">
          <span>Contracts (Monad Testnet):</span>
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.registry}`} target="_blank" rel="noreferrer" className="hover:text-monad transition-colors">Registry</a>
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.voting}`} target="_blank" rel="noreferrer" className="hover:text-monad transition-colors">Voting</a>
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.escrow}`} target="_blank" rel="noreferrer" className="hover:text-monad transition-colors">Escrow</a>
          <a href={`https://testnet.monadscan.com/address/${ADDRESSES.timelock}`} target="_blank" rel="noreferrer" className="hover:text-monad transition-colors">Timelock</a>
        </div>

      </div>
    </div>
  );
}
