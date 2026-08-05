import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Base API URL pointing dynamically to API Gateway reverse proxy or local environment
const API_BASE = import.meta.env.VITE_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:8080' : '');


// Helper to decode JWT payload locally without external libraries
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function App() {
  // Authentication state
  const [auth, setAuth] = useState(null); // { accessToken, refreshToken, user: { username, email, role } }
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  
  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ token: '', newPassword: '', confirmPassword: '' });
  const [resetTokenForTesting, setResetTokenForTesting] = useState('');
  
  // UI states
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }
  const [testResult, setTestResult] = useState(null); // { type: 'success' | 'error', message: '' }
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Timer states (in seconds)
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(1); // avoid division by 0

  // Mock dashboard metric data that animates slightly
  const [mockSales, setMockSales] = useState(48259);
  const [mockVisitors, setMockVisitors] = useState(18492);
  const [barHeights, setBarHeights] = useState([40, 70, 55, 90]);

  // Timer reference to clear intervals cleanly
  const timerRef = useRef(null);

  // Trigger brief alert updates
  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // Check storage on mount to restore session
  useEffect(() => {
    const stored = localStorage.getItem('auth_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        restoreSession(session);
      } catch (e) {
        localStorage.removeItem('auth_session');
      }
    }

    // Tab Synchronization Event Listener
    const handleStorageChange = (e) => {
      if (e.key === 'auth_session') {
        if (!e.newValue) {
          // Logged out in another tab
          setAuth(null);
          setTimeLeft(0);
          showAlert('error', 'Session logged out from another tab.');
        } else {
          // Logged in or token refreshed in another tab
          const newSession = JSON.parse(e.newValue);
          restoreSession(newSession);
          showAlert('success', 'Session synchronized across tabs.');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Animate mock metrics on dashboard
    const metricsInterval = setInterval(() => {
      setMockSales(prev => prev + Math.floor(Math.random() * 50) - 20);
      setMockVisitors(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 4000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(metricsInterval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Restore state and setup timers
  const restoreSession = (session) => {
    setAuth(session);
    
    // Calculate remaining time for Access Token
    const jwtData = parseJwt(session.accessToken);
    if (jwtData && jwtData.exp) {
      const expTimeMs = jwtData.exp * 1000;
      const nowMs = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((expTimeMs - nowMs) / 1000));
      
      setTimeLeft(remainingSeconds);
      
      // Compute total duration (from iat to exp, or default to standard 15 minutes)
      const iat = jwtData.iat ? jwtData.iat * 1000 : nowMs;
      const duration = Math.max(1, Math.floor((expTimeMs - iat) / 1000));
      setTotalDuration(duration);

      startCountdown(remainingSeconds, duration);
    }
    
    // Auto fetch database users table
    fetchUsersFromDb();
  };

  // Start active session countdown timer
  const startCountdown = (initialTime, duration) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    let current = initialTime;
    timerRef.current = setInterval(() => {
      current -= 1;
      setTimeLeft(current);
      
      // Auto-trigger Silent Refresh when 10 seconds remain
      if (current === 10) {
        triggerSilentRefresh();
      }
      
      // Handle automatic timeout logout
      if (current <= 0) {
        clearInterval(timerRef.current);
        handleAutomaticLogout();
      }
    }, 1000);
  };

  // Trigger Silent Refresh endpoint
  const triggerSilentRefresh = async () => {
    if (!auth) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken })
      });

      if (response.ok) {
        const data = await response.json(); // { accessToken, refreshToken }
        
        // Extract user data from the new accessToken
        const jwtData = parseJwt(data.accessToken);
        const user = jwtData ? {
          username: jwtData.sub,
          role: jwtData.role ? jwtData.role.replace('ROLE_', '') : 'USER',
          email: auth.user.email
        } : auth.user;

        const updatedSession = { ...data, user };
        localStorage.setItem('auth_session', JSON.stringify(updatedSession));
        restoreSession(updatedSession);
        showAlert('success', 'Session silently refreshed! Access Token renewed.');
      } else {
        throw new Error('Refresh failed');
      }
    } catch (e) {
      showAlert('error', 'Session expired. Failed to refresh active tokens.');
      logout();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle automatic logout when session completes
  const handleAutomaticLogout = () => {
    setAuth(null);
    localStorage.removeItem('auth_session');
    showAlert('error', 'Active session expired. You have been automatically logged out.');
  };

  // Form handlers
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTestResult(null);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      if (response.ok) {
        const data = await response.json(); // { accessToken, refreshToken }
        
        // Parse user role and identity from JWT
        const jwtData = parseJwt(data.accessToken);
        const role = jwtData && jwtData.role ? jwtData.role.replace('ROLE_', '') : 'USER';
        
        // Mock email for dashboard context
        const email = `${loginForm.username.toLowerCase()}@enterprise.com`;
        
        const session = {
          ...data,
          user: { username: loginForm.username, email, role }
        };
        
        localStorage.setItem('auth_session', JSON.stringify(session));
        restoreSession(session);
        showAlert('success', `Welcome back, ${loginForm.username}! Login successful.`);
        setLoginForm({ username: '', password: '' });
      } else {
        const errorData = await response.json().catch(() => ({}));
        showAlert('error', errorData.message || 'Login failed. Invalid username or password.');
      }
    } catch (err) {
      showAlert('error', 'Cannot connect to backend server. Make sure the database is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });

      if (response.ok) {
        showAlert('success', 'Registration completed successfully! Please login.');
        setActiveTab('login');
        setRegisterForm({ username: '', email: '', password: '', role: 'USER' });
      } else {
        const errorData = await response.json().catch(() => ({}));
        showAlert('error', errorData.message || 'Registration failed. Username or email may exist.');
      }
    } catch (err) {
      showAlert('error', 'Server connection failed. Could not register.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);
    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        showAlert('success', 'Reset token generated successfully! For local testing, copy the token shown below.');
        setResetTokenForTesting(data.token || '');
        setResetForm({ token: data.token || '', newPassword: '', confirmPassword: '' });
        setActiveTab('reset-password');
        setForgotEmail('');
      } else {
        showAlert('error', data.message || 'Failed to request reset token. Verify your email.');
      }
    } catch (err) {
      showAlert('error', 'Cannot connect to backend server. Make sure it is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);
    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetForm)
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        showAlert('success', 'Password reset successfully! Please sign in with your new password.');
        setActiveTab('login');
        setResetForm({ token: '', newPassword: '', confirmPassword: '' });
        setResetTokenForTesting('');
      } else {
        showAlert('error', data.message || 'Password reset failed. Ensure passwords match and token is valid.');
      }
    } catch (err) {
      showAlert('error', 'Cannot connect to backend server. Make sure it is running.');
    } finally {
      setLoading(false);
    }
  };

  // Secure Server logout invalidating refresh token
  const logout = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (auth && auth.refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: auth.refreshToken })
        });
      } catch (e) {
        // network or server down, proceed with local logout
      }
    }

    setAuth(null);
    setTimeLeft(0);
    localStorage.removeItem('auth_session');
    showAlert('success', 'Logged out successfully. Tokens invalidated.');
  };

  // Database Users Table state
  const [dbUsers, setDbUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Fetch real users from MySQL database table
  const fetchUsersFromDb = async () => {
    if (!auth) return;
    setLoadingUsers(true);
    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${auth.accessToken}` }
      });
      if (response.ok) {
        const users = await response.json();
        setDbUsers(users);
      } else {
        showAlert('error', `Failed to fetch users table. Status: ${response.status}`);
      }
    } catch (e) {
      showAlert('error', 'Error fetching users from database.');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Simulate hits to REST API
  const testProtectedApi = async () => {
    if (!auth) return;
    setTestResult(null);
    try {
      const response = await fetch(`${API_BASE}/test/get/hello`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${auth.accessToken}` }
      });

      if (response.ok) {
        const text = await response.text();
        setTestResult({ type: 'success', message: `Status: 200 OK\nResponse: "${text}"` });
      } else if (response.status === 403) {
        setTestResult({ type: 'error', message: 'Status: 403 Forbidden\nAccess Denied: Requires ROLE_ADMIN authority.' });
      } else if (response.status === 401) {
        setTestResult({ type: 'error', message: 'Status: 401 Unauthorized\nAccess Denied: Invalid or expired Bearer token.' });
      } else {
        setTestResult({ type: 'error', message: `Status: ${response.status} Error\nRequest failed.` });
      }
    } catch (err) {
      setTestResult({ type: 'error', message: 'Failed to contact REST server.' });
    }
  };

  // Development Simulators
  const forceTokenExpire = () => {
    setTimeLeft(12); // set to 12s so user can visually witness the silent refresh kick in at 10s!
    startCountdown(12, totalDuration);
    showAlert('success', 'Simulation triggered: Access Token expiration set to 12 seconds.');
  };

  const forceBreakToken = () => {
    if (!auth) return;
    const brokenSession = { ...auth, accessToken: auth.accessToken + "break" };
    setAuth(brokenSession);
    showAlert('error', 'Simulation triggered: Access Token corrupted. Try hitting API.');
  };

  // Progress calculations
  const remainingPercent = Math.min(100, Math.max(0, (timeLeft / totalDuration) * 100));
  let barColorClass = '';
  if (remainingPercent < 20) barColorClass = 'critical';
  else if (remainingPercent < 50) barColorClass = 'warning';

  return (
    <div className="app-container">
      {/* Dynamic Navigation Bar */}
      <header className="navbar">
        <div className="logo">Security JWT & Microservices Hub</div>
        {auth && (
          <div className="nav-user">
            <div className="user-card">
              <div className="user-avatar">{auth.user.username[0].toUpperCase()}</div>
              <div className="user-details">
                <span className="user-name">{auth.user.username}</span>
                <span className="user-email">{auth.user.email}</span>
              </div>
            </div>
            <span className={`role-badge ${auth.user.role === 'ADMIN' ? 'admin' : ''}`}>
              {auth.user.role}
            </span>
            <button className="logout-btn" onClick={logout}>Sign Out</button>
          </div>
        )}
      </header>

      {/* Architecture & Topics Coverage Showcase Panel */}
      <div style={{ padding: '0 40px', marginTop: '20px' }}>
        <details className="glass-panel" style={{ padding: '16px 24px', borderRadius: '12px', cursor: 'pointer' }}>
          <summary style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--accent-cyan)', outline: 'none' }}>
            🛠️ Implemented Architecture & Cheat-Sheet Topics Showcase (Click to expand 70+ topics)
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px', fontSize: '0.85rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>⚡ Core Java & JVM (Java 21)</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#94a3b8' }}>
                <li>Java 21 Virtual Threads (Project Loom)</li>
                <li>HashMap internal buckets & Red-Black trees</li>
                <li>ConcurrentHashMap CAS & Bucket Locks</li>
                <li>equals() / hashCode() contract</li>
                <li>JVM Heap vs Stack & Metaspace</li>
                <li>G1 GC, ZGC & Garbage Collection</li>
                <li>ThreadLocal & Memory Leak safety</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #a855f7' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#a855f7' }}>🛡️ Spring Security & Auth</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#94a3b8' }}>
                <li>Spring Security Filter Chain & Proxies</li>
                <li>Stateless JWT Authentication & Claims</li>
                <li>Refresh Token rotation mechanism</li>
                <li>BCrypt Password Hashing</li>
                <li>Role-Based Authorization (@PreAuthorize)</li>
                <li>CORS & CSRF Security Policies</li>
                <li>Custom UserDetailsService & Handlers</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#10b981' }}>🌱 Spring Data JPA & DB</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#94a3b8' }}>
                <li>Spring Data JPA Repositories (No Hibernate API)</li>
                <li>Derived Query Methods & JPQL</li>
                <li>@Transactional Propagation & Rollbacks</li>
                <li>N+1 Query resolution with Fetch Joins</li>
                <li>Optimistic & Pessimistic DB Locking</li>
                <li>HikariCP DB Connection Pooling</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#f59e0b' }}>🌐 Microservices & Resilience</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#94a3b8' }}>
                <li>Spring Cloud Gateway (WebFlux Engine)</li>
                <li>Resilience4j Circuit Breakers & Fallbacks</li>
                <li>OpenTelemetry Distributed Tracing</li>
                <li>Spring AI + Google Gemini 1.5 Flash</li>
                <li>Idempotency Keys & Rate Limiting</li>
                <li>Reactive WebClient Downstream calls</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #ec4899' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#ec4899' }}>☁️ Docker, GCP & CI/CD</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#94a3b8' }}>
                <li>Multi-Stage Alpine Dockerfiles</li>
                <li>Google Artifact Registry Container Push</li>
                <li>GCP Cloud Run Serverless Containers</li>
                <li>GitHub Actions Automated CI/CD</li>
                <li>OWASP Top 10 Security Defenses</li>
              </ul>
            </div>
          </div>
        </details>
      </div>

      {/* Dynamic Alerts */}
      {alert && (
        <div style={{ padding: '0 40px', marginTop: '20px' }}>
          <div className={`alert alert-${alert.type}`}>
            <span>{alert.type === 'success' ? '✓' : '✗'}</span>
            <span>{alert.message}</span>
          </div>
        </div>
      )}

      {/* Main Pages */}
      {!auth ? (
        // Auth Pages: Register, Login, Forgot and Reset Password Forms
        <main className="auth-page">
          <div className="auth-card glass-panel">
            <div className="auth-header">
              <h2>
                {activeTab === 'login' && 'Welcome Back'}
                {activeTab === 'register' && 'Create Account'}
                {activeTab === 'forgot-password' && 'Forgot Password'}
                {activeTab === 'reset-password' && 'Reset Password'}
              </h2>
              <p>
                {activeTab === 'login' && 'Sign in to access your dashboard'}
                {activeTab === 'register' && 'Register a new profile for testing'}
                {activeTab === 'forgot-password' && 'Enter your email to request a reset token'}
                {activeTab === 'reset-password' && 'Choose a new password and submit your token'}
              </p>
            </div>

            {activeTab === 'login' && (
              <form className="auth-form" onSubmit={handleLoginSubmit}>
                <div className="form-group">
                  <label htmlFor="login-username">Username</label>
                  <input
                    type="text"
                    id="login-username"
                    className="glass-input"
                    placeholder="Enter username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="login-password">Password</label>
                  <input
                    type="password"
                    id="login-password"
                    className="glass-input"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                  <div style={{ textAlign: 'right', marginTop: '4px' }}>
                    <span 
                      className="auth-link" 
                      style={{ fontSize: '0.85rem' }} 
                      onClick={() => {
                        setActiveTab('forgot-password');
                        setAlert(null);
                      }}
                    >
                      Forgot Password?
                    </span>
                  </div>
                </div>
                <button type="submit" className="premium-btn" disabled={loading}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>Quick Fill Demo Accounts:</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', cursor: 'pointer' }}
                      onClick={() => setLoginForm({ username: 'admin', password: 'Admin123' })}
                    >
                      👑 Fill Admin
                    </button>
                    <button
                      type="button"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', cursor: 'pointer' }}
                      onClick={() => setLoginForm({ username: 'user', password: 'User123' })}
                    >
                      👤 Fill User
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeTab === 'register' && (
              <form className="auth-form" onSubmit={handleRegisterSubmit}>
                <div className="form-group">
                  <label htmlFor="reg-username">Username</label>
                  <input
                    type="text"
                    id="reg-username"
                    className="glass-input"
                    placeholder="Create username"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-email">Email Address</label>
                  <input
                    type="email"
                    id="reg-email"
                    className="glass-input"
                    placeholder="name@example.com"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-password">Password</label>
                  <input
                    type="password"
                    id="reg-password"
                    className="glass-input"
                    placeholder="••••••••"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-role">Account Privilege Role</label>
                  <select
                    id="reg-role"
                    className="glass-input"
                    value={registerForm.role}
                    onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}
                  >
                    <option value="USER">Standard User (ROLE_USER)</option>
                    <option value="ADMIN">Administrator (ROLE_ADMIN)</option>
                  </select>
                </div>
                <button type="submit" className="premium-btn" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Profile'}
                </button>
              </form>
            )}

            {activeTab === 'forgot-password' && (
              <form className="auth-form" onSubmit={handleForgotPasswordSubmit}>
                <div className="form-group">
                  <label htmlFor="forgot-email">Email Address</label>
                  <input
                    type="email"
                    id="forgot-email"
                    className="glass-input"
                    placeholder="name@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="premium-btn" disabled={loading}>
                  {loading ? 'Processing...' : 'Send Reset Token'}
                </button>
              </form>
            )}

            {activeTab === 'reset-password' && (
              <form className="auth-form" onSubmit={handleResetPasswordSubmit}>
                {resetTokenForTesting && (
                  <div className="test-api-result success" style={{ marginBottom: '10px', fontSize: '0.85rem' }}>
                    <strong>Testing Reset Token:</strong>
                    <div style={{ marginTop: '5px', wordBreak: 'break-all', userSelect: 'all' }}>
                      {resetTokenForTesting}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      (Auto-filled below for convenience)
                    </span>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="reset-token">Reset Token</label>
                  <input
                    type="text"
                    id="reset-token"
                    className="glass-input"
                    placeholder="Enter reset token"
                    value={resetForm.token}
                    onChange={(e) => setResetForm({ ...resetForm, token: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reset-password">New Password</label>
                  <input
                    type="password"
                    id="reset-password"
                    className="glass-input"
                    placeholder="••••••••"
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reset-confirm-password">Confirm Password</label>
                  <input
                    type="password"
                    id="reset-confirm-password"
                    className="glass-input"
                    placeholder="••••••••"
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="premium-btn" disabled={loading}>
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </form>
            )}

            <div className="auth-switch">
              {(activeTab === 'login' || activeTab === 'register') ? (
                activeTab === 'login' ? (
                  <span>
                    Don't have an account?{' '}
                    <span className="auth-link" onClick={() => { setActiveTab('register'); setAlert(null); }}>
                      Register here
                    </span>
                  </span>
                ) : (
                  <span>
                    Already registered?{' '}
                    <span className="auth-link" onClick={() => { setActiveTab('login'); setAlert(null); }}>
                      Sign in here
                    </span>
                  </span>
                )
              ) : (
                <span>
                  Go back to{' '}
                  <span className="auth-link" onClick={() => { setActiveTab('login'); setAlert(null); }}>
                    Sign in page
                  </span>
                </span>
              )}
            </div>
          </div>
        </main>
      ) : (
        // Dashboard Page with Visual Metrics and Expiry countdowns
        <main className="dashboard-container animate-slide-up">
          {/* Main Dashboard section */}
          <div className="dashboard-main">
            {/* Real-time Business Metrics Grid */}
            <div className="widgets-grid">
              <div className="widget-card glass-panel">
                <span className="widget-header">Weekly Sales</span>
                <span className="widget-value">${mockSales.toLocaleString()}</span>
                <span className="widget-desc">+12.4% compared to last week</span>
              </div>
              <div className="widget-card glass-panel cyan">
                <span className="widget-header">Active Users</span>
                <span className="widget-value">{mockVisitors.toLocaleString()}</span>
                <span className="widget-desc">Live visitors on the portal</span>
              </div>
              <div className="widget-card glass-panel emerald">
                <span className="widget-header">Conversion Rate</span>
                <span className="widget-value">4.85%</span>
                <span className="widget-desc">Optimized performance</span>
              </div>
            </div>

            {/* Performance charts mock */}
            <div className="stats-panel glass-panel">
              <div className="stats-header">
                <h3>Enterprise Activity Overview</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)' }}>● System Online</span>
              </div>
              <div className="stats-grid">
                <div className="stat-bar-container">
                  <div className="stat-bar-bg">
                    <div className="stat-bar-fill" style={{ height: `${barHeights[0]}%`, backgroundColor: 'var(--primary)' }}></div>
                  </div>
                  <span className="stat-bar-label">Database</span>
                </div>
                <div className="stat-bar-container">
                  <div className="stat-bar-bg">
                    <div className="stat-bar-fill" style={{ height: `${barHeights[1]}%`, backgroundColor: 'var(--accent-cyan)' }}></div>
                  </div>
                  <span className="stat-bar-label">API Gateway</span>
                </div>
                <div className="stat-bar-container">
                  <div className="stat-bar-bg">
                    <div className="stat-bar-fill" style={{ height: `${barHeights[2]}%`, backgroundColor: 'var(--accent-purple)' }}></div>
                  </div>
                  <span className="stat-bar-label">Auth Cache</span>
                </div>
                <div className="stat-bar-container">
                  <div className="stat-bar-bg">
                    <div className="stat-bar-fill" style={{ height: `${barHeights[3]}%`, backgroundColor: 'var(--accent-emerald)' }}></div>
                  </div>
                  <span className="stat-bar-label">Tomcat Load</span>
                </div>
              </div>
            </div>

            {/* Live Database Users Table Panel */}
            <div className="stats-panel glass-panel" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>MySQL Database Records (`users` table)</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                    Fetched directly from Spring Boot REST API <code>/api/users</code> using JWT Bearer token
                  </p>
                </div>
                <button 
                  className="premium-btn-secondary" 
                  style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem' }} 
                  onClick={fetchUsersFromDb}
                  disabled={loadingUsers}
                >
                  {loadingUsers ? 'Refreshing...' : '🔄 Refresh DB Table'}
                </button>
              </div>

              {dbUsers.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>
                        <th style={{ padding: '8px' }}>User ID</th>
                        <th style={{ padding: '8px' }}>Username</th>
                        <th style={{ padding: '8px' }}>Email Address</th>
                        <th style={{ padding: '8px' }}>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbUsers.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>#{u.id}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{u.username}</td>
                          <td style={{ padding: '8px' }}>{u.email}</td>
                          <td style={{ padding: '8px' }}>
                            <span className={`role-badge ${u.role === 'ADMIN' ? 'admin' : ''}`}>
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Click <strong>"Refresh DB Table"</strong> above to load live MySQL database user records.
                </div>
              )}
            </div>

            {/* REST API Sandbox */}
            <div className="stats-panel glass-panel">
              <h3>Role-Based Endpoint Sandbox</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Test permissions by hitting the protected API endpoint <code>/test/get/hello</code>. 
                This endpoint requires <strong>ROLE_ADMIN</strong>.
              </p>
              
              <div className="interactive-actions" style={{ marginTop: '5px' }}>
                <button className="premium-btn-secondary" onClick={testProtectedApi}>
                  Send REST GET Request to /test/get/hello
                </button>
              </div>

              {testResult && (
                <div className={`test-api-result ${testResult.type}`}>
                  <pre>{testResult.message}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Session Monitor panel (Visual timers, Decoded JWT tokens) */}
          <div className="session-panel glass-panel">
            <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              JWT Security Monitor
            </h3>

            <div className="session-status-container">
              <div className={`status-indicator ${isRefreshing ? 'refreshing' : timeLeft <= 0 ? 'expired' : ''}`}></div>
              <span className="session-status-text">
                {isRefreshing ? 'REFRESHING SESSION...' : timeLeft > 0 ? 'SESSION ACTIVE' : 'EXPIRED'}
              </span>
            </div>

            {/* Access Token Countdown Timer */}
            <div className="timer-section">
              <div className="timer-header">
                <span>Access Token Validity</span>
                <span>{timeLeft > 0 ? `${timeLeft}s left` : 'Expired'}</span>
              </div>
              <div className="progress-bar-bg">
                <div 
                  className={`progress-bar-fill ${barColorClass}`} 
                  style={{ width: `${remainingPercent}%` }}
                ></div>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Silent refresh triggers automatically when <strong>10s</strong> remain.
              </span>
            </div>

            {/* Local Token Explanations / Decoded Payloads */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                Decoded Access Token Payload (Sub & Role)
              </span>
              <div className="test-api-result">
                <pre>{JSON.stringify(parseJwt(auth.accessToken), null, 2)}</pre>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                Secure Refresh Token (UUID Reference)
              </span>
              <div className="test-api-result" style={{ background: 'rgba(255, 255, 255, 0.01)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                {auth.refreshToken}
              </div>
            </div>

            {/* Simulators */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                Simulation Playbook
              </span>
              <div className="action-row">
                <button className="premium-btn-secondary" style={{ fontSize: '0.8rem', padding: '10px 15px' }} onClick={forceTokenExpire}>
                  ⚡ Force Token Expiry (to 12s)
                </button>
                <button className="premium-btn-secondary" style={{ fontSize: '0.8rem', padding: '10px 15px', color: 'var(--accent-rose)', borderColor: 'rgba(255, 70, 100, 0.2)' }} onClick={forceBreakToken}>
                  ⚠️ Corrupt Token
                </button>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
