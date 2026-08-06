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
  const [navSection, setNavSection] = useState('topology'); // 'topology' | 'java' | 'security' | 'devops' | 'database' | 'observability'

  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', role: 'USER' });

  // UI states
  const [alert, setAlert] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbUsers, setDbUsers] = useState([]);

  // Telemetry metrics
  const [vThreadsCount, setVThreadsCount] = useState(1024);
  const [jvmHeapUsed, setJvmHeapUsed] = useState(248);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  useEffect(() => {
    const stored = localStorage.getItem('auth_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        setAuth(session);
      } catch (e) {
        localStorage.removeItem('auth_session');
      }
    }

    // Animate telemetry data
    const interval = setInterval(() => {
      setVThreadsCount(prev => prev + Math.floor(Math.random() * 20) - 10);
      setJvmHeapUsed(prev => Math.min(450, Math.max(180, prev + Math.floor(Math.random() * 8) - 4)));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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
        const data = await response.json();
        const jwtData = parseJwt(data.accessToken);
        const role = jwtData && jwtData.role ? jwtData.role.replace('ROLE_', '') : 'USER';
        const session = {
          ...data,
          user: { username: loginForm.username, email: `${loginForm.username}@enterprise.com`, role }
        };
        localStorage.setItem('auth_session', JSON.stringify(session));
        setAuth(session);
        showAlert('success', `Authentication successful! Welcome back ${loginForm.username}.`);
      } else {
        showAlert('error', 'Login failed. Invalid username or password.');
      }
    } catch (err) {
      showAlert('error', 'Network error. Verify API Gateway is online.');
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
        showAlert('success', 'User registered in PostgreSQL database! Please login.');
        setActiveTab('login');
      } else {
        showAlert('error', 'Registration failed. User may already exist.');
      }
    } catch (err) {
      showAlert('error', 'Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersFromDb = async () => {
    if (!auth) return;
    try {
      const response = await fetch(`${API_BASE}/auth/users`, {
        headers: { 'Authorization': `Bearer ${auth.accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDbUsers(data);
      }
    } catch (e) {
      // Fallback display
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem('auth_session');
    showAlert('success', 'Logged out successfully.');
  };

  return (
    <div className="app-container">
      {/* Glassmorphism Header */}
      <header className="navbar">
        <div className="logo-group">
          <span className="logo-badge">GCP CLOUD</span>
          <span className="logo-text">Enterprise Microservices Dashboard</span>
        </div>

        {auth && (
          <div className="nav-tabs">
            <button className={`nav-tab-btn ${navSection === 'topology' ? 'active' : ''}`} onClick={() => setNavSection('topology')}>
              🌐 Topology
            </button>
            <button className={`nav-tab-btn ${navSection === 'java' ? 'active' : ''}`} onClick={() => setNavSection('java')}>
              ☕ Core & Adv Java
            </button>
            <button className={`nav-tab-btn ${navSection === 'security' ? 'active' : ''}`} onClick={() => setNavSection('security')}>
              🔐 Security & JWT
            </button>
            <button className={`nav-tab-btn ${navSection === 'devops' ? 'active' : ''}`} onClick={() => setNavSection('devops')}>
              🐳 DevOps & GCP
            </button>
            <button className={`nav-tab-btn ${navSection === 'database' ? 'active' : ''}`} onClick={() => setNavSection('database')}>
              🗄️ PostgreSQL
            </button>
            <button className={`nav-tab-btn ${navSection === 'observability' ? 'active' : ''}`} onClick={() => setNavSection('observability')}>
              📊 Telemetry
            </button>
          </div>
        )}

        {auth && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="user-badge">
              <div className="user-avatar">{auth.user.username[0].toUpperCase()}</div>
              <div>
                <div className="user-info-text">{auth.user.username}</div>
                <span className="user-role-chip">{auth.user.role}</span>
              </div>
            </div>
            <button className="logout-btn" onClick={logout}>Logout</button>
          </div>
        )}
      </header>

      {/* Alert Notification */}
      {alert && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.message}</span>
          <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setAlert(null)}>✕</button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="main-content">
        {!auth ? (
          <div className="auth-box-container">
            <div className="auth-header">
              <h2>Cloud Access Portal</h2>
              <p>Spring Security JWT & PostgreSQL Microservices Stack</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
              <button 
                className={`btn-${activeTab === 'login' ? 'primary' : 'outline'}`} 
                style={{ flex: 1 }}
                onClick={() => setActiveTab('login')}
              >
                Sign In
              </button>
              <button 
                className={`btn-${activeTab === 'register' ? 'primary' : 'outline'}`} 
                style={{ flex: 1 }}
                onClick={() => setActiveTab('register')}
              >
                Register
              </button>
            </div>

            {activeTab === 'login' ? (
              <form onSubmit={handleLoginSubmit}>
                <div className="form-group">
                  <label>Username</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. admin" 
                    value={loginForm.username}
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="••••••••" 
                    value={loginForm.password}
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                    required 
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
                  {loading ? 'Authenticating...' : 'Authenticate'}
                </button>
                <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                  Default Credentials: <code>admin</code> / <code>Admin123</code>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit}>
                <div className="form-group">
                  <label>Username</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter username" 
                    value={registerForm.username}
                    onChange={e => setRegisterForm({...registerForm, username: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="user@enterprise.com" 
                    value={registerForm.email}
                    onChange={e => setRegisterForm({...registerForm, email: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Create password" 
                    value={registerForm.password}
                    onChange={e => setRegisterForm({...registerForm, password: e.target.value})}
                    required 
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div>
            {/* TOPOLOGY TAB */}
            {navSection === 'topology' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Microservices System Architecture & Routing</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Live traffic flow from Nginx Client Reverse Proxy through Spring Cloud API Gateway down to isolation domain databases.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🌐 API Gateway Router</div>
                      <span className="card-badge badge-purple">Port 8080</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Gateway Framework</span>
                      <span className="metric-value">Spring Cloud Gateway</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Circuit Breaker</span>
                      <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>Resilience4j ACTIVE</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Route 1 (/auth/**)</span>
                      <span className="metric-value">auth-service:8081</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Route 2 (/api/orders/**)</span>
                      <span className="metric-value">order-service:8082</span>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🔑 Auth Service</div>
                      <span className="card-badge badge-cyan">Port 8081</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Authentication</span>
                      <span className="metric-value">Spring Security 6</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Token Signing</span>
                      <span className="metric-value">HMAC-SHA256 (256-bit)</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Database Target</span>
                      <span className="metric-value">PostgreSQL (auth_db)</span>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">📦 Order Service</div>
                      <span className="card-badge badge-emerald">Port 8082</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Domain Logic</span>
                      <span className="metric-value">Spring Data JPA</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Client Call</span>
                      <span className="metric-value">WebClient Reactive</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Database Target</span>
                      <span className="metric-value">PostgreSQL (order_db)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* JAVA 21 & VIRTUAL THREADS TAB */}
            {navSection === 'java' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Java 21 LTS & Project Loom Runtime</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>High-throughput lightweight Virtual Threads enabled across Spring Boot 3 endpoints.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">⚡ Project Loom Telemetry</div>
                      <span className="card-badge badge-emerald">Virtual Threads</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Active Virtual Threads</span>
                      <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>{vThreadsCount}</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Carrier OS Threads</span>
                      <span className="metric-value">4 Threads (1 per vCPU)</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">JVM Heap Used</span>
                      <span className="metric-value">{jvmHeapUsed} MB / 512 MB</span>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">📄 Virtual Threads Configuration</div>
                    </div>
                    <div className="code-block">
{`# application.yml
spring:
  threads:
    virtual:
      enabled: true

# Enables Project Loom lightweight thread executor
# for concurrent I/O requests without OS blocking.`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECURITY & JWT TAB */}
            {navSection === 'security' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Spring Security 6 & JWT Token Inspector</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cryptographic token analysis and stateful refresh token persistence in PostgreSQL.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card" style={{ gridColumn: 'span 2' }}>
                    <div className="card-header">
                      <div className="card-title">🔐 Active Bearer Access Token</div>
                      <span className="card-badge badge-purple">HMAC-SHA256</span>
                    </div>
                    <div className="code-block" style={{ color: 'var(--accent-cyan)' }}>
                      {auth.accessToken}
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🔄 DB Refresh Token</div>
                      <span className="card-badge badge-amber">7 Days Expiry</span>
                    </div>
                    <div className="code-block" style={{ color: 'var(--accent-amber)' }}>
                      {auth.refreshToken}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DEVOPS & GCP TAB */}
            {navSection === 'devops' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>DevOps, GCP Compute Engine & Docker Cluster</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Container orchestrations deployed on Google Cloud Platform (`34.72.32.205`).</p>
                </div>

                <div className="glass-card" style={{ marginBottom: '24px' }}>
                  <div className="card-header">
                    <div className="card-title">🐳 Docker Container Cluster Status</div>
                    <span className="card-badge badge-emerald">8 Containers Online</span>
                  </div>

                  <div className="status-matrix">
                    <div className="status-item">
                      <div>
                        <div className="service-name">auth-client (React Web UI + Nginx Reverse Proxy)</div>
                        <div className="service-port">Container Port: 8080 | Host Port: 80</div>
                      </div>
                      <span className="pill-online"><span className="dot-green"></span> RUNNING</span>
                    </div>

                    <div className="status-item">
                      <div>
                        <div className="service-name">api-gateway (Spring Cloud Gateway)</div>
                        <div className="service-port">Container Port: 8080 | Host Port: 8080</div>
                      </div>
                      <span className="pill-online"><span className="dot-green"></span> RUNNING</span>
                    </div>

                    <div className="status-item">
                      <div>
                        <div className="service-name">postgres-db (PostgreSQL 16 Engine)</div>
                        <div className="service-port">Container Port: 5432 | Host Port: 5432</div>
                      </div>
                      <span className="pill-online"><span className="dot-green"></span> RUNNING</span>
                    </div>

                    <div className="status-item">
                      <div>
                        <div className="service-name">auth-service (Authentication Microservice)</div>
                        <div className="service-port">Container Port: 8081 | Host Port: 8081</div>
                      </div>
                      <span className="pill-online"><span className="dot-green"></span> RUNNING</span>
                    </div>

                    <div className="status-item">
                      <div>
                        <div className="service-name">order-service (Order Management Microservice)</div>
                        <div className="service-port">Container Port: 8082 | Host Port: 8082</div>
                      </div>
                      <span className="pill-online"><span className="dot-green"></span> RUNNING</span>
                    </div>

                    <div className="status-item">
                      <div>
                        <div className="service-name">notification-service (Email & Tracing Service)</div>
                        <div className="service-port">Container Port: 8083 | Host Port: 8083</div>
                      </div>
                      <span className="pill-online"><span className="dot-green"></span> RUNNING</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DATABASE & POSTGRESQL TAB */}
            {navSection === 'database' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Database & Persistence (RDBMS PostgreSQL 16)</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Isolated relational database contexts (`auth_db`, `order_db`) with HikariCP connection pooling.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🗄️ auth_db Schema</div>
                      <span className="card-badge badge-cyan">PostgreSQL</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Target Table 1</span>
                      <span className="metric-value">users (id, username, email, password, role)</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Target Table 2</span>
                      <span className="metric-value">refresh_token (id, token, expiry_date, user_id)</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Connection Pool</span>
                      <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>HikariPool-1 ACTIVE</span>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">📦 order_db Schema</div>
                      <span className="card-badge badge-emerald">PostgreSQL</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Target Table</span>
                      <span className="metric-value">orders (id, user_id, product_name, price, status)</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Isolation Pattern</span>
                      <span className="metric-value">Database-per-Service</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TELEMETRY & OBSERVABILITY TAB */}
            {navSection === 'observability' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Observability, Prometheus Metrics & Distributed Tracing</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time telemetry collectors integrated across all Spring Boot 3 Actuator endpoints.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🔥 Prometheus Scraper</div>
                      <span className="card-badge badge-amber">Port 9090</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>Scrapes `/actuator/prometheus` metrics for request count, latency histogram, and JVM garbage collection.</p>
                    <a href="http://34.72.32.205:9090" target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                      Launch Prometheus Dashboard ↗
                    </a>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🔎 Zipkin / Jaeger Tracing</div>
                      <span className="card-badge badge-purple">Port 9411</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>Tracks end-to-end distributed transaction spans across API Gateway, Order Service, and Notification Service.</p>
                    <a href="http://34.72.32.205:9411" target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                      Launch Zipkin Tracing UI ↗
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
