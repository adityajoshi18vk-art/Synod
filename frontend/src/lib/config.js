import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { monadTestnet } from 'viem/chains';

export const ADDRESSES = {
  registry: import.meta.env.VITE_AGENT_REGISTRY_ADDRESS,
  voting: import.meta.env.VITE_VOTING_ADDRESS,
  escrow: import.meta.env.VITE_ESCROW_ADDRESS,
  timelock: import.meta.env.VITE_TIMELOCK_ADDRESS,
};

export const BURNER_KEYS = [
  import.meta.env.VITE_BURNER_PK_1,
  import.meta.env.VITE_BURNER_PK_2,
  import.meta.env.VITE_BURNER_PK_3,
  import.meta.env.VITE_BURNER_PK_4,
  import.meta.env.VITE_BURNER_PK_5,
].filter(Boolean);

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(import.meta.env.VITE_RPC_URL),
});

export const YES_RATIONALES = [
  "Risk assessment indicates favorable market conditions for this trade.",
  "Technical indicators align with the proposed action. Consensus is strong.",
  "Historical patterns support this decision. Proceeding with confidence.",
  "Volatility metrics are within acceptable bounds. Approving execution.",
];

export const NO_RATIONALES = [
  "Current market conditions present elevated risk. Recommending caution.",
  "Insufficient data to support this action. Abstaining from approval.",
  "Counterparty risk exceeds acceptable thresholds. Voting against.",
  "Timing misalignment detected. Suggesting deferral of this action.",
];

export function getTemplatedRationale(choice, agentIndex = 0) {
  const templates = choice ? YES_RATIONALES : NO_RATIONALES;
  return templates[agentIndex % templates.length];
}
