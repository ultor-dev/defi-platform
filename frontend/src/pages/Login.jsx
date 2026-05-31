import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      navigate('/');
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg).join(', '));
      } else {
        setError(detail || 'Login failed');
      }
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome back</h2>
        <form onSubmit={submit}>
          <input style={styles.input} placeholder="Email" type="email"
            value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input style={styles.input} placeholder="Password" type="password"
            value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit">Login</button>
        </form>
        <div style={styles.links}>
          <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
          <span style={styles.sep}>·</span>
          <Link to="/register" style={styles.forgotLink}>Register</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight:'90vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a' },
  card: { background:'#1e293b', padding:40, borderRadius:12, width:360 },
  title: { color:'#f1f5f9', marginBottom:24, textAlign:'center' },
  input: { width:'100%', padding:'10px 12px', marginBottom:12, borderRadius:6,
    border:'1px solid #334155', background:'#0f172a', color:'#f1f5f9',
    fontSize:14, boxSizing:'border-box' },
  btn: { width:'100%', padding:12, background:'#38bdf8', color:'#0f172a',
    border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:15 },
  error: { color:'#ef4444', fontSize:13, marginBottom:8 },
  links: { display:'flex', justifyContent:'center', gap:8, marginTop:16, alignItems:'center' },
  forgotLink: { color:'#38bdf8', fontSize:13, textDecoration:'none' },
  sep: { color:'#334155' },
};
