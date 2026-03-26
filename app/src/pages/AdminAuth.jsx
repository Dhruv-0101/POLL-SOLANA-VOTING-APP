import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setAdminAuthenticated } from '../store/appSlice';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const AdminAuth = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAdminAuthenticated = useSelector((state) => state.app.isAdminAuthenticated);

  useEffect(() => {
    if (isAdminAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdminAuthenticated, navigate]);

  const [username, setUsername] = useState('adminn');
  const [email, setEmail] = useState('adminn@gmail.com');
  const [password, setPassword] = useState('adminn1');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    setError(null);

    // Read from env file
    const envUser = import.meta.env.VITE_ADMIN_USERNAME;
    const envEmail = import.meta.env.VITE_ADMIN_EMAIL;
    const envPass = import.meta.env.VITE_ADMIN_PASSWORD;

    if (username === envUser && email === envEmail && password === envPass) {
      dispatch(setAdminAuthenticated(true));
      navigate('/admin/dashboard');
    } else {
      setError('Invalid credentials. Please verify your details and try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '6rem',
      backgroundColor: 'var(--bg-color)',
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255, 255, 255, 0.015) 4px, rgba(255, 255, 255, 0.015) 5px)',
      paddingBottom: '2rem'
    }}>
      <div style={{ width: '100%', maxWidth: '480px', padding: '0 1rem' }}>
        
        {/* Back navigation */}
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/" style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            color: 'var(--text-dim)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>

        {/* Title Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{
            backgroundColor: 'var(--accent-green-dim)',
            border: '1px solid var(--accent-green-border)',
            borderRadius: '0.75rem',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-green)'
          }}>
            <Shield size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Admin Access</h1>
            <div className="font-mono text-dim text-sm tracking-wide mt-1">POLL.SOL CONTROL PANEL</div>
          </div>
        </div>

        {/* Demo Credentials Box */}
        {/* <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
          <div className="font-mono text-sm" style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>
            // DEMO CREDENTIALS
          </div>
          <div className="font-mono text-sm" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div><span style={{ color: 'var(--text-dim)' }}>username:</span> <span className="text-green">admin123</span></div>
            <div><span style={{ color: 'var(--text-dim)' }}>email:</span> <span className="text-green">admin@mail.com</span></div>
            <div><span style={{ color: 'var(--text-dim)' }}>password:</span> <span className="text-green">123456</span></div>
          </div>
        </div> */}

        {/* Login Form */}
        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Username */}
            <div>
              <label className="font-mono text-dim text-sm tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Username
              </label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                style={{
                  width: '100%',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid var(--card-border)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  color: 'white',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--text-dim)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--card-border)'}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="font-mono text-dim text-sm tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Email
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                style={{
                  width: '100%',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid var(--card-border)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  color: 'white',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--text-dim)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--card-border)'}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="font-mono text-dim text-sm tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid var(--card-border)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    paddingRight: '3rem',
                    color: 'white',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--text-dim)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--card-border)'}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '-0.5rem' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '0.5rem' }}>
              <Shield size={18} /> ACCESS DASHBOARD
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
