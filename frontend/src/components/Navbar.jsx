import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../api';

export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isAuth    = !!localStorage.getItem('access_token');
  const [role, setRole]     = useState('');
  const [open, setOpen]     = useState(false); // мобильное меню

  useEffect(() => {
    if (isAuth) {
      api.get('/auth/me').then(r => setRole(r.data.role)).catch(() => {});
    }
  }, [isAuth]);

  // Закрывать меню при навигации
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const isActive = (path) =>
    location.pathname === path ? s.linkActive : s.link;

  return (
    <nav style={s.nav}>
      <div style={s.inner}>

        {/* Лого */}
        <Link to="/" style={s.brand}>
          <span style={s.brandIcon}>⬡</span> DeFi Platform
        </Link>

        {/* Desktop links */}
        {isAuth && (
          <div style={s.desktopLinks}>
            <Link to="/"       style={isActive('/')}>Dashboard</Link>
            <Link to="/kyc"    style={isActive('/kyc')}>KYC</Link>
            <Link to="/chat"   style={isActive('/chat')}>Chat</Link>
            <Link to="/graph"  style={isActive('/graph')}>Network</Link>
            <Link to="/profile" style={isActive('/profile')}>Profile</Link>
            {role === 'ADMIN' && (
              <Link to="/admin" style={{ ...isActive('/admin'), color: '#fbbf24' }}>
                👑 Admin
              </Link>
            )}
          </div>
        )}

        {/* Auth / Logout — desktop */}
        <div style={s.authZone}>
          {isAuth ? (
            <button onClick={logout} style={s.logoutBtn}>Logout</button>
          ) : (
            <>
              <Link to="/login"    style={s.link}>Login</Link>
              <Link to="/register" style={s.registerBtn}>Register</Link>
            </>
          )}
          {/* Бургер — только мобайл */}
          <button style={s.burger} onClick={() => setOpen(o => !o)} aria-label="Menu">
            {open ? '✕' : '☰'}
          </button>
        </div>

      </div>

      {/* Mobile drawer */}
      {open && isAuth && (
        <div style={s.drawer}>
          {[
            { to: '/',        label: 'Dashboard' },
            { to: '/kyc',     label: 'KYC' },
            { to: '/chat',    label: 'Chat' },
            { to: '/graph',   label: 'Network' },
            { to: '/profile', label: 'Profile' },
            ...(role === 'ADMIN' ? [{ to: '/admin', label: '👑 Admin' }] : []),
          ].map(item => (
            <Link key={item.to} to={item.to} style={s.drawerLink}>
              {item.label}
            </Link>
          ))}
          <button onClick={logout} style={s.drawerLogout}>Logout</button>
        </div>
      )}
    </nav>
  );
}

const s = {
  nav: {
    background: '#0a1628',
    borderBottom: '1px solid #1e293b',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: 56,
    maxWidth: 1600,
    margin: '0 auto',
    width: '100%',
  },

  brand: {
    color: '#38bdf8',
    fontWeight: 700,
    fontSize: 18,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  brandIcon: { fontSize: 20 },

  desktopLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
    // Скрываем на мобайле через медиа нельзя в inline styles,
    // но скрываем через overflow — управляем бургером
  },

  link: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: 14,
    padding: '6px 12px',
    borderRadius: 8,
    transition: 'color 0.15s',
  },
  linkActive: {
    color: '#f1f5f9',
    textDecoration: 'none',
    fontSize: 14,
    padding: '6px 12px',
    borderRadius: 8,
    background: '#1e293b',
  },

  authZone: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },

  logoutBtn: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '7px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  registerBtn: {
    background: '#38bdf8',
    color: '#0f172a',
    textDecoration: 'none',
    padding: '7px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
  },

  burger: {
    display: 'none',  // показываем через CSS media — в inline недоступно,
    // но рендерим всегда и управляем через JS
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 16,
    cursor: 'pointer',
    // Хак: всегда показываем кнопку, но десктоп-ссылки тоже видны
    // — для полноценного адаптива используй CSS классы
  },

  drawer: {
    background: '#0f172a',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 24px 20px',
    gap: 4,
  },
  drawerLink: {
    color: '#cbd5e1',
    textDecoration: 'none',
    fontSize: 15,
    padding: '10px 0',
    borderBottom: '1px solid #1e293b',
  },
  drawerLogout: {
    marginTop: 12,
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '10px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
  },
};
