import { useState, useEffect, useRef } from 'react';
import api from '../api';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [convId, setConvId] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get('/auth/me').then(r => setUser(r.data));
  }, []);

  useEffect(() => {
    // Создаём или используем conversation_id=1 для demo
    setConvId(1);
  }, []);

  useEffect(() => {
    if (!convId || !user) return;

    // Загружаем историю
    api.get(`/chat/conversations/${convId}/messages`).then(r => setMessages(r.data));

    // WebSocket
    const token = localStorage.getItem('access_token');
    const ws = new WebSocket(`ws://localhost:8000/api/v1/chat/ws/${convId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('error');
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setMessages(prev => [...prev, msg]);
    };

    return () => ws.close();
  }, [convId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(input);
    setInput('');
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>💬 Platform Chat</span>
          <span style={{...styles.dot, background: status==='connected'?'#4ade80':'#ef4444'}} />
          <span style={styles.statusText}>{status}</span>
        </div>

        <div style={styles.messages}>
          {messages.length === 0 && (
            <p style={styles.empty}>No messages yet. Say hello!</p>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              ...styles.msgWrap,
              justifyContent: m.sender_id === user?.id ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                ...styles.bubble,
                background: m.sender_id === user?.id ? '#0369a1' : '#1e293b',
              }}>
                {m.sender_id !== user?.id && (
                  <div style={styles.sender}>{m.sender || 'User'}</div>
                )}
                <div style={styles.msgText}>{m.content || m.encrypted_content}</div>
                <div style={styles.time}>
                  {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} style={styles.inputArea}>
          <input
            style={styles.input}
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={status !== 'connected'}
          />
          <button style={styles.btn} type="submit" disabled={status !== 'connected'}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrap: { height:'90vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center' },
  container: { width:680, height:'80vh', background:'#1e293b', borderRadius:12,
    display:'flex', flexDirection:'column', overflow:'hidden' },
  header: { padding:'16px 20px', borderBottom:'1px solid #334155', display:'flex',
    alignItems:'center', gap:8 },
  title: { color:'#f1f5f9', fontWeight:700, flex:1 },
  dot: { width:8, height:8, borderRadius:'50%' },
  statusText: { color:'#64748b', fontSize:12 },
  messages: { flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:8 },
  empty: { color:'#475569', textAlign:'center', marginTop:40 },
  msgWrap: { display:'flex' },
  bubble: { maxWidth:'70%', padding:'10px 14px', borderRadius:12 },
  sender: { color:'#38bdf8', fontSize:11, marginBottom:4, fontWeight:600 },
  msgText: { color:'#f1f5f9', fontSize:14 },
  time: { color:'#475569', fontSize:10, marginTop:4, textAlign:'right' },
  inputArea: { padding:16, borderTop:'1px solid #334155', display:'flex', gap:8 },
  input: { flex:1, padding:'10px 14px', borderRadius:8, border:'1px solid #334155',
    background:'#0f172a', color:'#f1f5f9', fontSize:14 },
  btn: { padding:'10px 20px', background:'#38bdf8', color:'#0f172a', border:'none',
    borderRadius:8, fontWeight:700, cursor:'pointer' },
};
