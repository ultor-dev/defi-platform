import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const TABS = ['Обзор', 'KYC очередь', 'Пользователи'];

const s = {
  wrap: { display: 'flex', minHeight: '100vh', background: '#0f172a' },
  toast: { position: 'fixed', top: 20, right: 20, background: '#1e293b',
    color: '#f1f5f9', padding: '12px 20px', borderRadius: 8,
    border: '1px solid #334155', zIndex: 1000, fontSize: 14 },
  sidebar: { width: 220, background: '#1e293b', borderRight: '1px solid #334155', padding: '24px 0' },
  sidebarTitle: { color: '#f1f5f9', fontWeight: 700, fontSize: 14,
    padding: '0 16px 20px', borderBottom: '1px solid #334155', marginBottom: 8 },
  tab: { padding: '12px 20px', color: '#cbd5e1', cursor: 'pointer',
    fontSize: 14, borderRadius: 6, margin: '2px 8px' },
  content: { flex: 1, padding: 32, overflowY: 'auto' },
  pageTitle: { color: '#f1f5f9', marginBottom: 24, fontSize: 20, fontWeight: 700 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  statCard: { background: '#1e293b', borderRadius: 10, padding: 20, textAlign: 'center' },
  alert: { background: '#451a03', border: '1px solid #92400e', color: '#fbbf24',
    padding: '14px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14, marginTop: 16 },
  kycCard: { background: '#1e293b', borderRadius: 10, padding: 20, marginBottom: 12,
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    border: '1px solid #334155' },
  kycActions: { display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 16 },
  approveBtn: { padding: '10px 20px', background: '#166534', color: '#4ade80',
    border: '1px solid #16a34a', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  rejectBtn: { padding: '10px 20px', background: '#7f1d1d', color: '#f87171',
    border: '1px solid #dc2626', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#64748b', fontSize: 12, fontWeight: 600,
    padding: '10px 12px', borderBottom: '1px solid #334155' },
  td: { padding: '12px', color: '#cbd5e1', fontSize: 13, verticalAlign: 'middle',
    borderBottom: '1px solid #1e293b' },
  badge: { padding: '3px 8px', borderRadius: 12, fontSize: 11, color: '#fff', fontWeight: 600 },
};

const roleColor = r => ({ ADMIN: '#7c3aed', USER: '#166534', UNVERIFIED: '#374151' }[r] || '#374151');

export default function Admin() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('Обзор');
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/me').then(r => {
      setUser(r.data);
      if (r.data.role !== 'ADMIN') navigate('/');
    });
    loadStats();
  }, []);

  useEffect(() => {
    if (tab === 'Обзор') loadStats();
    if (tab === 'KYC очередь') loadPending();
    if (tab === 'Пользователи') loadUsers();
  }, [tab]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const loadStats = () => api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
  const loadPending = () => api.get('/admin/kyc/pending').then(r => setPending(r.data)).catch(() => {});
  const loadUsers = () => api.get('/admin/users').then(r => setAllUsers(r.data)).catch(() => {});

  const approve = async (kycId) => {
    try {
      await api.post(`/admin/kyc/approve/${kycId}`);
      showToast('✅ KYC одобрен — 100 DPT заминчено');
      loadPending(); loadStats();
    } catch (e) { showToast('❌ ' + (e.response?.data?.detail || 'Ошибка')); }
  };

  const reject = async (kycId) => {
    const reason = prompt('Причина отклонения:') || 'Документы недействительны';
    try {
      await api.post(`/admin/kyc/reject/${kycId}?reason=${encodeURIComponent(reason)}`);
      showToast('KYC отклонён');
      loadPending(); loadStats();
    } catch (e) { showToast('❌ ' + (e.response?.data?.detail || 'Ошибка')); }
  };

  const toggleActive = async (userId, isActive) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-active`);
      showToast(isActive ? '🔒 Заблокирован' : '✅ Разблокирован');
      loadUsers();
    } catch (e) { showToast('❌ ' + (e.response?.data?.detail || 'Ошибка')); }
  };

  return (
    <div style={s.wrap}>
      {toast && <div style={s.toast}>{toast}</div>}

      <div style={s.sidebar}>
        <div style={s.sidebarTitle}>👑 Admin Panel</div>
        {TABS.map(t => (
          <div key={t} style={{ ...s.tab, background: tab === t ? '#1e40af' : 'transparent' }}
            onClick={() => setTab(t)}>
            {t === 'Обзор' && '📊 '}
            {t === 'KYC очередь' && '📋 '}
            {t === 'Пользователи' && '👥 '}
            {t}
            {t === 'KYC очередь' && pending.length > 0 && (
              <span style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff',
                borderRadius: 10, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                {pending.length}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={s.content}>

        {/* Обзор */}
        {tab === 'Обзор' && stats && (
          <div>
            <h2 style={s.pageTitle}>Обзор платформы</h2>
            <div style={s.statsGrid}>
              {[
                { label: 'Всего юзеров', val: stats.total_users, color: '#38bdf8', icon: '👥' },
                { label: 'KYC Pending', val: stats.pending_kyc, color: '#fbbf24', icon: '⏳' },
                { label: 'Верифицированных', val: stats.verified_users, color: '#4ade80', icon: '✅' },
                { label: 'Заблокированных', val: stats.banned_users, color: '#f87171', icon: '🔒' },
              ].map(({ label, val, color, icon }) => (
                <div key={label} style={{ ...s.statCard, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color, marginBottom: 4 }}>{val}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{label}</div>
                </div>
              ))}
            </div>
            {stats.pending_kyc > 0 && (
              <div style={s.alert} onClick={() => setTab('KYC очередь')}>
                ⚠️ {stats.pending_kyc} заявок ждут проверки →
              </div>
            )}
          </div>
        )}

        {/* KYC очередь */}
        {tab === 'KYC очередь' && (
          <div>
            <h2 style={s.pageTitle}>KYC очередь</h2>
            {pending.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 60 }}>
                <div style={{ fontSize: 48 }}>🎉</div>
                <p>Нет заявок на рассмотрении</p>
              </div>
            )}
            {pending.map(app => (
              <div key={app.id} style={s.kycCard}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                    {app.full_name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                    {app.user?.username} · {app.user?.email}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 3 }}>
                    📄 {app.document_type} · {app.document_number}
                  </div>
                  {app.user?.wallet_address && (
                    <div style={{ color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>
                      🏦 {app.user.wallet_address}
                    </div>
                  )}
                  <div style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>
                    Подано: {new Date(app.submitted_at).toLocaleString('ru-RU')}
                  </div>
                </div>
                <div style={s.kycActions}>
                  <button style={s.approveBtn} onClick={() => approve(app.id)}>✅ Одобрить</button>
                  <button style={s.rejectBtn} onClick={() => reject(app.id)}>❌ Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Пользователи */}
        {tab === 'Пользователи' && (
          <div>
            <h2 style={s.pageTitle}>Все пользователи</h2>
            <table style={s.table}>
              <thead>
                <tr>
                  {['ID', 'UID', 'Username', 'Email', 'Роль', 'Активен', 'Действия'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => (
                  <tr key={u.id}>
                    <td style={s.td}>{u.id}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>{u.uid}</td>
                    <td style={s.td}><strong>{u.username}</strong></td>
                    <td style={{ ...s.td, fontSize: 12 }}>{u.email}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: roleColor(u.role) }}>{u.role}</span>
                    </td>
                    <td style={s.td}>
                      <span style={{ color: u.is_active ? '#4ade80' : '#ef4444' }}>
                        {u.is_active ? '✅' : '🔒'}
                      </span>
                    </td>
                    <td style={s.td}>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => toggleActive(u.id, u.is_active)}
                          style={{ padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                            background: u.is_active ? '#7f1d1d' : '#166534',
                            color: u.is_active ? '#f87171' : '#4ade80',
                            border: `1px solid ${u.is_active ? '#dc2626' : '#16a34a'}` }}>
                          {u.is_active ? 'Забанить' : 'Разбанить'}
                        </button>
                      )}
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
