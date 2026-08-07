import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createConfig, WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { monadTestnet } from 'viem/chains'
import { http } from 'viem'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

// Suppress unhandled promise rejections from viem polling/WebSocket errors
// that would otherwise crash the entire React tree in production
window.addEventListener('unhandledrejection', (event) => {
  console.warn('[Global] Unhandled promise rejection caught:', event.reason);
  event.preventDefault();
});

import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import ProposalDetail from './pages/ProposalDetail'
import AdminPanel from './pages/AdminPanel'
import ErrorBoundaryWrapper from './components/ErrorBoundaryWrapper'

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
          <ErrorBoundaryWrapper>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/proposal/:id" element={<ProposalDetail />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Routes>
          </ErrorBoundaryWrapper>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)

