import { useMemo } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Components
import Header from './components/Header';
import Landing from './pages/Landing';
import AdminAuth from './pages/AdminAuth';
import AdminDashboard from './pages/AdminDashboard';
import UserApp from './pages/UserApp';

function App() {
  const location = useLocation();
  const isLandingRoute = location.pathname === '/';

  // Set connection to Solana Devnet as requested by the user
  const endpoint = "https://api.devnet.solana.com";
  
  // Set up wallets (using standards from wallet-adapter)
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {/* Main App Layout */}
          <div className="app-layout">
            {isLandingRoute && <Header />}
            <main>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/admin" element={<AdminAuth />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/app" element={<UserApp />} />
              </Routes>
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
