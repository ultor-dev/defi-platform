import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function KYC() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ full_name:'', document_type:'passport', document_number:'' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { api.get('/auth/me').then(r => setUser(r.data)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/kyc/submit', form);
      setSuccess(true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Submission failed');
    }
  };

  if (!user) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={styles.title}>KYC Verification</h2>

        {user.kyc_status === 'APPROVED' && (
          <div style={styles.approved}>✅ Your identity is verified. Full access unlocked.</div>
        )}

        {user.kyc_status === 'PENDING' && (
          <div style={styles.pending}>⏳ Your KYC is under review. Please wait.</div>
        )}

        {user.kyc_status === 'REJECTED' && (
          <div style={styles.rejected}>❌ KYC rejected. Please resubmit with correct info.</div>
        )}

        {(user.kyc_status === 'NONE' || user.kyc_status === 'REJECTED') && !success && (
          <form onSubmit={submit}>
            <label style={styles.label}>Full Name</label>
            <input style={styles.input} placeholder="As on your document"
              value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />

            <label style={styles.label}>Document Type</label>
            <select style={styles.input} value={form.document_type}
              onChange={e => setForm({...form, document_type: e.target.value})}>
              <option value="passport">Passport</option>
              <option value="id_card">ID Card</option>
              <option value="drivers_license">Driver's License</option>
            </select>

            <label style={styles.label}>Document Number</label>
            <input style={styles.input} placeholder="Document number"
              value={form.document_number} onChange={e => setForm({...form, document_number: e.target.value})} />

            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btn} type="submit">Submit KYC</button>
          </form>
        )}

        {success && <div style={styles.approved}>✅ Submitted! Waiting for review.</div>}
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight:'90vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center' },
  card: { background:'#1e293b', borderRadius:12, padding:40, width:420 },
  title: { color:'#f1f5f9', marginBottom:24 },
  label: { display:'block', color:'#94a3b8', fontSize:13, marginBottom:4 },
  input: { width:'100%', padding:'10px 12px', marginBottom:16, borderRadius:6,
    border:'1px solid #334155', background:'#0f172a', color:'#f1f5f9',
    fontSize:14, boxSizing:'border-box' },
  btn: { width:'100%', padding:12, background:'#38bdf8', color:'#0f172a',
    border:'none', borderRadius:6, fontWeight:700, cursor:'pointer' },
  error: { color:'#ef4444', fontSize:13, marginBottom:8 },
  loading: { color:'#fff', textAlign:'center', padding:60 },
  approved: { background:'#14532d', color:'#4ade80', padding:16, borderRadius:8, textAlign:'center' },
  pending: { background:'#451a03', color:'#fbbf24', padding:16, borderRadius:8, textAlign:'center' },
  rejected: { background:'#450a0a', color:'#f87171', padding:16, borderRadius:8, textAlign:'center' },
};
