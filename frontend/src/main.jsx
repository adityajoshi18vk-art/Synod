import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createConfig, WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { monadTestnet } from 'viem/chains'
import { http } from 'viem'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import ProposalDetail from './pages/ProposalDetail'
import AdminPanel from './pages/AdminPanel'

// 1. Setup Wagmi config
const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(import.meta.env.VITE_RPC_URL),
  },
})

// 2. Setup React Query client
const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/proposal/:id" element={<ProposalDetail />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
