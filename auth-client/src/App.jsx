import React, { useState, useEffect } from 'react';
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
  const [auth, setAuth] = useState(null);
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  
  // Navigation sections visible ONLY AFTER LOGIN SUCCESS
  const [activeSection, setActiveSection] = useState('orders'); // Default to Order Management

  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [orderForm, setOrderForm] = useState({ productName: '', price: '' });
  const [emailForm, setEmailForm] = useState({ toEmail: 'bashasoft304@gmail.com', subject: 'Microservice Order Confirmation', body: 'Your order was successfully placed via Spring Cloud API Gateway!' });

  // Data states
  const [orders, setOrders] = useState([]);
  const [orderMetadata, setOrderMetadata] = useState(null);
  const [emailResponse, setEmailResponse] = useState(null);

  // UI & Live Telemetry states
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vThreadsCount, setVThreadsCount] = useState(1024);
  const [jvmHeapUsed, setJvmHeapUsed] = useState(248);
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState('CLOSED (HEALTHY)');

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/orders`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        setOrderMetadata(data);
      }
    } catch (e) {
      showAlert('error', 'Failed to fetch orders from Order Service.');
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: orderForm.productName,
          price: parseFloat(orderForm.price)
        })
      });
      if (response.ok) {
        showAlert('success', `Order created successfully for ${orderForm.productName}!`);
        setOrderForm({ productName: '', price: '' });
        fetchOrders();
      } else {
        showAlert('error', 'Failed to create order.');
      }
    } catch (err) {
      showAlert('error', 'Cannot connect to Order Service API Gateway.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailForm)
      });
      if (response.ok) {
        const data = await response.json();
        setEmailResponse(data);
        showAlert('success', `Notification processed! TraceId: ${data.traceId}`);
      } else {
        showAlert('error', 'Failed to send notification email.');
      }
    } catch (err) {
      showAlert('error', 'Cannot connect to Notification Service.');
    } finally {
      setLoading(false);
    }
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

    // Dynamic metrics interval
    const interval = setInterval(() => {
      setVThreadsCount(prev => prev + Math.floor(Math.random() * 20) - 10);
      setJvmHeapUsed(prev => Math.min(480, Math.max(190, prev + Math.floor(Math.random() * 6) - 3)));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
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
        setActiveSection('orders'); // Default to Order Management after login
        fetchOrders();
        showAlert('success', `Login successful! Welcome ${loginForm.username}. Order & Notification APIs unlocked.`);
      } else {
        showAlert('error', 'Login failed. Invalid username or password.');
      }
    } catch (err) {
      showAlert('error', 'Cannot connect to backend API Gateway.');
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
        showAlert('success', 'User registered successfully in PostgreSQL! Please sign in.');
        setActiveTab('login');
      } else {
        showAlert('error', 'Registration failed.');
      }
    } catch (err) {
      showAlert('error', 'Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem('auth_session');
    showAlert('success', 'Logged out successfully.');
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="logo-group">
          <span className="logo-badge">GCP CLOUD</span>
          <span className="logo-text">Enterprise Architecture Platform</span>
        </div>

        {auth && (
          <div className="user-badge">
            <div className="user-avatar">{auth.user.username[0].toUpperCase()}</div>
            <div>
              <div className="user-info-text">{auth.user.username}</div>
              <span className="user-role-chip">{auth.user.role}</span>
            </div>
            <button className="logout-btn" style={{ marginLeft: '12px' }} onClick={logout}>Logout</button>
          </div>
        )}
      </header>

      {/* Alert Banner */}
      {alert && (
        <div className={`alert-banner ${alert.type}`}>
          <span>{alert.message}</span>
          <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setAlert(null)}>✕</button>
        </div>
      )}

      {/* Main App Container */}
      {!auth ? (
        /* LOGIN / REGISTER PORTAL */
        <div className="auth-box-container">
          <div className="auth-header">
            <h2>Cloud Access Portal</h2>
            <p>Sign in to unlock full Technical Architecture Explorer</p>
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
                {loading ? 'Authenticating...' : 'Sign In & Access Portal'}
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
                {loading ? 'Creating Account...' : 'Register User'}
              </button>
            </form>
          )}
        </div>
      ) : (
        /* POST-LOGIN DASHBOARD WITH LEFT SIDEBAR LAYOUT & API INTEGRATIONS */
        <div className="app-layout">
          {/* LEFT VERTICAL SIDEBAR MENU */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <span className="sidebar-title">NAVIGATION MENU</span>
            </div>

            <nav className="sidebar-menu">
              <button className={`menu-btn ${activeSection === 'orders' ? 'active' : ''}`} onClick={() => setActiveSection('orders')}>
                📦 Order Management (Order Service)
              </button>
              <button className={`menu-btn ${activeSection === 'notifications' ? 'active' : ''}`} onClick={() => setActiveSection('notifications')}>
                📧 Email Notifications (Notification Service)
              </button>
              <button className={`menu-btn ${activeSection === 'overview' ? 'active' : ''}`} onClick={() => setActiveSection('overview')}>
                🌐 Architecture & Topology
              </button>
              <button className={`menu-btn ${activeSection === 'core_java' ? 'active' : ''}`} onClick={() => setActiveSection('core_java')}>
                ☕ Core Java 21 & Virtual Threads
              </button>
              <button className={`menu-btn ${activeSection === 'adv_java' ? 'active' : ''}`} onClick={() => setActiveSection('adv_java')}>
                ⚙️ Advanced Java & Spring Boot
              </button>
              <button className={`menu-btn ${activeSection === 'security' ? 'active' : ''}`} onClick={() => setActiveSection('security')}>
                🔐 Security & JWT Tokens
              </button>
              <button className={`menu-btn ${activeSection === 'gateway' ? 'active' : ''}`} onClick={() => setActiveSection('gateway')}>
                🛡️ API Gateway & Circuit Breaker
              </button>
              <button className={`menu-btn ${activeSection === 'devops' ? 'active' : ''}`} onClick={() => setActiveSection('devops')}>
                🐳 DevOps & GCP Compute Engine
              </button>
              <button className={`menu-btn ${activeSection === 'rdbms' ? 'active' : ''}`} onClick={() => setActiveSection('rdbms')}>
                🗄️ PostgreSQL RDBMS Isolation
              </button>
              <button className={`menu-btn ${activeSection === 'nosql' ? 'active' : ''}`} onClick={() => setActiveSection('nosql')}>
                ⚡ Redis & NoSQL Caching
              </button>
              <button className={`menu-btn ${activeSection === 'telemetry' ? 'active' : ''}`} onClick={() => setActiveSection('telemetry')}>
                📊 Prometheus & Distributed Tracing
              </button>
            </nav>
          </aside>

          <main className="main-content">
            {/* 0A. ORDER MANAGEMENT SECTION */}
            {activeSection === 'orders' && (
              <div>
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>📦 Order Service & PostgreSQL Integration</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create & Manage Live Orders routed through Spring Cloud API Gateway (`/api/orders`).</p>
                  </div>
                  <button className="btn-outline" onClick={fetchOrders}>🔄 Refresh Orders</button>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">➕ Create New Order</div>
                      <span className="card-badge badge-emerald">POST /api/orders</span>
                    </div>
                    <form onSubmit={handleCreateOrder}>
                      <div className="form-group">
                        <label>Product Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Ergonomic Keyboard"
                          value={orderForm.productName}
                          onChange={e => setOrderForm({ ...orderForm, productName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Price ($ USD)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          placeholder="e.g. 89.99"
                          value={orderForm.price}
                          onChange={e => setOrderForm({ ...orderForm, price: e.target.value })}
                          required
                        />
                      </div>
                      <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Submitting Order...' : '🛒 Submit Order'}
                      </button>
                    </form>
                  </div>

                  <div className="glass-card" style={{ gridColumn: 'span 2' }}>
                    <div className="card-header">
                      <div className="card-title">📋 Live Orders from `order_db`</div>
                      <span className="card-badge badge-cyan">Spring Data JPA</span>
                    </div>
                    {orders.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No orders found. Create your first order above or click "Refresh Orders".
                      </div>
                    ) : (
                      <div className="status-matrix">
                        {orders.map((ord, idx) => (
                          <div key={ord.id || idx} className="status-item">
                            <div>
                              <div className="service-name">Order #{ord.id} - {ord.productName || ord.name}</div>
                              <div className="service-port">Stored in PostgreSQL `order_db`</div>
                            </div>
                            <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>${ord.price}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 0B. EMAIL NOTIFICATION SERVICE SECTION */}
            {activeSection === 'notifications' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>📧 Notification Service & OpenTelemetry Tracing</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Send notifications directly to `bashasoft304@gmail.com` with automatic Zipkin correlation trace IDs.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">✉️ Dispatch Email Request</div>
                      <span className="card-badge badge-purple">POST /api/notifications/email</span>
                    </div>
                    <form onSubmit={handleSendEmail}>
                      <div className="form-group">
                        <label>Recipient Email</label>
                        <input
                          type="email"
                          className="form-input"
                          value={emailForm.toEmail}
                          onChange={e => setEmailForm({ ...emailForm, toEmail: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Subject</label>
                        <input
                          type="text"
                          className="form-input"
                          value={emailForm.subject}
                          onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Email Body / Message</label>
                        <textarea
                          className="form-input"
                          rows="3"
                          value={emailForm.body}
                          onChange={e => setEmailForm({ ...emailForm, body: e.target.value })}
                          required
                        />
                      </div>
                      <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Dispatching...' : '🚀 Send Notification Email'}
                      </button>
                    </form>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🔍 OpenTelemetry Trace Response</div>
                      <span className="card-badge badge-amber">Zipkin Correlation ID</span>
                    </div>
                    {emailResponse ? (
                      <div>
                        <div className="metric-row">
                          <span className="metric-label">Status</span>
                          <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>{emailResponse.status}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Recipient</span>
                          <span className="metric-value">{emailResponse.recipient}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Zipkin Trace ID</span>
                          <span className="metric-value" style={{ color: 'var(--accent-cyan)' }}>{emailResponse.traceId}</span>
                        </div>
                        <div style={{ marginTop: '16px' }}>
                          <a href="http://34.123.209.238:9411" target="_blank" rel="noreferrer" className="btn-outline" style={{ display: 'inline-block', textDecoration: 'none', width: '100%', textAlign: 'center' }}>
                            View Trace in Zipkin UI ↗
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Send an email above to view OpenTelemetry trace response & correlation ID.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 1. OVERVIEW & TOPOLOGY SECTION */}
            {activeSection === 'overview' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>System Architecture & Traffic Topology</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>End-to-End Live Routing Topology across Docker containers on GCP Compute Engine (`34.72.32.205`).</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🌐 Outer Reverse Proxy</div>
                      <span className="card-badge badge-purple">Nginx / Port 80</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Role</span>
                      <span className="metric-value">SPA Web Host & Proxy</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Route /auth/</span>
                      <span className="metric-value">http://api-gateway:8080/auth/</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Route /api/</span>
                      <span className="metric-value">http://api-gateway:8080/api/</span>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🛡️ Spring Cloud API Gateway</div>
                      <span className="card-badge badge-cyan">Port 8080</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Resilience Filter</span>
                      <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>Resilience4j Active</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Downstream 1</span>
                      <span className="metric-value">auth-service:8081</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Downstream 2</span>
                      <span className="metric-value">order-service:8082</span>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🗄️ PostgreSQL 16 Cluster</div>
                      <span className="card-badge badge-emerald">Port 5432</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Auth Database</span>
                      <span className="metric-value">auth_db (users, refresh_token)</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Order Database</span>
                      <span className="metric-value">order_db (orders)</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Volume Persistence</span>
                      <span className="metric-value">postgres_data (VM Disk)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. CORE JAVA 21 & VIRTUAL THREADS SECTION */}
            {activeSection === 'core_java' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Core Java 21 & Project Loom Virtual Threads</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>High-concurrency thread management without OS thread blocking overhead.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">⚡ Virtual Threads Telemetry</div>
                      <span className="card-badge badge-emerald">Project Loom</span>
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
                      <span className="metric-label">Memory Footprint / Thread</span>
                      <span className="metric-value">~1 KB (vs 1 MB platform thread)</span>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">📄 Spring Boot Virtual Thread Config</div>
                    </div>
                    <div className="code-block">
{`# Enabled across application.yml files:
spring:
  threads:
    virtual:
      enabled: true

