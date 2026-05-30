import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const token = params.get('token');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        {status === 'verifying' && <p style={s.text}>⏳ Verifying your email...</p>}
        {status === 'success' && (
          <>
            <div style={s.success}>✅ Email verified! You can now login.</div>
            <p style={s.foot}><Link to="/login" style={s.link}>Go to Login →</Link></p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={s.error}>❌ Invalid or expired verification link.</div>
            <p style={s.foot}><Link to="/" style={s.link}>Go to Dashboard →</Link></p>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight:'90vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a' },
  card: { background:'#1e293b', padding:40, borderRadius:12, width:380, textAlign:'center' },
  text: { color:'#94a3b8' },
  success: { background:'#14532d', color:'#4ade80', padding:16, borderRadius:8, marginBottom:16 },
  error: { background:'#7f1d1d', color:'#f87171', padding:16, borderRadius:8, marginBottom:16 },
  foot: { marginTop:12 },
  link: { color:'#38bdf8', fontSize:14 },
};
