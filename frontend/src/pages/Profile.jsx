import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    full_name: '',
    bio: '',
    avatar_url: '',
    country: '',
    phone: '',
    telegram: '',
    birth_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(r => {
      setUser(r.data);
      if (r.data.profile) {
        setProfile({
          full_name: r.data.profile.full_name || '',
          bio: r.data.profile.bio || '',
          avatar_url: r.data.profile.avatar_url || '',
          country: r.data.profile.country || '',
          phone: r.data.profile.phone || '',
          telegram: r.data.profile.telegram || '',
          birth_date: r.data.profile.birth_date || '',
        });
      }
    });
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.patch('/profile', profile);
      setMsg('Profile updated!');
      setMsgType('success');
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Save failed');
      setMsgType('error');
    } finally {
      setSaving(false);
    }
  };

  const sendVerification = async () => {
    setMsg('');
    try {
      await api.post('/auth/send-verification');
      setMsg('Verification email sent!');
      setMsgType('success');
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Failed to send');
      setMsgType('error');
    }
  };

  if (!user) return <div style={styles.loading}>Loading...</div>;

  const getPrimaryWallet = () => {
    if (!user.wallets || user.wallets.length === 0) return null;
    return user.wallets.find(w => w.is_primary) || user.wallets[0];
  };

  const wallet = getPrimaryWallet();

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={styles.title}>👤 Profile</h2>

        {msg && (
          <div style={{ ...styles.msg, background: msgType === 'success' ? '#052e16' : '#450a0a', color: msgType === 'success' ? '#86efac' : '#fca5a5' }}>
            {msg}
          </div>
        )}

        {/* Account Info */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Account</h3>
          <div style={styles.infoRow}>
            <span style={styles.label}>Username</span>
            <span style={styles.value}>{user.username}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Email</span>
            <span style={styles.value}>{user.email}</span>
            {!user.email_verified && (
              <button onClick={sendVerification} style={styles.verifyBtn}>
                Verify email
              </button>
            )}
            {user.email_verified && <span style={styles.verifiedBadge}>✅ Verified</span>}
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Role</span>
            <span style={{ ...styles.badge, background: user.role === 'ADMIN' ? '#7c3aed' : user.role === 'USER' ? '#0284c7' : '#475569' }}>
              {user.role}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Status</span>
            <span style={{ color: user.is_active ? '#10b981' : '#ef4444' }}>
              {user.is_active ? 'Active' : 'Banned'}
            </span>
          </div>
        </div>

        {/* Wallet Info */}
        {wallet && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Wallet</h3>
            <div style={styles.infoRow}>
              <span style={styles.label}>Address</span>
              <code style={styles.walletAddr}>{wallet.address}</code>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.label}>Label</span>
              <span style={styles.value}>{wallet.label || '—'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.label}>Primary</span>
              <span style={{ color: wallet.is_primary ? '#10b981' : '#64748b' }}>
                {wallet.is_primary ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={save}>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Personal Info</h3>
            <div style={styles.formRow}>
              <label style={styles.label}>Full Name</label>
              <input style={styles.input} value={profile.full_name}
                onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Bio</label>
              <textarea style={styles.textarea} rows={3}
                placeholder="Tell about yourself..."
                value={profile.bio}
                onChange={e => setProfile({ ...profile, bio: e.target.value })} />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Avatar URL</label>
              <input style={styles.input} value={profile.avatar_url}
                onChange={e => setProfile({ ...profile, avatar_url: e.target.value })} />
            </div>
            <div style={styles.formRowHalf}>
              <div>
                <label style={styles.label}>Country</label>
                <input style={styles.input} value={profile.country}
                  onChange={e => setProfile({ ...profile, country: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Phone</label>
                <input style={styles.input} value={profile.phone}
                  onChange={e => setProfile({ ...profile, phone: e.target.value })} />
              </div>
            </div>
            <div style={styles.formRowHalf}>
              <div>
                <label style={styles.label}>Telegram</label>
                <input style={styles.input} placeholder="@username" value={profile.telegram}
                  onChange={e => setProfile({ ...profile, telegram: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Birth Date</label>
                <input style={styles.input} type="date" value={profile.birth_date}
                  onChange={e => setProfile({ ...profile, birth_date: e.target.value })} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <button onClick={() => navigate('/')} style={styles.backBtn}>← Back to Dashboard</button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: 32, background: '#0f172a', minHeight: '90vh', display: 'flex', justifyContent: 'center' },
  loading: { color: '#fff', textAlign: 'center', padding: 60 },
  card: { background: '#1e293b', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560 },
  title: { color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: '0 0 24px', textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#38bdf8', fontSize: 14, fontWeight: 600, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 },
  infoRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14 },
  label: { color: '#64748b', minWidth: 100, fontSize: 13 },
  value: { color: '#e2e8f0' },
  badge: { padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: '#fff' },
  walletAddr: { color: '#94a3b8', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' },
  verifiedBadge: { color: '#10b981', fontSize: 12 },
  verifyBtn: { padding: '2px 10px', background: '#854d0e', border: '1px solid #a16207', borderRadius: 6, color: '#fde047', cursor: 'pointer', fontSize: 11 },
  formRow: { marginBottom: 12 },
  formRowHalf: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  input: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' },
  saveBtn: { width: '100%', padding: 12, background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  backBtn: { width: '100%', padding: 10, background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: 8, cursor: 'pointer', fontSize: 14, marginTop: 8 },
  msg: { padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
};
