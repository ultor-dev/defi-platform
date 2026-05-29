import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const isAuth = !!localStorage.getItem('access_token');

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.brand}>⬡ DeFi Platform</Link>
      <div style={styles.links}>
        {isAuth ? (
          <>
            <Link to="/" style={styles.link}>Dashboard</Link>
            <Link to="/kyc" style={styles.link}>KYC</Link>
            <Link to="/chat" style={styles.link}>Chat</Link>
            <button onClick={logout} style={styles.btn}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.link}>Login</Link>
            <Link to="/register" style={styles.link}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

const styles = {
  nav: { display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'12px 32px', background:'#0f172a', color:'#fff' },
  brand: { color:'#38bdf8', fontWeight:700, fontSize:20, textDecoration:'none' },
  links: { display:'flex', gap:20, alignItems:'center' },
  link: { color:'#cbd5e1', textDecoration:'none', fontSize:14 },
  btn: { background:'#ef4444', color:'#fff', border:'none', padding:'6px 14px',
    borderRadius:6, cursor:'pointer', fontSize:14 },
};
