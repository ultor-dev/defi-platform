import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const token = params.get('token');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Min 8 characters'); return; }
    try {
      await api.post('/auth/reset-password', { token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (e) {
      setError(e.response?.data?.detail || 'Invalid or expired link');
    }
  };

  if (!token) return (
    <div style={s.wrap}>
      <div style={s.card}>
        <p style={{ color:'#ef4444', textAlign:'center' }}>Invalid reset link.</p>
        <p style={{ textAlign:'center' }}><Link to="/login" style={s.link}>Go to Login</Link></p>
      </div>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h2 style={s.title}>Reset Password</h2>
        {success ? (
          <div style={s.success}>✅ Password reset! Redirecting to login...</div>
        ) : (
          <form onSubmit={submit}>
            <input style={s.input} type="password" placeholder="New password (min 8 chars)"
              value={password} onChange={e => setPassword(e.target.value)} required />
            <input style={s.input} type="password" placeholder="Confirm password"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
            {error && <p style={s.error}>{error}</p>}
            <button style={s.btn} type="submit">Reset Password</button>
          </form>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight:'90vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a' },
  card: { background:'#1e293b', padding:40, borderRadius:12, width:380 },
  title: { color:'#f1f5f9', marginBottom:20, textAlign:'center' },
  input: { width:'100%', padding:'10px 12px', marginBottom:12, borderRadius:6,
    border:'1px solid #334155', background:'#0f172a', color:'#f1f5f9',
    fontSize:14, boxSizing:'border-box' },
  btn: { width:'100%', padding:12, background:'#38bdf8', color:'#0f172a',
    border:'none', borderRadius:6, fontWeight:700, cursor:'pointer' },
  error: { color:'#ef4444', fontSize:13, marginBottom:8 },
  success: { background:'#14532d', color:'#4ade80', padding:16, borderRadius:8 },
  link: { color:'#38bdf8', fontSize:13 },
};
