import { useState, useEffect, useRef } from 'react';
import api from '../api';

export default function Chat() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeConv, setActiveConv] = useState(null);  // {conversation_id, with}
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get('/auth/me').then(r => setUser(r.data));
    api.get('/chat/users').then(r => setUsers(r.data));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChat = async (targetUser) => {
    // Закрываем старый WS
    if (wsRef.current) wsRef.current.close();
    setMessages([]);
    setStatus('connecting');

    const res = await api.post(`/chat/conversations/with/${targetUser.id}`);
    const { conversation_id, with: withUser } = res.data;
    setActiveConv({ conversation_id, with: withUser });

    // Загружаем историю
    const hist = await api.get(`/chat/conversations/${conversation_id}/messages`);
    setMessages(hist.data);

    // WebSocket
    const token = localStorage.getItem('access_token');
    const ws = new WebSocket(
      `ws://localhost:8000/api/v1/chat/ws/${conversation_id}?token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('error');
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setMessages(prev => [...prev, msg]);
    };
  };

  const send = (e) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current || status !== 'connected') return;
    wsRef.current.send(input);
    setInput('');
  };

  return (
    <div style={s.wrap}>
      {/* Sidebar — список пользователей */}
      <div style={s.sidebar}>
        <div style={s.sidebarTitle}>💬 Messages</div>
        {users.length === 0 && (
          <p style={s.muted}>No other users yet</p>
        )}
        {users.map(u => (
          <div
            key={u.id}
            style={{
              ...s.userItem,
              background: activeConv?.with?.id === u.id ? '#1e40af' : 'transparent',
            }}
            onClick={() => openChat(u)}
          >
            <div style={s.avatar}>{u.username[0].toUpperCase()}</div>
            <div>
              <div style={s.userName}>{u.username}</div>
              <div style={s.userRole}>{u.role}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={s.chatArea}>
        {!activeConv ? (
          <div style={s.placeholder}>
            <div style={s.placeholderIcon}>💬</div>
            <p style={s.placeholderText}>Select a user to start chatting</p>
          </div>
        ) : (
          <>
            <div style={s.chatHeader}>
              <div style={s.avatar}>{activeConv.with.username[0].toUpperCase()}</div>
              <span style={s.chatHeaderName}>{activeConv.with.username}</span>
              <div style={s.statusDot}>
                <span style={{
                  ...s.dot,
                  background: status === 'connected' ? '#4ade80' : '#ef4444'
                }} />
                <span style={s.statusText}>{status}</span>
              </div>
            </div>

            <div style={s.messages}>
              {messages.length === 0 && (
                <p style={s.muted}>No messages yet. Say hello!</p>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{
                  ...s.msgWrap,
                  justifyContent: m.sender_id === user?.id ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{
                    ...s.bubble,
                    background: m.sender_id === user?.id ? '#0369a1' : '#1e293b',
                    borderRadius: m.sender_id === user?.id
                      ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  }}>
                    {m.sender_id !== user?.id && (
                      <div style={s.senderName}>{m.sender}</div>
                    )}
                    <div style={s.msgText}>{m.content}</div>
                    <div style={s.time}>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} style={s.inputArea}>
              <input
                style={s.input}
                placeholder={status === 'connected' ? 'Type a message...' : 'Connecting...'}
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={status !== 'connected'}
              />
              <button style={{
                ...s.sendBtn,
                opacity: status !== 'connected' ? 0.5 : 1
              }} type="submit" disabled={status !== 'connected'}>
                ➤
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { display:'flex', height:'90vh', background:'#0f172a' },
  sidebar: { width:260, background:'#1e293b', borderRight:'1px solid #334155',
    display:'flex', flexDirection:'column' },
  sidebarTitle: { padding:'20px 16px', color:'#f1f5f9', fontWeight:700,
    fontSize:15, borderBottom:'1px solid #334155' },
  userItem: { display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
    cursor:'pointer', borderRadius:8, margin:'4px 8px', transition:'background 0.15s' },
  avatar: { width:36, height:36, borderRadius:'50%', background:'#0369a1',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 },
  userName: { color:'#f1f5f9', fontSize:14, fontWeight:500 },
  userRole: { color:'#64748b', fontSize:11, marginTop:2 },
  muted: { color:'#475569', textAlign:'center', padding:20, fontSize:13 },
  chatArea: { flex:1, display:'flex', flexDirection:'column' },
  placeholder: { flex:1, display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center' },
  placeholderIcon: { fontSize:48, marginBottom:16 },
  placeholderText: { color:'#475569', fontSize:15 },
  chatHeader: { padding:'16px 20px', borderBottom:'1px solid #334155',
    display:'flex', alignItems:'center', gap:12, background:'#1e293b' },
  chatHeaderName: { color:'#f1f5f9', fontWeight:600, flex:1 },
  statusDot: { display:'flex', alignItems:'center', gap:6 },
  dot: { width:8, height:8, borderRadius:'50%', display:'inline-block' },
  statusText: { color:'#64748b', fontSize:12 },
  messages: { flex:1, overflowY:'auto', padding:16,
    display:'flex', flexDirection:'column', gap:8 },
  msgWrap: { display:'flex' },
  bubble: { maxWidth:'65%', padding:'10px 14px' },
  senderName: { color:'#38bdf8', fontSize:11, marginBottom:4, fontWeight:600 },
  msgText: { color:'#f1f5f9', fontSize:14, lineHeight:1.4 },
  time: { color:'#475569', fontSize:10, marginTop:6, textAlign:'right' },
  inputArea: { padding:16, borderTop:'1px solid #334155',
    display:'flex', gap:8, background:'#1e293b' },
  input: { flex:1, padding:'12px 16px', borderRadius:24,
    border:'1px solid #334155', background:'#0f172a',
    color:'#f1f5f9', fontSize:14, outline:'none' },
  sendBtn: { width:44, height:44, borderRadius:'50%', background:'#0369a1',
    color:'#fff', border:'none', cursor:'pointer', fontSize:18,
    display:'flex', alignItems:'center', justifyContent:'center' },
};
