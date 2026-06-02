import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import TransferBlock from '../components/TransferBlock';

export default function Dashboard() {
  const [user, setUser]     = useState(null);
  const [notifs, setNotifs] = useState([]);
  const navigate = useNavigate();

  const refreshUser = useCallback(() =>
    api.get('/auth/me').then(r => setUser(r.data)).catch(() => {}), []);

  useEffect(() => {
    refreshUser();
    api.get('/notifications').then(r => setNotifs(r.data)).catch(() => {});
  }, []);

  const kycColor = { APPROVED: '#10b981', PENDING: '#f59e0b', REJECTED: '#ef4444' };

  return (
    <div className="page">
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

      <div style={s.grid}>
        <WalletCard wallets={user?.wallets ?? []} onRefresh={refreshUser} />
        {(user?.wallets?.length ?? 0) > 0 && (
          <TransferBlock wallets={user.wallets} />
        )}

        <div className="card">
          <div style={s.cardHead}>
            <span style={s.cardIcon}>🔐</span>
            <span style={s.cardTitle}>KYC Status</span>
          </div>
          {user
            ? <KycStatus userId={user.id} kycColor={kycColor} navigate={navigate} />
            : <p style={s.empty}>Loading…</p>}
        </div>

        <div className="card">
          <div style={s.cardHead}>
            <span style={s.cardIcon}>🔔</span>
            <span style={s.cardTitle}>Notifications</span>
            {notifs.length > 0 && <span style={s.badge}>{notifs.length}</span>}
          </div>
          {notifs.length === 0 ? (
            <p style={s.empty}>No notifications yet</p>
          ) : (
            <div style={s.notifList}>
              {notifs.slice(0, 5).map((n, i) => (
                <div key={i} style={s.notifItem}>
                  <span style={s.notifDot} />
                  <span style={s.notifText}>{n.message || n.title || JSON.stringify(n)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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

// ── Wallet Card ───────────────────────────────────────────────
function WalletCard({ wallets, onRefresh }) {
  const [balances, setBalances]         = useState({});
  const [loadingBal, setLoadingBal]     = useState(false);
  const [selectedId, setSelectedId]     = useState(null);
  const [creating, setCreating]         = useState(false);
  const [newLabel, setNewLabel]         = useState('');
  const [creatingLoad, setCreatingLoad] = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [editLabel, setEditLabel]       = useState('');
  const [error, setError]               = useState('');

  const canAdd = wallets.length < 5;

  useEffect(() => {
    if (!wallets.length) return;
    setLoadingBal(true);
    api.get('/wallet/balances')
      .then(r => {
        const map = {};
        r.data.forEach(b => { map[b.wallet_id] = b; });
        setBalances(map);
      })
      .catch(() => {})
      .finally(() => setLoadingBal(false));
  }, [wallets]);

  const setPrimary = async (id) => {
    try { await api.patch(`/wallet/${id}/primary`); await onRefresh(); } catch {}
  };

  const saveLabel = async (id) => {
    if (!editLabel.trim()) return;
    try {
      await api.patch(`/wallet/${id}/label`, null, { params: { label: editLabel.trim() } });
      setEditingId(null);
      await onRefresh();
    } catch {}
  };

  const createWallet = async () => {
    if (!newLabel.trim()) return;
    setCreatingLoad(true); setError('');
    try {
      await api.post('/wallet/create', { label: newLabel.trim() });
      setNewLabel(''); setCreating(false);
      await onRefresh();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create wallet');
    } finally { setCreatingLoad(false); }
  };

  return (
    <div className="card">
      <div style={s.cardHead}>
        <span style={s.cardIcon}>💳</span>
        <span style={s.cardTitle}>Wallets</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
          {wallets.length}/5
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {wallets.map(w => {
          const bal  = balances[w.id];
          const open = selectedId === w.id;
          return (
            <div key={w.id}>
              <div
                style={{
                  ...s.walletRow,
                  ...(w.is_primary ? s.walletRowPrimary : {}),
                  ...(open ? s.walletRowOpen : {}),
                }}
                onClick={() => setSelectedId(open ? null : w.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.walletRowTop}>
                    {w.is_primary && <span style={s.primaryBadge}>PRIMARY</span>}
                    {editingId === w.id ? (
                      <div style={s.editRow} onClick={e => e.stopPropagation()}>
                        <input
                          style={s.labelInput}
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveLabel(w.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                        <button style={s.saveBtn} onClick={() => saveLabel(w.id)}>✓</button>
                        <button style={s.cancelBtn} onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    ) : (
                      <span style={s.walletName}>{w.label || 'Wallet'}</span>
                    )}
                  </div>
                  <div style={s.walletAddr}>{w.address.slice(0,10)}…{w.address.slice(-8)}</div>
                </div>

                <div style={s.balanceCol}>
                  {loadingBal ? (
                    <span style={s.balLoading}>…</span>
                  ) : bal ? (
                    <>
                      <div style={s.balToken}>{parseFloat(bal.token).toFixed(2)} <span style={s.balSym}>DPT</span></div>
                      <div style={s.balEth}>{parseFloat(bal.eth).toFixed(4)} ETH</div>
                    </>
                  ) : (
                    <span style={s.balLoading}>—</span>
                  )}
                </div>

                <div style={s.walletActions} onClick={e => e.stopPropagation()}>
                  {!w.is_primary && (
                    <button style={s.iconBtn} title="Set as primary" onClick={() => setPrimary(w.id)}>★</button>
                  )}
                  <button style={s.iconBtn} title="Rename" onClick={() => { setEditingId(w.id); setEditLabel(w.label || ''); }}>✎</button>
                  <span style={{ color: '#334155', fontSize: 12, userSelect: 'none' }}>{open ? '▲' : '▼'}</span>
                </div>
              </div>

              {open && <WalletDetail wallet={w} balance={bal} />}
            </div>
          );
        })}
      </div>

      {creating ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            style={s.labelInput}
            placeholder="Wallet name (e.g. Savings)"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createWallet()}
            autoFocus maxLength={64}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={s.confirmBtn} onClick={createWallet} disabled={creatingLoad || !newLabel.trim()}>
              {creatingLoad ? '…' : 'Create'}
            </button>
            <button style={s.cancelBtn} onClick={() => { setCreating(false); setError(''); }}>Cancel</button>
          </div>
          {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}
        </div>
      ) : canAdd ? (
        <button style={s.addWalletBtn} onClick={() => setCreating(true)}>+ Add wallet</button>
      ) : (
        <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', marginTop: 10 }}>Maximum 5 wallets</p>
      )}
    </div>
  );
}

// ── Детали кошелька + транзакции ──────────────────────────────
function WalletDetail({ wallet, balance }) {
  const [txs, setTxs]         = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/wallet/transactions', { params: { wallet_id: wallet.id, limit: 20 } })
      .then(r => setTxs(r.data))
      .catch(() => setTxs([]))
      .finally(() => setLoading(false));
  }, [wallet.id]);

  const txIcon  = { TRANSFER: '↔', MINT: '⬇', BURN: '🔥' };
  const txColor = { TRANSFER: '#38bdf8', MINT: '#10b981', BURN: '#ef4444' };
  const stColor = { SUCCESS: '#10b981', PENDING: '#f59e0b', FAILED: '#ef4444' };
  const isIn    = (tx) => tx.to_wallet_id === wallet.id;

  return (
    <div style={s.detail}>
      <div style={s.detailSection}>
        <div style={s.detailLabel}>Full Address</div>
        <div style={s.detailAddress}>{wallet.address}</div>
      </div>

      {balance && (
        <div style={s.balGrid}>
          <div style={s.balBox}>
            <div style={s.balBoxLabel}>DPT Token</div>
            <div style={s.balBoxVal}>{parseFloat(balance.token).toFixed(4)}</div>
          </div>
          <div style={s.balBox}>
            <div style={s.balBoxLabel}>ETH (gas)</div>
            <div style={s.balBoxVal}>{parseFloat(balance.eth).toFixed(6)}</div>
          </div>
        </div>
      )}

      <div style={s.detailSection}>
        <div style={s.detailLabel}>Transaction History</div>
        {loading ? (
          <p style={s.empty}>Loading…</p>
        ) : txs.length === 0 ? (
          <p style={s.empty}>No transactions yet</p>
        ) : (
          <div style={s.txList}>
            {txs.map(tx => (
              <div key={tx.id} style={s.txRow}>
                <span style={{ ...s.txTypeIcon, color: txColor[tx.tx_type] || '#94a3b8' }}>
                  {txIcon[tx.tx_type] || '?'}
                </span>
                <div style={s.txInfo}>
                  <div style={s.txTop}>
                    <span style={s.txKind}>{tx.tx_type}</span>
                    <span style={{ ...s.txStatus, color: stColor[tx.status] || '#94a3b8' }}>
                      {tx.status}
                    </span>
                  </div>
                  <div style={s.txHash}>
                    {tx.tx_hash ? `${tx.tx_hash.slice(0, 20)}…` : '—'}
                  </div>
                  {tx.note && <div style={s.txNote}>{tx.note}</div>}
                </div>
                <div style={s.txAmountCol}>
                  <span style={{ color: isIn(tx) ? '#10b981' : '#f1f5f9', fontWeight: 600 }}>
                    {isIn(tx) ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} {tx.token_symbol}
                  </span>
                  <div style={s.txDate}>{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KYC ───────────────────────────────────────────────────────
function KycStatus({ userId, kycColor, navigate }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    api.get('/kyc/status').then(r => setStatus(r.data)).catch(() => setStatus(null));
  }, [userId]);

  if (!status) return <p style={{ color: '#64748b', margin: 0 }}>Not submitted</p>;
  return (
    <div>
      <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: kycColor[status.status] || '#475569', color: '#fff', fontWeight: 600, fontSize: 13 }}>
        {status.status}
      </span>
      {status.status === 'REJECTED' && status.rejection_reason && (
        <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{status.rejection_reason}</p>
      )}
      {status.status !== 'APPROVED' && (
        <button style={s.kycBtn} onClick={() => navigate('/kyc')}>
          {status.status === 'REJECTED' ? 'Resubmit →' : 'View details →'}
        </button>
      )}
    </div>
  );
}

// ── Стили ─────────────────────────────────────────────────────
const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 },
  welcome: { fontSize: 32, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#94a3b8', fontSize: 15 },
  kycBanner: { padding: '10px 20px', background: '#451a03', border: '1px solid #92400e', color: '#fcd34d', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 32 },

  cardHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIcon: { fontSize: 20 },
  cardTitle: { fontWeight: 600, fontSize: 16, color: '#f1f5f9' },
  badge: { marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700 },
  empty: { color: '#64748b', fontSize: 14, margin: 0 },

  walletRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #1e293b', cursor: 'pointer' },
  walletRowPrimary: { border: '1px solid rgba(56,189,248,0.25)' },
  walletRowOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: '1px solid transparent' },
  walletRowTop: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  primaryBadge: { fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: 4 },
  walletName: { fontSize: 13, fontWeight: 500, color: '#cbd5e1' },
  walletAddr: { fontSize: 11, color: '#334155', fontFamily: 'monospace' },
  walletActions: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },

  balanceCol: { textAlign: 'right', flexShrink: 0 },
  balToken: { fontSize: 14, fontWeight: 600, color: '#f1f5f9' },
  balEth: { fontSize: 11, color: '#475569' },
  balSym: { fontSize: 11, color: '#475569', fontWeight: 400 },
  balLoading: { fontSize: 13, color: '#334155' },

  detail: { background: '#080f1e', border: '1px solid #1e293b', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '16px 14px', marginBottom: 0 },
  detailSection: { marginBottom: 16 },
  detailLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  detailAddress: { fontFamily: 'monospace', fontSize: 12, color: '#64748b', wordBreak: 'break-all', background: '#0f172a', padding: '8px 10px', borderRadius: 6 },

  balGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 },
  balBox: { background: '#0f172a', borderRadius: 8, padding: '10px 14px' },
  balBoxLabel: { fontSize: 11, color: '#475569', marginBottom: 4 },
  balBoxVal: { fontSize: 18, fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' },

  txList: { display: 'flex', flexDirection: 'column' },
  txRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #0d1424' },
  txTypeIcon: { fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center', paddingTop: 1 },
  txInfo: { flex: 1, minWidth: 0 },
  txTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 },
  txKind: { fontSize: 12, fontWeight: 600, color: '#94a3b8' },
  txStatus: { fontSize: 11, fontWeight: 700 },
  txHash: { fontSize: 11, color: '#334155', fontFamily: 'monospace' },
  txNote: { fontSize: 12, color: '#64748b', marginTop: 2 },
  txAmountCol: { textAlign: 'right', flexShrink: 0, fontSize: 13 },
  txDate: { fontSize: 11, color: '#334155', marginTop: 2 },

  editRow: { display: 'flex', alignItems: 'center', gap: 6 },
  labelInput: { flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', fontSize: 13, padding: '5px 10px', outline: 'none' },
  saveBtn: { background: '#10b981', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '5px 10px', fontSize: 13 },
  cancelBtn: { background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', padding: '5px 10px', fontSize: 13 },
  confirmBtn: { background: '#38bdf8', border: 'none', borderRadius: 8, color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '7px 18px', cursor: 'pointer' },
  addWalletBtn: { marginTop: 10, width: '100%', padding: '9px', background: 'transparent', border: '1px dashed #1e293b', borderRadius: 8, color: '#334155', fontSize: 13, cursor: 'pointer' },
  iconBtn: { background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: '2px 4px' },

  quickNav: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  quickBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#cbd5e1', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  quickIcon: { fontSize: 16 },

  notifList: { display: 'flex', flexDirection: 'column', gap: 10 },
  notifItem: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  notifDot: { width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', marginTop: 5, flexShrink: 0 },
  notifText: { fontSize: 14, color: '#cbd5e1', lineHeight: 1.4 },
  kycBtn: { marginTop: 12, padding: '6px 14px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer' },
};
