import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const TABS = ['Overview', 'KYC Queue', 'All Users'];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/me').then(r => {
      setUser(r.data);
      if (!['MODERATOR','ADMIN'].includes(r.data.role)) navigate('/');
    });
  }, []);

  useEffect(() => {
    if (tab === 'Overview') loadStats();
    if (tab === 'KYC Queue') loadPending();
    if (tab === 'All Users') loadUsers();
  }, [tab]);

  const loadStats = async () => {
    const r = await api.get('/admin/stats');
    setStats(r.data);
  };

  const loadPending = async () => {
    setLoading(true);
    const r = await api.get('/admin/kyc/pending');
    setPending(r.data);
    setLoading(false);
  };

  const loadUsers = async () => {
    setLoading(true);
    const r = await api.get('/admin/users');
    setAllUsers(r.data);
    setLoading(false);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const approve = async (userId) => {
    try {
      await api.post(`/admin/kyc/approve/${userId}`);
      showToast('✅ KYC approved — 100 tokens minted');
      loadPending();
      loadStats();
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.detail || 'Error'));
    }
  };

  const reject = async (userId) => {
    const reason = prompt('Rejection reason:') || 'Documents not valid';
    try {
      await api.post(`/admin/kyc/reject/${userId}?reason=${encodeURIComponent(reason)}`);
      showToast('KYC rejected');
      loadPending();
      loadStats();
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.detail || 'Error'));
    }
  };

  const toggleActive = async (userId) => {
    try {
      const r = await api.patch(`/admin/users/${userId}/toggle-active`);
      showToast(r.data.is_active ? '✅ User activated' : '🔒 User deactivated');
      loadUsers();
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.detail || 'Error'));
    }
  };

  const changeRole = async (userId, role) => {
    try {
      await api.patch(`/admin/users/${userId}/role?role=${role}`);
      showToast('✅ Role updated');
      loadUsers();
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.detail || 'Error'));
    }
  };

  return (
    <div style={s.wrap}>
      {toast && <div style={s.toast}>{toast}</div>}

      <div style={s.sidebar}>
        <div style={s.sidebarTitle}>
          {user?.role === 'ADMIN' ? '👑 Admin Panel' : '🛡️ Moderator Panel'}
        </div>
        {TABS.map(t => (
          <div key={t} style={{...s.tabItem, background: tab===t ? '#1e40af' : 'transparent'}}
            onClick={() => setTab(t)}>
            {t === 'Overview' && '📊 '}
            {t === 'KYC Queue' && '📋 '}
            {t === 'All Users' && '👥 '}
            {t}
            {t === 'KYC Queue' && pending.length > 0 && tab !== 'KYC Queue' && (
              <span style={s.badge}>{pending.length}</span>
            )}
          </div>
        ))}
      </div>

      <div style={s.content}>

        {/* Overview */}
        {tab === 'Overview' && stats && (
          <div>
            <h2 style={s.pageTitle}>Platform Overview</h2>
            <div style={s.statsGrid}>
              <StatCard label="Total Users" value={stats.total_users} color="#38bdf8" icon="👥" />
              <StatCard label="KYC Pending" value={stats.kyc_pending} color="#fbbf24" icon="⏳" />
              <StatCard label="KYC Verified" value={stats.kyc_verified} color="#4ade80" icon="✅" />
              <StatCard label="Unverified" value={stats.kyc_unverified} color="#94a3b8" icon="🔓" />
            </div>
            {stats.kyc_pending > 0 && (
              <div style={s.alert} onClick={() => setTab('KYC Queue')}>
                ⚠️ {stats.kyc_pending} KYC application{stats.kyc_pending > 1 ? 's' : ''} waiting for review →
              </div>
            )}
          </div>
        )}

        {/* KYC Queue */}
        {tab === 'KYC Queue' && (
          <div>
            <h2 style={s.pageTitle}>KYC Review Queue</h2>
            {loading && <p style={s.muted}>Loading...</p>}
            {!loading && pending.length === 0 && (
              <div style={s.empty}>
                <div style={{fontSize:48}}>🎉</div>
                <p>No pending KYC applications</p>
              </div>
            )}
            {pending.map(u => (
              <div key={u.id} style={s.kycCard}>
                <div style={s.kycLeft}>
                  <div style={s.kycAvatar}>{u.username[0].toUpperCase()}</div>
                  <div>
                    <div style={s.kycName}>{u.username}</div>
                    <div style={s.kycEmail}>{u.email}</div>
                    <div style={s.kycMeta}>
                      📄 {u.kyc_document_type} · {u.kyc_document_number}
                    </div>
                    <div style={s.kycMeta}>
                      👤 {u.kyc_full_name}
                    </div>
                    <div style={s.kycMeta}>
                      🏦 {u.wallet?.address || 'No wallet'}
                    </div>
                    <div style={s.kycMeta}>
                      📅 Submitted: {u.kyc_submitted_at
                        ? new Date(u.kyc_submitted_at).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                </div>
                <div style={s.kycActions}>
                  <button style={s.approveBtn} onClick={() => approve(u.id)}>
                    ✅ Approve
                  </button>
                  <button style={s.rejectBtn} onClick={() => reject(u.id)}>
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All Users */}
        {tab === 'All Users' && (
          <div>
            <h2 style={s.pageTitle}>All Users</h2>
            {loading && <p style={s.muted}>Loading...</p>}
            <table style={s.table}>
              <thead>
                <tr>
                  {['ID','Username','Email','Role','KYC','Active','Actions'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => (
                  <tr key={u.id} style={s.tr}>
                    <td style={s.td}>{u.id}</td>
                    <td style={s.td}><strong>{u.username}</strong></td>
                    <td style={s.td}>{u.email}</td>
                    <td style={s.td}>
                      <span style={{...s.roleBadge, background: roleColor(u.role)}}>
                        {u.role}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{...s.roleBadge, background: kycColor(u.kyc_status)}}>
                        {u.kyc_status}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{color: u.is_active ? '#4ade80' : '#ef4444'}}>
                        {u.is_active ? '✅' : '🔒'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={s.actionRow}>
                        {user?.role === 'ADMIN' && u.id !== user?.id && (
                          <>
                            <select style={s.select}
                              value={u.role}
                              onChange={e => changeRole(u.id, e.target.value)}>
                              <option value="UNVERIFIED">UNVERIFIED</option>
                              <option value="USER">USER</option>
                              <option value="MODERATOR">MODERATOR</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                            <button style={s.toggleBtn}
                              onClick={() => toggleActive(u.id)}>
                              {u.is_active ? 'Ban' : 'Unban'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{...s.statCard, borderTop: `3px solid ${color}`}}>
      <div style={s.statIcon}>{icon}</div>
      <div style={{...s.statValue, color}}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

const roleColor = (r) => ({
  ADMIN:'#7c3aed', MODERATOR:'#1e40af', USER:'#166534', UNVERIFIED:'#374151'
}[r] || '#374151');

const kycColor = (k) => ({
  APPROVED:'#166534', PENDING:'#854d0e', REJECTED:'#7f1d1d', NONE:'#374151'
}[k] || '#374151');

const s = {
  wrap: { display:'flex', minHeight:'90vh', background:'#0f172a' },
  toast: { position:'fixed', top:20, right:20, background:'#1e293b', color:'#f1f5f9',
    padding:'12px 20px', borderRadius:8, border:'1px solid #334155',
    zIndex:1000, fontSize:14, boxShadow:'0 4px 20px rgba(0,0,0,0.4)' },
  sidebar: { width:220, background:'#1e293b', borderRight:'1px solid #334155',
    padding:'24px 0' },
  sidebarTitle: { color:'#f1f5f9', fontWeight:700, fontSize:14,
    padding:'0 16px 20px', borderBottom:'1px solid #334155', marginBottom:8 },
  tabItem: { padding:'12px 20px', color:'#cbd5e1', cursor:'pointer', fontSize:14,
    borderRadius:6, margin:'2px 8px', display:'flex', alignItems:'center', gap:4 },
  badge: { marginLeft:'auto', background:'#dc2626', color:'#fff',
    borderRadius:10, padding:'2px 7px', fontSize:11, fontWeight:700 },
  content: { flex:1, padding:32, overflowY:'auto' },
  pageTitle: { color:'#f1f5f9', marginBottom:24, fontSize:20, fontWeight:700 },
  statsGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 },
  statCard: { background:'#1e293b', borderRadius:10, padding:20, textAlign:'center' },
  statIcon: { fontSize:28, marginBottom:8 },
  statValue: { fontSize:32, fontWeight:800, marginBottom:4 },
  statLabel: { color:'#64748b', fontSize:13 },
  alert: { background:'#451a03', border:'1px solid #92400e', color:'#fbbf24',
    padding:'14px 20px', borderRadius:8, cursor:'pointer', fontSize:14 },
  empty: { textAlign:'center', color:'#64748b', padding:60 },
  muted: { color:'#64748b', padding:20 },
  kycCard: { background:'#1e293b', borderRadius:10, padding:20, marginBottom:12,
    display:'flex', justifyContent:'space-between', alignItems:'flex-start',
    border:'1px solid #334155' },
  kycLeft: { display:'flex', gap:16, flex:1 },
  kycAvatar: { width:48, height:48, borderRadius:'50%', background:'#0369a1',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'#fff', fontWeight:700, fontSize:18, flexShrink:0 },
  kycName: { color:'#f1f5f9', fontWeight:600, fontSize:15, marginBottom:4 },
  kycEmail: { color:'#94a3b8', fontSize:13, marginBottom:6 },
  kycMeta: { color:'#64748b', fontSize:12, marginBottom:3 },
  kycActions: { display:'flex', flexDirection:'column', gap:8, marginLeft:16 },
  approveBtn: { padding:'10px 20px', background:'#166534', color:'#4ade80',
    border:'1px solid #16a34a', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:13 },
  rejectBtn: { padding:'10px 20px', background:'#7f1d1d', color:'#f87171',
    border:'1px solid #dc2626', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:13 },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', color:'#64748b', fontSize:12, fontWeight:600,
    padding:'10px 12px', borderBottom:'1px solid #334155' },
  tr: { borderBottom:'1px solid #1e293b' },
  td: { padding:'12px', color:'#cbd5e1', fontSize:13, verticalAlign:'middle' },
  roleBadge: { padding:'3px 8px', borderRadius:12, fontSize:11, color:'#fff', fontWeight:600 },
  actionRow: { display:'flex', gap:8, alignItems:'center' },
  select: { background:'#0f172a', color:'#f1f5f9', border:'1px solid #334155',
    borderRadius:4, padding:'4px 8px', fontSize:12 },
  toggleBtn: { padding:'4px 12px', background:'#7f1d1d', color:'#f87171',
    border:'1px solid #dc2626', borderRadius:4, cursor:'pointer', fontSize:12 },
};
