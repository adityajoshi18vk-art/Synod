import { useState, useEffect } from 'react';
import { publicClient, ADDRESSES } from '../lib/config';
import { VOTING_ABI, ESCROW_ABI } from '../lib/abis';
import { withBackoff } from '../lib/rpcHelper';

export function useSynodEvents() {
  const [events, setEvents] = useState([]);
  const [rpcError, setRpcError] = useState(null);
  const [activeProposal, setActiveProposal] = useState(null);

  const fetchActiveProposal = async () => {
    try {
      const count = await withBackoff(() => Promise.race([
        publicClient.readContract({
          address: ADDRESSES.voting,
          abi: VOTING_ABI,
          functionName: 'proposalCount',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("RPC Timeout on proposalCount")), 5000))
      ]));
      
      if (count > 0n) {
        const p = await withBackoff(() => Promise.race([
          publicClient.readContract({
            address: ADDRESSES.voting,
            abi: VOTING_ABI,
            functionName: 'getProposal',
            args: [count],
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("RPC Timeout on getProposal")), 5000))
        ]));
        setActiveProposal(p);
      }
      setRpcError(null);
    } catch (e) {
      console.error("RPC Error fetching proposal:", e);
      setRpcError(e.message);
    }
  };

  useEffect(() => {
    fetchActiveProposal();

    const addEvent = (type, data) => {
      setEvents(prev => [{ id: Math.random().toString(), type, ...data, timestamp: Date.now() }, ...prev]);
      
      if (type === 'ProposalCreated') {
        fetchActiveProposal();
      } else if (type === 'ProposalResolved') {
        // Optimistically update status to avoid a re-fetch
        setActiveProposal(prev => prev ? { ...prev, status: data.status, tallied: true } : prev);
      }
    };

    let unwatchVoting, unwatchEscrow;

    try {
      unwatchVoting = publicClient.watchContractEvent({
        address: ADDRESSES.voting,
        abi: VOTING_ABI,
        onLogs: logs => {
          setRpcError(null);
          logs.forEach(log => {
            if (log.eventName === 'VoteCommitted') {
              addEvent('VoteCommitted', { voter: log.args.voter, weight: log.args.weight.toString() });
            } else if (log.eventName === 'VoteRevealed') {
              addEvent('VoteRevealed', { voter: log.args.voter, choice: log.args.choice, weight: log.args.weight.toString(), rationale: log.args.rationale });
            } else if (log.eventName === 'ProposalResolved') {
              addEvent('ProposalResolved', { status: log.args.status, yes: log.args.yesWeight.toString(), no: log.args.noWeight.toString() });
            } else if (log.eventName === 'ProposalCreated') {
              addEvent('ProposalCreated', { id: log.args.proposalId.toString(), desc: log.args.description });
            }
          });
        },
        onError: error => {
          console.error("Watch voting error:", error);
          setRpcError("Lost connection to network (Voting).");
        }
      });

      unwatchEscrow = publicClient.watchContractEvent({
        address: ADDRESSES.escrow,
        abi: ESCROW_ABI,
        onLogs: logs => {
          setRpcError(null);
          logs.forEach(log => {
            if (log.eventName === 'EscrowFunded') {
              addEvent('EscrowFunded', { amount: log.args.amount.toString() });
            } else if (log.eventName === 'EscrowReleased') {
              addEvent('EscrowReleased', { target: log.args.target });
            } else if (log.eventName === 'EscrowRefunded') {
              addEvent('EscrowRefunded', { to: log.args.depositor });
            }
          });
        },
        onError: error => {
          console.error("Watch escrow error:", error);
          setRpcError("Lost connection to network (Escrow).");
        }
      });
    } catch (err) {
      console.error("RPC Error setting up watches:", err);
      setRpcError(err.message);
    }

    return () => {
      if (unwatchVoting) unwatchVoting();
      if (unwatchEscrow) unwatchEscrow();
    };
  }, []);

  return { events, activeProposal, rpcError, retry: fetchActiveProposal, setEvents };
}
