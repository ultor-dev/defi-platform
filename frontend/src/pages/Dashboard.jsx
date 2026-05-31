import { useEffect, useState, useCallback } from 'react';
import api from '../api';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [transfer, setTransfer] = useState({ to_address: '', amount: '' });
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const isVerified = user?.role === 'USER' || user?.role === 'ADMIN';

  const loadNotifications = useCallback(async () => {
    try {
      const r = await api.get('/notifications');
      setNotifications(r.data);
    } catch {
      // notifications endpoint может не существовать — молча игнорируем
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const r = await api.get('/auth/me');
      setUser(r.data);
      if (r.data.role === 'USER' || r.data.role === 'ADMIN') {
        try {
          const b = await api.get('/wallet/balance');
          setBalance(b.data);
        } catch { /* wallet может быть недоступен */ }
      }
    } catch { /* auth/me упадёт если не залогинен → PrivateRoute */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); loadNotifications(); }, [loadData, loadNotifications]);

  const doTransfer = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setTxHash('');
    try {
      const res = await api.post('/wallet/transfer', {
        to_address: transfer.to_address,
        amount: parseFloat(transfer.amount),
      });
      setTxHash(res.data.tx_hash);
      setSuccess('Transfer successful!');
      setTransfer({ to_address: '', amount: '' });
      loadData();
    } catch (e) {
      setError(e.response?.data?.detail || 'Transfer failed');
    }
  };

  const markRead = async (notifId) => {
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch { }
  };

  const getPrimaryWallet = () => {
    if (!user?.wallets || user.wallets.length === 0) return null;
    return user.wallets.find(w => w.is_primary) || user.wallets[0];
  };

  const getKycStatus = () => {
    // KYC статус определяется через role
    if (!user) return null;
    if (user.role === 'USER' || user.role === 'ADMIN') return { status: 'APPROVED', label: 'Verified', color: '#10b981' };
    return { status: 'UNVERIFIED', label: 'Unverified', color: '#f59e0b' };
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  const wallet = getPrimaryWallet();
  const kyc = getKycStatus();
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.greeting}>Welcome, {user?.username}!</h1>
          <p style={styles.sub}>{user?.email}</p>
        </div>
        <div style={styles.headerBadges}>
          {kyc && (
            <span style={{ ...styles.badge, background: kyc.color }}>
              {kyc.label}
            </span>
          )}
          <span style={{ ...styles.badge, background: '#334155' }}>
            {user?.role}
          </span>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Wallet Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>💳 Wallet</h3>
          {wallet ? (
            <>
              <div style={styles.addressBox}>
                <span style={styles.addressLabel}>Address</span>
                <span style={styles.address}>{wallet.address}</span>
              </div>
              {balance ? (
                <div style={styles.balanceRow}>
                  <div style={styles.balanceItem}>
                    <div style={styles.balanceNum}>{parseFloat(balance.eth).toFixed(4)}</div>
                    <div style={styles.balanceLabel}>ETH</div>
                  </div>
                  <div style={styles.balanceItem}>
                    <div style={{ ...styles.balanceNum, color: '#38bdf8' }}>
                      {parseFloat(balance.token).toFixed(2)}
                    </div>
                    <div style={styles.balanceLabel}>DPT</div>
                  </div>
                </div>
              ) : (
                <p style={styles.muted}>Loading balance...</p>
              )}

              {isVerified ? (
                <form onSubmit={doTransfer} style={{ marginTop: 16 }}>
                  <input style={styles.input} placeholder="Recipient address (0x...)"
                    value={transfer.to_address}
                    onChange={e => setTransfer({ ...transfer, to_address: e.target.value })} />
                  <input style={styles.input} placeholder="Amount DPT"
                    type="number" step="0.01" min="0"
                    value={transfer.amount}
                    onChange={e => setTransfer({ ...transfer, amount: e.target.value })} />
                  {error && <p style={styles.error}>{error}</p>}
                  {success && <p style={styles.success}>{success}</p>}
                  {txHash && (
                    <div style={styles.txBox}>
                      TX: <code style={styles.txCode}>{txHash.slice(0, 30)}…</code>
                    </div>
                  )}
                  <button style={styles.btn} type="submit">Send Tokens</button>
                </form>
              ) : (
                <p style={styles.muted}>
                  <a href="/kyc" style={styles.link}>Complete KYC</a> to enable transfers
                </p>
              )}
            </>
          ) : (
            <p style={styles.muted}>No wallet found</p>
          )}
        </div>

        {/* Notifications Card */}
        <div style={styles.card}>
          <div style={styles.notifHeader}>
            <h3 style={styles.cardTitle}>🔔 Notifications</h3>
            {unreadCount > 0 && (
              <span style={styles.unreadBadge}>{unreadCount}</span>
            )}
          </div>

          {notifications.length === 0 ? (
            <p style={styles.muted}>No notifications yet</p>
          ) : (
            <div style={styles.notifList}>
              {notifications.slice(0, 10).map(n => (
                <div
                  key={n.id}
                  style={{ ...styles.notifItem, background: n.is_read ? 'transparent' : '#0f172a' }}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <div style={styles.notifTop}>
                    <span style={styles.notifType}>[{n.type}]</span>
                    <span style={styles.notifDate}>
                      {n.created_at ? new Date(n.created_at).toLocaleDateString('ru-RU') : ''}
                    </span>
                  </div>
                  <div style={styles.notifTitle}>{n.title}</div>
                  {n.body && <div style={styles.notifBody}>{n.body}</div>}
                  {!n.is_read && <span style={styles.unreadDot}>●</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div style={styles.quickLinks}>
        <a href="/profile" style={styles.quickLink}>👤 Edit Profile</a>
        <a href="/kyc" style={styles.quickLink}>🛡️ KYC Status</a>
        <a href="/chat" style={styles.quickLink}>💬 Chat</a>
        <a href="/graph" style={styles.quickLink}>🌐 Network</a>
        {user?.role === 'ADMIN' && (
          <a href="/admin" style={{ ...styles.quickLink, borderColor: '#fbbf24', color: '#fbbf24' }}>
            👑 Admin
          </a>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: 32, background: '#0f172a', minHeight: '90vh' },
  loading: { color: '#fff', textAlign: 'center', padding: 60 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', maxWidth: 900, margin: '0 auto 24px' },
  greeting: { color: '#f1f5f9', fontSize: 24, fontWeight: 700, margin: 0 },
  sub: { color: '#64748b', fontSize: 14, margin: '4px 0 0' },
  headerBadges: { display: 'flex', gap: 8 },
  badge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, color: '#fff', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900, margin: '0 auto' },
  card: { background: '#1e293b', borderRadius: 12, padding: 24 },
  cardTitle: { color: '#38bdf8', marginBottom: 16, fontSize: 16, fontWeight: 700 },
  addressBox: { marginBottom: 12 },
  addressLabel: { color: '#64748b', fontSize: 11, display: 'block', marginBottom: 4 },
  address: { color: '#94a3b8', fontSize: 12, wordBreak: 'break-all', background: '#0f172a', padding: 8, borderRadius: 6, display: 'block', fontFamily: 'monospace' },
  balanceRow: { display: 'flex', gap: 12, marginBottom: 8 },
  balanceItem: { flex: 1, background: '#0f172a', borderRadius: 8, padding: 12, textAlign: 'center' },
  balanceNum: { color: '#f1f5f9', fontSize: 22, fontWeight: 700 },
  balanceLabel: { color: '#64748b', fontSize: 12, marginTop: 2 },
  input: { width: '100%', padding: '8px 10px', marginBottom: 8, borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box' },
  btn: { width: '100%', padding: 10, background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 14, marginTop: 4 },
  btnSecondary: { width: '100%', padding: 10, background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginTop: 8 },
  error: { color: '#ef4444', fontSize: 12, marginBottom: 8 },
  success: { color: '#4ade80', fontSize: 12, marginBottom: 8 },
  muted: { color: '#64748b', fontSize: 13, textAlign: 'center', margin: '20px 0' },
  link: { color: '#38bdf8', textDecoration: 'none' },
  txBox: { background: '#0f172a', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' },
  txCode: { color: '#4ade80' },
  notifHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  unreadBadge: { background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 },
  notifList: { display: 'flex', flexDirection: 'column', gap: 8 },
  notifItem: { padding: 10, borderRadius: 8, cursor: 'pointer', position: 'relative' },
  notifTop: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  notifType: { color: '#64748b', fontSize: 11, fontWeight: 600 },
  notifDate: { color: '#475569', fontSize: 11 },
  notifTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: 500 },
  notifBody: { color: '#64748b', fontSize: 12, marginTop: 2 },
  unreadDot: { position: 'absolute', top: 8, right: 8, color: '#38bdf8', fontSize: 10 },
  quickLinks: { display: 'flex', gap: 12, maxWidth: 900, margin: '24px auto 0', justifyContent: 'center', flexWrap: 'wrap' },
  quickLink: { padding: '10px 20px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#cbd5e1', textDecoration: 'none', fontSize: 14, transition: 'border-color 0.2s', cursor: 'pointer' },
};
