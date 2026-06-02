import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import api from '../api';

const NAV_LINKS = [
  { to: '/',        label: 'Dashboard', icon: '▦' },
  { to: '/kyc',     label: 'KYC',       icon: '◈' },
  { to: '/chat',    label: 'Chat',      icon: '◎' },
  { to: '/graph',   label: 'Network',   icon: '⬡' },
  { to: '/profile', label: 'Profile',   icon: '◉' },
];

export default function Navbar() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const [role, setRole]   = useState('');
  const [open, setOpen]   = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const drawerRef         = useRef(null);

  const isAuth = !!localStorage.getItem('access_token');

  // Отслеживаем ширину окна
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Закрываем меню при смене роута
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Закрываем меню по клику вне
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (isAuth) {
      api.get('/auth/me').then(r => setRole(r.data.role)).catch(() => {});
    }
  }, [isAuth]);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const isMobile  = width < 768;
  const isActive  = (path) => location.pathname === path;

  const allLinks = [
    ...NAV_LINKS,
    ...(role === 'ADMIN' ? [{ to: '/admin', label: 'Admin', icon: '♛', admin: true }] : []),
  ];

  return (
    <>
      <style>{css}</style>
      <nav className="lf-nav">
        <div className="lf-inner">

          {/* Лого */}
          <Link to="/" className="lf-brand">
            <span className="lf-brand-hex">⬡</span>
            <span className="lf-brand-text">Liberty<em>Finance</em></span>
          </Link>

          {/* Desktop links */}
          {isAuth && !isMobile && (
            <div className="lf-links">
              {allLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`lf-link${isActive(link.to) ? ' lf-link--active' : ''}${link.admin ? ' lf-link--admin' : ''}`}
                >
                  <span className="lf-link-icon">{link.icon}</span>
                  {link.label}
                  {isActive(link.to) && <span className="lf-link-dot" />}
                </Link>
              ))}
            </div>
          )}

          {/* Right zone */}
          <div className="lf-right">
            {isAuth ? (
              <>
                {!isMobile && (
                  <button onClick={logout} className="lf-logout">
                    Sign out
                  </button>
                )}
                {isMobile && (
                  <button
                    className={`lf-burger${open ? ' lf-burger--open' : ''}`}
                    onClick={() => setOpen(o => !o)}
                    aria-label="Menu"
                  >
                    <span /><span /><span />
                  </button>
                )}
              </>
            ) : (
              <div className="lf-auth-links">
                <Link to="/login"    className="lf-link">Login</Link>
                <Link to="/register" className="lf-register">Register</Link>
              </div>
            )}
          </div>

        </div>

        {/* Mobile drawer */}
        {isMobile && open && isAuth && (
          <div className="lf-drawer" ref={drawerRef}>
            {allLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`lf-drawer-link${isActive(link.to) ? ' lf-drawer-link--active' : ''}${link.admin ? ' lf-drawer-link--admin' : ''}`}
              >
                <span className="lf-drawer-icon">{link.icon}</span>
                {link.label}
              </Link>
            ))}
            <button onClick={logout} className="lf-drawer-logout">Sign out</button>
          </div>
        )}
      </nav>
    </>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital@0;1&family=Syne:wght@600;700&display=swap');

  .lf-nav {
    background: #070d1a;
    border-bottom: 1px solid rgba(56, 189, 248, 0.12);
    position: sticky;
    top: 0;
    z-index: 100;
    font-family: 'Syne', sans-serif;
  }

  .lf-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 28px;
    height: 58px;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* Brand */
  .lf-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    flex-shrink: 0;
  }
  .lf-brand-hex {
    font-size: 22px;
    color: #38bdf8;
    line-height: 1;
    filter: drop-shadow(0 0 6px rgba(56,189,248,0.5));
    animation: lf-pulse 3s ease-in-out infinite;
  }
  @keyframes lf-pulse {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(56,189,248,0.5)); }
    50%       { filter: drop-shadow(0 0 12px rgba(56,189,248,0.9)); }
  }
  .lf-brand-text {
    font-size: 17px;
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: -0.01em;
  }
  .lf-brand-text em {
    font-style: normal;
    color: #38bdf8;
    margin-left: 1px;
  }

  /* Desktop nav links */
  .lf-links {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
    justify-content: center;
  }

  .lf-link {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    color: #64748b;
    text-decoration: none;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: color 0.15s, background 0.15s;
  }
  .lf-link:hover {
    color: #cbd5e1;
    background: rgba(255,255,255,0.04);
  }
  .lf-link--active {
    color: #f1f5f9;
    background: rgba(56,189,248,0.08);
  }
  .lf-link--admin {
    color: #fbbf24;
  }
  .lf-link--admin:hover {
    color: #fde68a;
    background: rgba(251,191,36,0.08);
  }
  .lf-link-icon {
    font-size: 14px;
    opacity: 0.7;
  }
  .lf-link-dot {
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 2px;
    background: #38bdf8;
    border-radius: 2px;
  }

  /* Right zone */
  .lf-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .lf-auth-links {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lf-logout {
    padding: 7px 18px;
    background: transparent;
    border: 1px solid rgba(239,68,68,0.4);
    border-radius: 8px;
    color: #f87171;
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    letter-spacing: 0.01em;
  }
  .lf-logout:hover {
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.7);
  }
  .lf-register {
    padding: 7px 18px;
    background: #38bdf8;
    border-radius: 8px;
    color: #070d1a;
    text-decoration: none;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.01em;
    transition: opacity 0.15s;
  }
  .lf-register:hover { opacity: 0.88; }

  /* Burger button */
  .lf-burger {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 36px;
    height: 36px;
    padding: 8px;
    background: transparent;
    border: 1px solid #1e293b;
    border-radius: 8px;
    cursor: pointer;
  }
  .lf-burger span {
    display: block;
    height: 1.5px;
    background: #94a3b8;
    border-radius: 2px;
    transition: transform 0.2s, opacity 0.2s;
    transform-origin: center;
  }
  .lf-burger--open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
  .lf-burger--open span:nth-child(2) { opacity: 0; }
  .lf-burger--open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

  /* Mobile drawer */
  .lf-drawer {
    background: #0a1628;
    border-top: 1px solid #1e293b;
    padding: 16px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: lf-slide-down 0.2s ease;
  }
  @keyframes lf-slide-down {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .lf-drawer-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    border-radius: 10px;
    color: #64748b;
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
    transition: color 0.15s, background 0.15s;
  }
  .lf-drawer-link:hover { color: #cbd5e1; background: rgba(255,255,255,0.04); }
  .lf-drawer-link--active { color: #f1f5f9; background: rgba(56,189,248,0.08); }
  .lf-drawer-link--admin  { color: #fbbf24; }
  .lf-drawer-icon { font-size: 16px; opacity: 0.8; width: 20px; text-align: center; }
  .lf-drawer-logout {
    margin-top: 16px;
    padding: 13px;
    background: transparent;
    border: 1px solid rgba(239,68,68,0.35);
    border-radius: 10px;
    color: #f87171;
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
    letter-spacing: 0.02em;
  }
  .lf-drawer-logout:hover { background: rgba(239,68,68,0.08); }
`;
