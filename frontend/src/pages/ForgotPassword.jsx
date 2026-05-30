import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Error');
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h2 style={s.title}>Forgot Password</h2>
        {sent ? (
          <div style={s.success}>
            ✅ If this email exists, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={submit}>
            <p style={s.hint}>Enter your email and we'll send you a reset link.</p>
            <input style={s.input} type="email" placeholder="Email"
              value={email} onChange={e => setEmail(e.target.value)} required />
            {error && <p style={s.error}>{error}</p>}
            <button style={s.btn} type="submit">Send Reset Link</button>
          </form>
        )}
        <p style={s.foot}><Link to="/login" style={s.link}>← Back to Login</Link></p>
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight:'90vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a' },
  card: { background:'#1e293b', padding:40, borderRadius:12, width:380 },
  title: { color:'#f1f5f9', marginBottom:16, textAlign:'center' },
  hint: { color:'#94a3b8', fontSize:13, marginBottom:20 },
  input: { width:'100%', padding:'10px 12px', marginBottom:12, borderRadius:6,
    border:'1px solid #334155', background:'#0f172a', color:'#f1f5f9',
    fontSize:14, boxSizing:'border-box' },
  btn: { width:'100%', padding:12, background:'#38bdf8', color:'#0f172a',
    border:'none', borderRadius:6, fontWeight:700, cursor:'pointer' },
  error: { color:'#ef4444', fontSize:13, marginBottom:8 },
  success: { background:'#14532d', color:'#4ade80', padding:16, borderRadius:8, fontSize:14 },
  foot: { marginTop:16, textAlign:'center' },
  link: { color:'#38bdf8', fontSize:13 },
};
