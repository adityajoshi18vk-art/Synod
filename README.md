# Synod

Synod is a decentralized consensus layer where AI agents reach consensus at Monad speed. Built for the Monad testnet, demonstrating sub-second finality, parallel execution, and reputation-weighted decision making.

## Architecture

```
AgentRegistry.sol ─── agents, labels, reputation (EMA: 80/20)
        ↑                       ↑
        │               updateReputation()
        │                       │
SynodVoting.sol ───── proposals, commit-reveal, weighted tally
        ↑
SynodEscrow.sol ───── holds funds, releases on Approved, refunds on Rejected
        ↑
TimelockController ── guardian: pause/unpause escrow (60s demo delay)
```

## Deployed Contracts (Monad Testnet — Chain ID 10143)

| Contract            | Address                                    | Verified |
|---------------------|--------------------------------------------|----------|
| AgentRegistry       | `0xd88B17aFAc01bC71e2A570844C5d694aDC30bDbE` | ✅ [Sourcify](https://testnet.monadscan.com/contracts/full_match/10143/0xd88B17aFAc01bC71e2A570844C5d694aDC30bDbE/) |
| SynodVoting         | `0x78FB0D3C27Fab89ce4c27D09F1278adF2E159656` | ✅ [Sourcify](https://testnet.monadscan.com/contracts/full_match/10143/0x78FB0D3C27Fab89ce4c27D09F1278adF2E159656/) |
| TimelockController  | `0x0d5674E8e2176c4Fd8ba950F2Ca52442541B1963` | ✅ [Sourcify](https://testnet.monadscan.com/contracts/full_match/10143/0x0d5674E8e2176c4Fd8ba950F2Ca52442541B1963/) |
| SynodEscrow         | `0x9a7B299A40787DbC2dd95e3FeF6DB57595Ee6051` | ✅ [Sourcify](https://testnet.monadscan.com/contracts/full_match/10143/0x9a7B299A40787DbC2dd95e3FeF6DB57595Ee6051/) |

> **Note:** TimelockController uses a 60-second `minDelay` for demo purposes. Production would use a longer delay (e.g., 24-48 hours).

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- A Monad Testnet wallet funded with MON

### 2. Getting Testnet MON
1. Visit the official Monad Testnet Faucet: [https://faucet.monad.xyz](https://faucet.monad.xyz)
2. Connect your wallet (e.g., MetaMask).
3. Complete the required verification (e.g., Discord/X).
4. Request MON to your wallet address.

### 3. Smart Contracts

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env — add your PRIVATE_KEY
```

#### Deploy All Contracts (Phase 2)
Deploys AgentRegistry, SynodVoting, TimelockController, and SynodEscrow, wires them together:
```bash
npx hardhat run scripts/deployAll.js --network monadTestnet
```
Copy the printed addresses into `.env`.

#### Verify Contracts
```bash
npx hardhat verify --network monadTestnet <AgentRegistry_Address>
npx hardhat verify --network monadTestnet <SynodVoting_Address> "<AgentRegistry_Address>"
npx hardhat verify --network monadTestnet <SynodEscrow_Address> "<SynodVoting_Address>" "<TimelockController_Address>"
npx hardhat verify --network monadTestnet <TimelockController_Address> 60 "[<deployer>]" "[<deployer>]" "<deployer>"
```

#### Run Tests
```bash
npx hardhat test
```
21 tests covering: commit-reveal voting, reputation-weighted tally, EMA reputation updates, rationale field, escrow release/refund, and guardian pause via TimelockController.

#### Run E2E CLI Demo (local Hardhat network)
```bash
npx hardhat run scripts/e2eVoting.js
```

#### Run Event Listener (live testnet)
```bash
npx hardhat run scripts/eventListener.js --network monadTestnet
```
Tails all contract events to console in real time.

### 4. Frontend (Dashboard) — coming in Phase 3
```bash
cd frontend
npm install
npm run dev
```

## Security

- **Commit-reveal voting** prevents front-running and vote-copying
- **ReentrancyGuard** on escrow `release()` function
- **TimelockController** as escrow guardian (not a bare EOA)
- **Solidity 0.8.28** with built-in overflow/underflow checks
- **Access control**: only SynodVoting can update agent reputations

## Reputation System

Uses an Exponential Moving Average (EMA):
```
new_score = 0.8 * old_score + 0.2 * new_result
```
- `new_result = 1000` for a correct vote (voted with the resolved outcome)
- `new_result = 0` for an incorrect vote
- Agents start at 500 (neutral baseline, 0-1000 scale)

## Project Structure

```
synod/
├── contracts/                    # Hardhat project
│   ├── contracts/
│   │   ├── AgentRegistry.sol     # Agent registration + EMA reputation
│   │   ├── SynodVoting.sol       # Proposals + commit-reveal + weighted tally
│   │   └── SynodEscrow.sol       # Escrow + reentrancy guard + timelock guardian
│   ├── scripts/
│   │   ├── deploy.js             # Deploy AgentRegistry only
│   │   ├── deployVoting.js       # Deploy SynodVoting only
│   │   ├── deployAll.js          # Deploy all Phase 2 contracts
│   │   ├── e2eVoting.js          # Full E2E CLI demo (local)
│   │   ├── e2eLiveTestnet.js     # E2E against live Monad testnet
│   │   ├── eventListener.js      # Live event feed (console)
│   │   └── readState.js          # Read on-chain agent state
│   └── test/
│       └── SynodVoting.test.js   # 21 passing tests
├── frontend/                     # React + Vite + Tailwind (Phase 3)
└── README.md
```
