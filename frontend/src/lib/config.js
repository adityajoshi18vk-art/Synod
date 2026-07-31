import { createPublicClient, createWalletClient, custom, http, fallback } from 'viem';
import { monadTestnet } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';

export const ADDRESSES = {
  registry: import.meta.env.VITE_AGENT_REGISTRY_ADDRESS,
  voting: import.meta.env.VITE_VOTING_ADDRESS,
  escrow: import.meta.env.VITE_ESCROW_ADDRESS,
  timelock: import.meta.env.VITE_TIMELOCK_ADDRESS,
};

// Fallback to random burner keys if not provided in .env
const getBurnerKeys = () => {
  const keys = [
    import.meta.env.VITE_BURNER_PK_1,
    import.meta.env.VITE_BURNER_PK_2,
    import.meta.env.VITE_BURNER_PK_3,
    import.meta.env.VITE_BURNER_PK_4,
    import.meta.env.VITE_BURNER_PK_5,
  ].filter(Boolean);
  
  while (keys.length < 5) keys.push(generatePrivateKey());
  return keys;
};

// Fallback to random council keys if not provided in .env
const getCouncilKeys = () => {
  const keys = [
    import.meta.env.VITE_COUNCIL_PK_1,
    import.meta.env.VITE_COUNCIL_PK_2,
    import.meta.env.VITE_COUNCIL_PK_3,
    import.meta.env.VITE_COUNCIL_PK_4,
    import.meta.env.VITE_COUNCIL_PK_5,
  ].filter(Boolean);

  while (keys.length < 5) keys.push(generatePrivateKey());
  return keys;
};

export const BURNER_KEYS = getBurnerKeys();
export const COUNCIL_KEYS = getCouncilKeys();

export const COUNCIL_AGENTS = [
  { name: 'Arjun', title: 'Risk Assessor', provider: 'Sarvam AI', model: 'sarvam-105b' },
  { name: 'Nova', title: 'Trend Strategist', provider: 'Groq', model: 'llama-3.3-70b-versatile' },
  { name: 'Sentinel', title: 'Compliance Auditor', provider: 'Groq', model: 'llama-3.3-70b-versatile' },
  { name: 'Cipher', title: 'Quant Analyst', provider: 'Groq', model: 'llama-3.3-70b-versatile' },
  { name: 'Oracle', title: 'Macro Economist', provider: 'Groq', model: 'llama-3.3-70b-versatile' },
];

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: fallback([
    http(import.meta.env.VITE_RPC_URL_PRIMARY),
    http(import.meta.env.VITE_RPC_URL_FALLBACK)
  ]),
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
