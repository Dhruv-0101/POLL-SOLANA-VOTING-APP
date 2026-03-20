import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Zap, Lock, BarChart, CheckCircle, RefreshCcw } from 'lucide-react';

const Landing = () => {
  // Use Redux Toolkit State
  const { totalPolls, pollTokensInEscrow, solCollected, proposalsFinalized } = useSelector(state => state.app);
  const navigate = useNavigate();

  return (
    <div style={{ paddingBottom: '5rem' }}>
      
      {/* 
        ==============================
        HERO SECTION
        ==============================
      */}
      <section style={{
        padding: '6rem 0 4rem 0',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem'
      }} className="animate-fade-in container">
        
        {/* Pill Badge */}
        <div className="pill" style={{ marginBottom: '1rem' }}>
          <Zap size={14} fill="currentColor" />
          <span>TOKEN-POWERED GOVERNANCE ON SOLANA</span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: '4.5rem',
          lineHeight: '1.1',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          maxWidth: '1200px'
        }}>
          Decentralized Opinion.<br/>
          <span className="text-green">Hard-Coded Rewards.</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          color: 'var(--text-dim)',
          fontSize: '1.125rem',
          maxWidth: '800px',
          lineHeight: '1.6'
        }}>
          A tokenized polling engine on Solana. Stake to propose, earn to lead. Transparent escrow, instant finality.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button onClick={() => navigate('/app')} className="btn btn-primary" style={{ padding: '0.875rem 2rem', fontSize: '1.05rem' }}>
            <ArrowRight size={18} /> Enter App
          </button>
          <button onClick={() => navigate('/admin')} className="btn btn-outline" style={{ padding: '0.875rem 2rem', fontSize: '1.05rem' }}>
            <Shield size={18} /> Admin Access
          </button>
        </div>
      </section>

      {/* 
        ==============================
        HOW IT WORKS / LIFECYCLE
        ==============================
      */}
      <section className="container" style={{ marginTop: '8rem' }}>
        <div style={{ marginBottom: '3rem' }}>
          <div className="text-dim font-mono text-sm tracking-wide" style={{ marginBottom: '1rem' }}>
            // HOW IT WORKS
          </div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '1rem' }}>The Proposal Lifecycle</h2>
          <p className="text-dim" style={{ fontSize: '1.125rem' }}>Every token movement is deterministic and transparent.</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1rem'
        }}>
          {/* Step 1 */}
          <div className="card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: 'var(--accent-green)' }}>
              <span className="font-mono font-bold">01</span>
              <RefreshCcw size={20} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Buy POLL Tokens</h3>
            <p className="text-dim text-sm" style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Purchase POLL tokens with SOL at the platform rate. Tokens enter your wallet instantly.
            </p>
            <div className="pill" style={{ opacity: 0.8 }}>0.1 SOL / token</div>
          </div>

          {/* Step 2 */}
          <div className="card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: '#3b82f6' }}>
              <span className="font-mono font-bold">02</span>
              <Lock size={20} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Create Proposal</h3>
            <p className="text-dim text-sm" style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Stake 10 POLL to launch a poll. Tokens move to Proposal Escrow — locked until finalization.
            </p>
            <div className="pill" style={{ color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' }}>
              10 POLL → Escrow
            </div>
          </div>

          {/* Step 3 */}
          <div className="card" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: '#a855f7' }}>
              <span className="font-mono font-bold">03</span>
              <CheckCircle size={20} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Voters Stake & Vote</h3>
            <p className="text-dim text-sm" style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Each vote costs 1 POLL. Voting tokens accumulate in Voting Escrow — transparently on-chain.
            </p>
            <div className="pill" style={{ color: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.2)' }}>
              1 POLL / vote
            </div>
          </div>

          {/* Step 4 */}
          <div className="card" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: '#eab308' }}>
              <span className="font-mono font-bold">04</span>
              <Zap size={20} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Finalize & Release</h3>
            <p className="text-dim text-sm" style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Creator finalizes. Voting Tokens Escrow → Creator. Proposal Tokens Escrow → Treasury. Instant escrow release.
            </p>
            <div className="pill" style={{ color: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.2)' }}>
              Escrow Split 🔥
            </div>
          </div>

          {/* Step 5 */}
          <div className="card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: 'var(--accent-green)' }}>
              <span className="font-mono font-bold">05</span>
              <BarChart size={20} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Earn & Redeem</h3>
            <p className="text-dim text-sm" style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Creator earns all voting tokens. Redeem Tokens back for SOL at any time (minus 10% fee).
            </p>
            <div className="pill">
              POLL → SOL
            </div>
          </div>
        </div>
      </section>

      {/* 
        ==============================
        TOKEN FLOW LEDGER
        ==============================
      */}
      <section className="container" style={{ marginTop: '8rem' }}>
        <div style={{ marginBottom: '3rem' }}>
          <div className="text-dim font-mono text-sm tracking-wide" style={{ marginBottom: '1rem' }}>
            // TOKEN FLOW LEDGER
          </div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700 }}>Where Every Token Goes</h2>
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <th className="font-mono text-dim text-sm" style={{ padding: '1.5rem', fontWeight: 500 }}>FROM</th>
                <th className="font-mono text-dim text-sm" style={{ padding: '1.5rem', fontWeight: 500 }}>TO</th>
                <th className="font-mono text-dim text-sm" style={{ padding: '1.5rem', fontWeight: 500 }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <td style={{ padding: '1.5rem' }}><span style={{ backgroundColor: '#222', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>User Wallet</span></td>
                <td style={{ padding: '1.5rem', color: 'var(--accent-green)' }}><span style={{ backgroundColor: 'var(--accent-green-dim)', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>SOL Vault</span></td>
                <td style={{ padding: '1.5rem' }}>Buy 10 Tokens (1.1 SOL)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <td style={{ padding: '1.5rem' }}><span style={{ backgroundColor: '#222', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>Treasury</span></td>
                <td style={{ padding: '1.5rem', color: 'var(--accent-green)' }}><span style={{ backgroundColor: 'var(--accent-green-dim)', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>User Wallet</span></td>
                <td style={{ padding: '1.5rem' }}>+10 Tokens</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <td style={{ padding: '1.5rem' }}><span style={{ backgroundColor: '#222', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>User Wallet</span></td>
                <td style={{ padding: '1.5rem', color: 'var(--accent-green)' }}><span style={{ backgroundColor: 'var(--accent-green-dim)', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>Proposal Escrow</span></td>
                <td style={{ padding: '1.5rem' }}>Create Proposal (10 Tokens)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <td style={{ padding: '1.5rem' }}><span style={{ backgroundColor: '#222', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>Voters</span></td>
                <td style={{ padding: '1.5rem', color: 'var(--accent-green)' }}><span style={{ backgroundColor: 'var(--accent-green-dim)', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>Voting Escrow</span></td>
                <td style={{ padding: '1.5rem' }}>Vote (1 POLL each)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <td style={{ padding: '1.5rem' }}><span style={{ backgroundColor: '#222', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>Voting Escrow</span></td>
                <td style={{ padding: '1.5rem', color: 'var(--accent-green)' }}><span style={{ backgroundColor: 'var(--accent-green-dim)', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>Creator</span></td>
                <td style={{ padding: '1.5rem' }}>Finalize: earn SOL from tokens redemptions</td>
              </tr>
              <tr>
                <td style={{ padding: '1.5rem' }}><span style={{ backgroundColor: '#222', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>Proposal Escrow</span></td>
                <td style={{ padding: '1.5rem', color: 'var(--accent-green)' }}><span style={{ backgroundColor: 'var(--accent-green-dim)', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>Treasury</span></td>
                <td style={{ padding: '1.5rem' }}>Finalize: proposal token fee to treasury</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 
        ==============================
        ESCROW RULES
        ==============================
      */}
      <section className="container" style={{ marginTop: '8rem', marginBottom: '8rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem'
        }}>
          {/* Rule 1 */}
          <div className="card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', marginBottom: '1.5rem', color: '#3b82f6' }}>
              <Lock size={20} /> Proposal Escrow
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#3b82f6" style={{ marginTop: '3px' }}/> Creator stakes 10 POLL
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#3b82f6" style={{ marginTop: '3px' }}/> Locked on creation
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#3b82f6" style={{ marginTop: '3px' }}/> Released to Treasury on finalize
              </li>
            </ul>
          </div>

          {/* Rule 2 */}
          <div className="card" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', marginBottom: '1.5rem', color: '#a855f7' }}>
              <CheckCircle size={20} /> Voting Escrow
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#a855f7" style={{ marginTop: '3px' }}/> Each voter stakes 1 POLL
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#a855f7" style={{ marginTop: '3px' }}/> Accumulates per vote
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#a855f7" style={{ marginTop: '3px' }}/> Released to Creator on finalize
              </li>
            </ul>
          </div>

          {/* Rule 3 */}
          <div className="card" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', marginBottom: '1.5rem', color: '#eab308' }}>
              <RefreshCcw size={20} /> SOL Vault
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#eab308" style={{ marginTop: '3px' }}/> Stores SOL from purchases
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#eab308" style={{ marginTop: '3px' }}/> Used for POLL redemptions
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-dim)' }}>
                <CheckCircle size={16} color="#eab308" style={{ marginTop: '3px' }}/> 10% fee on all transactions
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 
        ==============================
        FINAL CTA
        ==============================
      */}
      {/* <section className="container">
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="text-dim font-mono text-sm tracking-wide" style={{ marginBottom: '2rem' }}>
            // READY TO START
          </div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, maxWidth: '1000px', marginBottom: '1.5rem' }}>
            "For example, if a user creates a proposal with 10 tokens and receives 2 votes..."
          </h2>
          <p className="text-dim" style={{ fontSize: '1.125rem', maxWidth: '800px', lineHeight: '1.6', marginBottom: '3rem' }}>
            Those voting tokens are collected in escrow and transferred to the creator upon finalization, while the proposal fee goes to the treasury.
          </p>
          <button className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.125rem' }}>
            <ArrowRight size={20} /> Enter App
          </button>
        </div>
      </section> */}

    </div>
  );
};

export default Landing;
