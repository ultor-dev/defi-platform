import { useEffect, useState } from 'react';
import api from '../api';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [transfer, setTransfer] = useState({ to_address: '', amount: '' });
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(r => setUser(r.data));
  }, []);

  useEffect(() => {
    if (user?.role === 'USER' || user?.role === 'MODERATOR' || user?.role === 'ADMIN') {
      api.get('/wallet/balance').then(r => setBalance(r.data));
    }
  }, [user]);

  const doTransfer = async (e) => {
    e.preventDefault();
    setError(''); setTxHash('');
    try {
      const res = await api.post('/wallet/transfer', {
        to_address: transfer.to_address,
        amount: parseFloat(transfer.amount),
      });
      setTxHash(res.data.tx_hash);
    } catch (e) {
      setError(e.response?.data?.detail || 'Transfer failed');
    }
  };

  const exportKey = async () => {
    try {
      const res = await api.get('/wallet/export-key');
      alert(`Private Key:\n${res.data.private_key}\n\n⚠️ ${res.data.warning}`);
    } catch (e) {
      alert('Only verified users can export keys');
    }
  };

  if (!user) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.wrap}>
      <div style={styles.grid}>

        {/* Profile card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>👤 Profile</h3>
          <div style={styles.row}><span style={styles.label}>Username</span><span>{user.username}</span></div>
          <div style={styles.row}><span style={styles.label}>Email</span><span>{user.email}</span></div>
          <div style={styles.row}>
            <span style={styles.label}>Role</span>
            <span style={{...styles.badge, background: user.role==='USER'?'#166534':user.role==='MODERATOR'?'#1e40af':'#374151'}}>
              {user.role}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>KYC</span>
            <span style={{...styles.badge, background: user.kyc_status==='APPROVED'?'#166534':user.kyc_status==='PENDING'?'#854d0e':'#374151'}}>
              {user.kyc_status}
            </span>
          </div>
          {user.kyc_status !== 'APPROVED' && (
            <a href="/kyc" style={styles.kycLink}>→ Complete KYC to unlock full access</a>
          )}
        </div>

        {/* Wallet card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>💳 Wallet</h3>
          <div style={styles.address}>{user.wallet?.address}</div>
          {balance ? (
            <>
              <div style={styles.balanceRow}>
                <div style={styles.balanceItem}>
                  <div style={styles.balanceNum}>{parseFloat(balance.eth).toFixed(4)}</div>
                  <div style={styles.balanceLabel}>ETH</div>
                </div>
                <div style={styles.balanceItem}>
                  <div style={styles.balanceNum}>{parseFloat(balance.token).toFixed(2)}</div>
                  <div style={styles.balanceLabel}>DPT</div>
                </div>
              </div>
              <form onSubmit={doTransfer} style={{marginTop:16}}>
                <input style={styles.input} placeholder="Recipient address (0x...)"
                  value={transfer.to_address}
                  onChange={e => setTransfer({...transfer, to_address: e.target.value})} />
                <input style={styles.input} placeholder="Amount DPT"
                  type="number" step="0.01"
                  value={transfer.amount}
                  onChange={e => setTransfer({...transfer, amount: e.target.value})} />
                {error && <p style={styles.error}>{error}</p>}
                {txHash && <p style={styles.success}>✅ TX: {txHash.slice(0,20)}...</p>}
                <button style={styles.btn} type="submit">Send Tokens</button>
              </form>
            </>
          ) : (
            <p style={styles.muted}>Complete KYC to see balance and transfer tokens</p>
          )}
          <button onClick={exportKey} style={styles.btnSecondary}>Export Private Key</button>
        </div>

      </div>
    </div>
  );
}

const styles = {
  wrap: { padding:32, background:'#0f172a', minHeight:'90vh' },
  loading: { color:'#fff', textAlign:'center', padding:60 },
  grid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, maxWidth:900, margin:'0 auto' },
  card: { background:'#1e293b', borderRadius:12, padding:24 },
  cardTitle: { color:'#38bdf8', marginBottom:20, fontSize:16, fontWeight:700 },
  row: { display:'flex', justifyContent:'space-between', alignItems:'center',
    marginBottom:12, color:'#cbd5e1', fontSize:14 },
  label: { color:'#64748b' },
  badge: { padding:'3px 10px', borderRadius:20, fontSize:12, color:'#fff', fontWeight:600 },
  address: { color:'#94a3b8', fontSize:11, wordBreak:'break-all', marginBottom:16,
    background:'#0f172a', padding:8, borderRadius:6 },
  balanceRow: { display:'flex', gap:16, marginBottom:8 },
  balanceItem: { flex:1, background:'#0f172a', borderRadius:8, padding:12, textAlign:'center' },
  balanceNum: { color:'#f1f5f9', fontSize:22, fontWeight:700 },
  balanceLabel: { color:'#64748b', fontSize:12, marginTop:2 },
  input: { width:'100%', padding:'8px 10px', marginBottom:8, borderRadius:6,
    border:'1px solid #334155', background:'#0f172a', color:'#f1f5f9',
    fontSize:13, boxSizing:'border-box' },
  btn: { width:'100%', padding:10, background:'#38bdf8', color:'#0f172a',
    border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', marginBottom:8 },
  btnSecondary: { width:'100%', padding:10, background:'transparent', color:'#64748b',
    border:'1px solid #334155', borderRadius:6, cursor:'pointer', fontSize:13 },
  error: { color:'#ef4444', fontSize:12, marginBottom:8 },
  success: { color:'#4ade80', fontSize:12, marginBottom:8 },
  muted: { color:'#64748b', fontSize:13, textAlign:'center', margin:'20px 0' },
  kycLink: { display:'block', marginTop:12, color:'#38bdf8', fontSize:12, textDecoration:'none' },
};
