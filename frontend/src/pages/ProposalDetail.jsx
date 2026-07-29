import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { formatEther } from 'viem';
import { publicClient, ADDRESSES } from '../lib/config';
import { VOTING_ABI, REGISTRY_ABI } from '../lib/abis';

export default function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState(null);
  const [voters, setVoters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const p = await publicClient.readContract({
          address: ADDRESSES.voting,
          abi: VOTING_ABI,
          functionName: 'getProposal',
          args: [BigInt(id)],
        });
        setProposal(p);

        // Fetch voters
        const voterAddrs = await publicClient.readContract({
          address: ADDRESSES.voting,
          abi: VOTING_ABI,
          functionName: 'getVoters',
          args: [BigInt(id)],
        });

        const vData = [];
        for (const v of voterAddrs) {
          const vote = await publicClient.readContract({
            address: ADDRESSES.voting,
            abi: VOTING_ABI,
            functionName: 'getVote',
            args: [BigInt(id), v],
          });
          const rep = await publicClient.readContract({
            address: ADDRESSES.registry,
            abi: REGISTRY_ABI,
            functionName: 'getReputation',
            args: [v],
          });
          vData.push({ address: v, ...vote, currentRep: rep.toString() });
        }
        setVoters(vData);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return <div className="min-h-screen bg-bg text-white flex items-center justify-center">Loading...</div>;
  if (!proposal) return <div className="min-h-screen bg-bg text-white flex items-center justify-center">Proposal not found</div>;

  const isApproved = Number(proposal.status) === 1;

  return (
    <div className="min-h-screen bg-bg p-6 text-gray-200">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-monad hover:text-monad-light mb-8 transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </button>

        <div className="bg-card border border-border rounded-2xl p-8 mb-8 shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-white">Proposal #{id}</h1>
              <a 
                href={`https://testnet.monadscan.com/address/${ADDRESSES.voting}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs px-3 py-1 bg-monad/20 text-monad hover:bg-monad/30 border border-monad/40 rounded-full transition-colors"
              >
                Verify on Monadscan ↗
              </a>
            </div>
            {isApproved ? (
              <span className="flex items-center gap-2 px-4 py-2 bg-success/20 text-success rounded-full border border-success/30 font-medium">
                <CheckCircle2 size={18} /> Consensus Reached
              </span>
            ) : (
              <span className="flex items-center gap-2 px-4 py-2 bg-error/20 text-error rounded-full border border-error/30 font-medium">
                <XCircle size={18} /> Rejected
              </span>
            )}
          </div>
          
          <p className="text-xl text-gray-300 mb-8">{proposal.description}</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Amount</p>
              <p className="font-mono text-white">{formatEther(proposal.amount)} MON</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Target</p>
              <a href={`https://testnet.monadscan.com/address/${proposal.target}`} target="_blank" rel="noreferrer" className="font-mono text-monad hover:underline">{proposal.target.slice(0,8)}...</a>
            </div>
            <div>
              <p className="text-gray-500 mb-1">YES Weight</p>
              <p className="font-medium text-success">{proposal.yesWeight.toString()}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">NO Weight</p>
              <p className="font-medium text-error">{proposal.noWeight.toString()}</p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4 text-white">Vote History & Rationale</h2>
        <div className="space-y-4">
          {voters.map((v, i) => (
            <div key={i} className="bg-black/50 border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-monad/30 transition-colors">
              <div>
                <p className="font-mono text-sm text-gray-400 mb-1">{v.address}</p>
                {v.revealed ? (
                  <p className="text-gray-300 italic text-sm">"{v.rationale}"</p>
                ) : (
                  <p className="text-gray-600 italic text-sm">Did not reveal</p>
                )}
              </div>
              <div className="text-right shrink-0">
                {v.revealed ? (
                  <span className={`font-bold ${v.choice ? 'text-success' : 'text-error'}`}>
                    {v.choice ? 'YES' : 'NO'} (wt: {v.weight.toString()})
                  </span>
                ) : (
                  <span className="text-gray-500 font-medium">COMMITTED</span>
                )}
                <p className="text-xs text-gray-500 mt-1">Current Rep: {v.currentRep}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
