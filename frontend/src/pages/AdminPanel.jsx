import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Plus, ShieldCheck, Clock } from 'lucide-react';
import { parseEther, encodeFunctionData, zeroHash } from 'viem';
import { useAccount, useWriteContract, useConnect, useSwitchChain } from 'wagmi';
import { monadTestnet } from 'viem/chains';
import { injected } from 'wagmi/connectors';
import { ADDRESSES, publicClient } from '../lib/config';
import { VOTING_ABI, ESCROW_ABI, TIMELOCK_ABI } from '../lib/abis';

export default function AdminPanel() {
  const navigate = useNavigate();
  const { isConnected, address, chainId } = useAccount();
  const { connect } = useConnect();
  const { switchChainAsync } = useSwitchChain();

  // Create Proposal state
  const [desc, setDesc] = useState("Execute $250K ETH/USDC arbitrage via Uniswap V3");
  const [amount, setAmount] = useState("0.1");
  const [target, setTarget] = useState(ADDRESSES.voting); // dummy target
  const [quorum, setQuorum] = useState("1000"); // Wait, quorum is rep weighted. 5 agents = max 2500. 1000 is good.

  const { writeContractAsync: writeVoting } = useWriteContract();
  const { writeContractAsync: writeEscrow } = useWriteContract();
  const { writeContractAsync: writeTimelock } = useWriteContract();

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    if (!isConnected) return alert("Please connect wallet");
    
    if (chainId !== monadTestnet.id) {
      try {
        await switchChainAsync({ chainId: monadTestnet.id });
      } catch (err) {
        return alert("You must switch to Monad Testnet to create a proposal!");
      }
    }

    try {
      // 1. Submit Proposal
      // commitWindow = 120s, revealWindow = 120s for demo safety
      const txHash = await writeVoting({
        address: ADDRESSES.voting,
        abi: VOTING_ABI,
        functionName: 'submitProposal',
        args: [desc, parseEther(amount), target, 120n, 120n, BigInt(quorum)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') {
        throw new Error(`Proposal submission reverted (tx: ${txHash})`);
      }
      
      // Find ProposalCreated event to get ID
      const event = receipt.logs.map(l => {
        try { return publicClient.readEventLog({ abi: VOTING_ABI, data: l.data, topics: l.topics, eventName: 'ProposalCreated' }) } catch { return null }
      }).find(Boolean);

      if (event) {
        // 2. Deposit Escrow
        const pid = event.args.proposalId;
        const depositHash = await writeEscrow({
          address: ADDRESSES.escrow,
          abi: ESCROW_ABI,
          functionName: 'deposit',
          args: [pid],
          value: parseEther(amount),
        });
        await publicClient.waitForTransactionReceipt({ hash: depositHash }).then(r => {
          if (r.status === 'reverted') throw new Error(`Escrow deposit reverted (tx: ${depositHash})`);
        });
        alert(`Proposal #${pid} created and escrow funded!`);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  };

  // Timelock Pause state
  const [pauseStep, setPauseStep] = useState(0); // 0=idle, 1=scheduled, 2=ready
  const [countdown, setCountdown] = useState(0);
  const MIN_DELAY = 60; // 60s
  
  const pauseData = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'pause',
  });

  const handleSchedulePause = async () => {
    try {
      const txHash = await writeTimelock({
        address: ADDRESSES.timelock,
        abi: TIMELOCK_ABI,
        functionName: 'schedule',
        args: [ADDRESSES.escrow, 0n, pauseData, zeroHash, zeroHash, BigInt(MIN_DELAY)],
      });
      const scheduleReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (scheduleReceipt.status === 'reverted') {
        throw new Error(`Schedule pause reverted (tx: ${txHash})`);
      }
      setPauseStep(1);
      setCountdown(MIN_DELAY);
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message);
    }
  };

  useEffect(() => {
    if (pauseStep === 1 && countdown > 0) {
      const timer = setInterval(() => setCountdown(c => c - 1), 1000);
      return () => clearInterval(timer);
    } else if (pauseStep === 1 && countdown === 0) {
      setPauseStep(2);
    }
  }, [pauseStep, countdown]);

  const handleExecutePause = async () => {
    try {
      const txHash = await writeTimelock({
        address: ADDRESSES.timelock,
        abi: TIMELOCK_ABI,
        functionName: 'execute',
        args: [ADDRESSES.escrow, 0n, pauseData, zeroHash, zeroHash],
      });
      const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (executeReceipt.status === 'reverted') {
        throw new Error(`Execute pause reverted (tx: ${txHash})`);
      }
      alert("Escrow Paused successfully!");
      setPauseStep(0);
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-bg p-6 text-gray-200">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <ShieldCheck className="text-monad" size={32} />
          <h1 className="text-2xl font-bold">Admin Controls</h1>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="text-sm px-3 py-1 bg-card border border-border rounded-full">
              Connected: {address.slice(0,6)}...
            </div>
          ) : (
            <button 
              onClick={() => connect({ connector: injected() })}
              className="text-sm px-4 py-2 bg-monad hover:bg-monad-light text-white font-medium rounded-lg transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Create Proposal */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xl">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
            <Plus size={20} className="text-monad" /> Create Proposal
          </h2>
          <form onSubmit={handleCreateProposal} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <input type="text" value={desc} onChange={e=>setDesc(e.target.value)} className="w-full bg-black border border-border rounded-md px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount (MON)</label>
              <input type="text" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-black border border-border rounded-md px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target Address</label>
              <input type="text" value={target} onChange={e=>setTarget(e.target.value)} className="w-full bg-black border border-border rounded-md px-3 py-2 text-white font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quorum Threshold (Weight)</label>
              <input type="number" value={quorum} onChange={e=>setQuorum(e.target.value)} className="w-full bg-black border border-border rounded-md px-3 py-2 text-white" />
              <p className="text-xs text-gray-500 mt-1">4 agents * 500 rep = 2000 weight typically.</p>
            </div>
            <button type="submit" disabled={!isConnected} className="w-full mt-4 px-4 py-2 bg-monad hover:bg-monad-light text-white font-medium rounded-lg disabled:opacity-50 transition-colors">
              Submit & Deposit Escrow
            </button>
          </form>
        </div>

        {/* Timelock Controls */}
        <div className="bg-card p-6 rounded-2xl border border-error/50 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 bg-error h-full" />
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-6 text-error">
            <ShieldAlert size={20} /> Emergency Pause (Timelock)
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Pausing the escrow prevents any funds from being released. Controlled by the Timelock with a 60-second delay.
          </p>

          <div className="space-y-4">
            <button 
              onClick={handleSchedulePause}
              disabled={!isConnected || pauseStep !== 0}
              className="w-full px-4 py-2 border border-error/50 hover:bg-error/20 text-error font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              1. Schedule Pause
            </button>

            {pauseStep === 1 && (
              <div className="p-4 bg-black/50 border border-pending/50 rounded-lg text-center flex flex-col items-center gap-2 animate-pulse">
                <Clock className="text-pending" size={24} />
                <span className="text-pending font-medium">Timelock Delay: {countdown}s remaining</span>
              </div>
            )}

            <button 
              onClick={handleExecutePause}
              disabled={!isConnected || pauseStep !== 2}
              className="w-full px-4 py-2 bg-error hover:bg-red-500 text-white font-medium rounded-lg disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            >
              2. Execute Pause
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
