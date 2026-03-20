import React from 'react';
import { BarChart2 } from 'lucide-react';

const Header = () => {
  return (
    <header style={{ 
      padding: '1.5rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      position: 'relative',
      zIndex: 10
    }}>
      <div className="container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* Logo Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            backgroundColor: 'var(--accent-green-dim)',
            border: '1px solid var(--accent-green-border)',
            borderRadius: '0.375rem',
            padding: '0.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BarChart2 size={18} color="var(--accent-green)" />
          </div>
          <span style={{
            fontWeight: 800,
            fontSize: '1.125rem',
            letterSpacing: '0.05em'
          }}>
            POLL <span style={{ opacity: 0.5 }}>.</span> SOL
          </span>
        </div>

        {/* Network Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-green)',
            boxShadow: '0 0 8px var(--accent-green)'
          }} />
          SOLANA DEVNET
        </div>
      </div>
    </header>
  );
};

export default Header;