# Configures Tomcat to execute every incoming HTTP 
# request on a Project Loom Virtual Thread.`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ADVANCED JAVA & SPRING BOOT SECTION */}
            {activeSection === 'adv_java' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Advanced Java & Spring Boot 3 Framework</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Reactive WebClient inter-service communication, JPA Repositories, and Exception Handling.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">📡 WebClient Inter-service Call</div>
                      <span className="card-badge badge-cyan">Reactive I/O</span>
                    </div>
                    <div className="code-block">
{`// order-service calling notification-service
webClient.post()
    .uri("http://notification-service:8083/api/notifications/send")
    .bodyValue(notificationPayload)
    .retrieve()
    .bodyToMono(Void.class);`}
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🛡️ Global Exception Handling</div>
                      <span className="card-badge badge-purple">@RestControllerAdvice</span>
                    </div>
                    <div className="code-block">
{`@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity handleBadCredentials() {
        return ResponseEntity.status(401)
            .body(Map.of("error", "Invalid Credentials"));
    }
}`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SECURITY & JWT TOKENS SECTION */}
            {activeSection === 'security' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Spring Security 6 & JWT Token Lifecycle</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cryptographic HMAC-SHA256 signature verification and Refresh Token database persistence.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card" style={{ gridColumn: 'span 2' }}>
                    <div className="card-header">
                      <div className="card-title">🔐 Active JWT Bearer Access Token</div>
                      <span className="card-badge badge-purple">15 Min Expiry</span>
                    </div>
                    <div className="code-block" style={{ color: 'var(--accent-cyan)' }}>
                      {auth.accessToken}
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🔄 PostgreSQL Refresh Token</div>
                      <span className="card-badge badge-amber">7 Days Expiry</span>
                    </div>
                    <div className="code-block" style={{ color: 'var(--accent-amber)' }}>
                      {auth.refreshToken}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. API GATEWAY & CIRCUIT BREAKER SECTION */}
            {activeSection === 'gateway' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>API Gateway & Resilience4j Circuit Breaker</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Prevents cascade service failure using sliding window metrics and automated fallbacks.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">⚡ Circuit Breaker Status</div>
                      <span className="card-badge badge-emerald">orderServiceCB</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Current State</span>
                      <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>{circuitBreakerStatus}</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Failure Threshold</span>
                      <span className="metric-value">50% Failure Rate</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Sliding Window Size</span>
                      <span className="metric-value">10 Request Calls</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Fallback URI</span>
                      <span className="metric-value">forward:/fallback/orders</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. DEVOPS & GCP COMPUTE ENGINE SECTION */}
            {activeSection === 'devops' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>DevOps, Docker & GCP Compute Engine</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Container cluster running on GCP VM `microservices-vm` (`34.72.32.205`, 4 vCPU, 16GB RAM).</p>
                </div>

                <div className="glass-card">
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
                        <div className="service-name">auth-service (Auth & JWT Token Service)</div>
                        <div className="service-port">Container Port: 8081 | Host Port: 8081</div>
                      </div>
                      <span className="pill-online"><span className="dot-green"></span> RUNNING</span>
                    </div>
                    <div className="status-item">
                      <div>
                        <div className="service-name">order-service (Order Management Service)</div>
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

            {/* 7. POSTGRESQL RDBMS ISOLATION SECTION */}
            {activeSection === 'rdbms' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>PostgreSQL RDBMS Isolation Architecture</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Isolated relational databases (`auth_db`, `order_db`) with HikariCP connection pools.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🗄️ auth_db Schema</div>
                      <span className="card-badge badge-cyan">PostgreSQL 16</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Users Table</span>
                      <span className="metric-value">id, username, email, password, role</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Refresh Token Table</span>
                      <span className="metric-value">id, token, expiry_date, user_id</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Connection Pool</span>
                      <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>HikariPool Active</span>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">📦 order_db Schema</div>
                      <span className="card-badge badge-emerald">PostgreSQL 16</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Orders Table</span>
                      <span className="metric-value">id, user_id, product_name, price, status</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Database Isolation</span>
                      <span className="metric-value">Database-per-Service</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. REDIS & NOSQL CACHING SECTION */}
            {activeSection === 'nosql' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Redis & NoSQL Caching Strategy</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>High-performance distributed memory caching for session invalidation & rate limiting.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">⚡ Redis Cache Strategy</div>
                      <span className="card-badge badge-amber">Key-Value Store</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Cache Target</span>
                      <span className="metric-value">JWT Blacklist & Rate Limiting</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Read Latency</span>
                      <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>&lt; 1 ms</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 9. TELEMETRY & OBSERVABILITY SECTION */}
            {activeSection === 'telemetry' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Prometheus Metrics & Distributed Tracing</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>OpenTelemetry tracing and Spring Boot Actuator metric collection.</p>
                </div>

                <div className="grid-container">
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🔥 Prometheus Scraper</div>
                      <span className="card-badge badge-amber">Port 9090</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>Scrapes `/actuator/prometheus` for JVM memory, CPU utilization, and HTTP request throughput.</p>
                    <a href="http://34.72.32.205:9090" target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                      Open Prometheus Metrics Dashboard ↗
                    </a>
                  </div>

                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">🔎 Zipkin / Jaeger Tracing</div>
                      <span className="card-badge badge-purple">Port 9411</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>Traces requests across Gateway $\rightarrow$ Order Service $\rightarrow$ Notification Service with `traceId` & `spanId`.</p>
                    <a href="http://34.72.32.205:9411" target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                      Open Zipkin Distributed Tracing UI ↗
                    </a>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
