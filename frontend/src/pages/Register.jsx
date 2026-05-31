import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', form);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
	setError(detail.map(d => d.msg).join(', '));
      } else {
	setError(detail || 'Registration failed');
      }
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={styles.title}>Create account</h2>
        {success ? (
          <p style={{color:'#4ade80', textAlign:'center'}}>✅ Registered! Redirecting...</p>
        ) : (
          <form onSubmit={submit}>
            <input style={styles.input} placeholder="Email" type="email"
              value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <input style={styles.input} placeholder="Username"
              value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
            <input style={styles.input} placeholder="Password" type="password"
              value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btn} type="submit">Register</button>
          </form>
        )}
        <p style={styles.foot}>Have account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight:'90vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'#0f172a' },
  card: { background:'#1e293b', padding:40, borderRadius:12, width:360 },
  title: { color:'#f1f5f9', marginBottom:24, textAlign:'center' },
  input: { width:'100%', padding:'10px 12px', marginBottom:12, borderRadius:6,
    border:'1px solid #334155', background:'#0f172a', color:'#f1f5f9',
    fontSize:14, boxSizing:'border-box' },
  btn: { width:'100%', padding:12, background:'#38bdf8', color:'#0f172a',
    border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:15 },
  error: { color:'#ef4444', fontSize:13, marginBottom:8 },
  foot: { color:'#94a3b8', textAlign:'center', marginTop:16, fontSize:13 },
};
