import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Dashboard() {
  const [user, setUser]   = useState(null);
  const [notifs, setNotifs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/me').then(r => setUser(r.data)).catch(() => {});
    api.get('/notifications').then(r => setNotifs(r.data)).catch(() => {});
  }, []);

  // Основной кошелёк — первый primary или просто первый
  const primaryWallet = user?.wallets?.find(w => w.is_primary) ?? user?.wallets?.[0] ?? null;

  const kycColor = {
    APPROVED: '#10b981',
    PENDING:  '#f59e0b',
    REJECTED: '#ef4444',
  };

  return (
    <div className="page">

      {/* ── Шапка ── */}
      <div style={s.header}>
        <div>
          <h1 style={s.welcome}>Welcome, {user?.username || '…'}!</h1>
          <p style={s.sub}>
            {user?.role === 'UNVERIFIED'
              ? 'Complete KYC to unlock all features'
              : `Role: ${user?.role}`}
          </p>
        </div>
        {user?.role === 'UNVERIFIED' && (
          <button style={s.kycBanner} onClick={() => navigate('/kyc')}>
            ⚠ Complete KYC verification →
          </button>
        )}
      </div>

      {/* ── Основная сетка ── */}
      <div style={s.grid}>

        {/* Кошелёк */}
        <div className="card" style={s.walletCard}>
          <div style={s.cardHead}>
            <span style={s.cardIcon}>💳</span>
            <span style={s.cardTitle}>Wallet</span>
          </div>
          {primaryWallet ? (
            <>
              <div style={s.address}>
                {primaryWallet.address}
              </div>
              {primaryWallet.label && (
                <div style={s.walletLabel}>{primaryWallet.label}</div>
              )}
              {user?.wallets?.length > 1 && (
                <div style={s.walletExtra}>
                  +{user.wallets.length - 1} more wallet{user.wallets.length > 2 ? 's' : ''}
                </div>
              )}
            </>
          ) : (
            <p style={s.empty}>No wallet found</p>
          )}
        </div>

        {/* KYC статус */}
        <div className="card" style={s.kycCard}>
          <div style={s.cardHead}>
            <span style={s.cardIcon}>🔐</span>
            <span style={s.cardTitle}>KYC Status</span>
          </div>
          {user ? (
            <KycStatus userId={user.id} kycColor={kycColor} navigate={navigate} />
          ) : (
            <p style={s.empty}>Loading…</p>
          )}
        </div>

        {/* Уведомления */}
        <div className="card" style={s.notifCard}>
          <div style={s.cardHead}>
            <span style={s.cardIcon}>🔔</span>
            <span style={s.cardTitle}>Notifications</span>
            {notifs.length > 0 && (
              <span style={s.badge}>{notifs.length}</span>
            )}
          </div>
          {notifs.length === 0 ? (
            <p style={s.empty}>No notifications yet</p>
          ) : (
            <div style={s.notifList}>
              {notifs.slice(0, 5).map((n, i) => (
                <div key={i} style={s.notifItem}>
                  <span style={s.notifDot} />
                  <span style={s.notifText}>{n.message || n.text || JSON.stringify(n)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Быстрые ссылки ── */}
      <div style={s.quickNav}>
        {[
          { to: '/profile', icon: '👤', label: 'Edit Profile' },
          { to: '/kyc',     icon: '🔐', label: 'KYC Status' },
          { to: '/chat',    icon: '💬', label: 'Chat' },
          { to: '/graph',   icon: '🌐', label: 'Network' },
        ].map(item => (
          <button key={item.to} style={s.quickBtn} onClick={() => navigate(item.to)}>
            <span style={s.quickIcon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

    </div>
  );
}

// Отдельный компонент для KYC статуса
function KycStatus({ userId, kycColor, navigate }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get('/kyc/status').then(r => setStatus(r.data)).catch(() => setStatus(null));
  }, [userId]);

  if (!status) return <p style={{ color: '#64748b', margin: 0 }}>Not submitted</p>;

  return (
    <div>
      <span style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 20,
        background: kycColor[status.status] || '#475569',
        color: '#fff',
        fontWeight: 600,
        fontSize: 13,
      }}>
        {status.status}
      </span>
      {status.status === 'REJECTED' && status.rejection_reason && (
        <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>
          {status.rejection_reason}
        </p>
      )}
      {status.status !== 'APPROVED' && (
        <button style={s.kycBtn} onClick={() => navigate('/kyc')}>
          {status.status === 'REJECTED' ? 'Resubmit →' : 'View details →'}
        </button>
      )}
    </div>
  );
}

const s = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 16,
  },
  welcome: { fontSize: 32, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#94a3b8', fontSize: 15 },

  kycBanner: {
    padding: '10px 20px',
    background: '#451a03',
    border: '1px solid #92400e',
    color: '#fcd34d',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 20,
    marginBottom: 32,
  },

  cardHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIcon: { fontSize: 20 },
  cardTitle: { fontWeight: 600, fontSize: 16, color: '#f1f5f9' },
  badge: {
    marginLeft: 'auto',
    background: '#ef4444',
    color: '#fff',
    borderRadius: 20,
    padding: '1px 8px',
    fontSize: 12,
    fontWeight: 700,
  },

  walletCard: {},
  kycCard:    {},
  notifCard:  {},

  address: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#94a3b8',
    wordBreak: 'break-all',
    background: '#0f172a',
    padding: '8px 12px',
    borderRadius: 8,
    marginBottom: 8,
  },
  walletLabel: { fontSize: 13, color: '#64748b' },
  walletExtra: { fontSize: 12, color: '#475569', marginTop: 4 },
  empty: { color: '#64748b', fontSize: 14 },

  notifList: { display: 'flex', flexDirection: 'column', gap: 10 },
  notifItem: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  notifDot:  { width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', marginTop: 5, flexShrink: 0 },
  notifText: { fontSize: 14, color: '#cbd5e1', lineHeight: 1.4 },

  kycBtn: {
    marginTop: 12,
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#94a3b8',
    fontSize: 13,
    cursor: 'pointer',
  },

  quickNav: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  quickBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  quickIcon: { fontSize: 16 },
};
