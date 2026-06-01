import { useState, useEffect } from 'react';
import api from '../api';

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
    padding: '40px 20px',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  container: { maxWidth: '780px', margin: '0 auto' },
  headerBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '14px',
    background: 'rgba(30, 64, 175, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '9999px', padding: '12px 32px', marginBottom: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  icon: {
    width: '42px', height: '42px',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    borderRadius: '12px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '24px',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.5)',
  },
  title: { fontSize: '28px', fontWeight: '700', color: 'white', margin: 0 },
  subtitle: { textAlign: 'center', color: '#94a3b8', fontSize: '15.5px', marginBottom: '40px' },
  statusCard: {
    background: 'linear-gradient(135deg, #064e3b, #14532d)',
    border: '1px solid #34d399', borderRadius: '20px', padding: '24px',
    marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '20px',
    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.15)',
  },
  formCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: '20px', padding: '36px',
    boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
  },
  label: { display: 'block', color: '#cbd5e1', fontSize: '14.5px', marginBottom: '8px', fontWeight: '500' },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(148,163,184,0.2)', borderRadius: '12px',
    padding: '16px 20px', color: 'white', fontSize: '16px', outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%', background: 'linear-gradient(90deg, #2563eb, #4f46e5)',
    color: 'white', fontSize: '17px', fontWeight: '600', padding: '16px',
    borderRadius: '12px', border: 'none', cursor: 'pointer', marginTop: '10px',
    boxShadow: '0 8px 25px rgba(37, 99, 235, 0.35)',
  },
  historyCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: '18px', padding: '24px', marginBottom: '16px',
  },
};

const STATUS_COLORS = {
  APPROVED: { bg: 'rgba(52,211,153,0.2)', color: '#34d399', label: 'Одобрено' },
  PENDING:  { bg: 'rgba(251,191,36,0.2)', color: '#fbbf24', label: 'На проверке' },
  REJECTED: { bg: 'rgba(239,68,68,0.2)',  color: '#f87171', label: 'Отклонено' },
};

export default function KYC() {
  const [form, setForm] = useState({ full_name: '', document_type: 'passport', document_number: '' });
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    api.get('/kyc/status').then(r => setStatus(r.data)).catch(() => setStatus({ status: 'none' }));
    api.get('/kyc/history').then(r => setHistory(r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/kyc/submit', form);
      setMessage({ type: 'success', text: 'Заявка успешно отправлена!' });
      const [s, h] = await Promise.all([
        api.get('/kyc/status'),
        api.get('/kyc/history'),
      ]);
      setStatus(s.data);
      setHistory(h.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Ошибка при отправке' });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !status || status.status === 'none' || status.status === 'REJECTED';

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={styles.headerBadge}>
            <div style={styles.icon}>🛡️</div>
            <h1 style={styles.title}>Верификация KYC</h1>
          </div>
          <p style={styles.subtitle}>
            Подтвердите личность для получения полного доступа к финансовым операциям
          </p>
        </div>

        {status?.status === 'APPROVED' && (
          <div style={styles.statusCard}>
            <div style={{ fontSize: '42px' }}>✅</div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '22px', color: '#34d399' }}>Верификация пройдена</h3>
              <p style={{ margin: 0, color: '#a7f3d0', fontSize: '15px' }}>
                Вы можете пользоваться всеми функциями платформы.
              </p>
            </div>
          </div>
        )}

        {status?.status === 'PENDING' && (
          <div style={{ ...styles.statusCard, background: 'linear-gradient(135deg, #78350f, #854d0e)', borderColor: '#fbbf24' }}>
            <div style={{ fontSize: '42px' }}>⏳</div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '22px', color: '#fbbf24' }}>На рассмотрении</h3>
              <p style={{ margin: 0, color: '#fed7aa', fontSize: '15px' }}>
                Проверка занимает от 30 минут до 24 часов.
              </p>
            </div>
          </div>
        )}

        {status?.status === 'REJECTED' && (
          <div style={{ ...styles.statusCard, background: 'linear-gradient(135deg, #7f1d1d, #991b1b)', borderColor: '#f87171' }}>
            <div style={{ fontSize: '42px' }}>❌</div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '22px', color: '#f87171' }}>Заявка отклонена</h3>
              <p style={{ margin: 0, color: '#fecaca', fontSize: '15px' }}>
                {status.rejection_reason || 'Подайте заявку повторно с корректными данными.'}
              </p>
            </div>
          </div>
        )}

        {canSubmit && (
          <div style={styles.formCard}>
            <h2 style={{ textAlign: 'center', marginBottom: '28px', fontSize: '24px', color: 'white' }}>
              Подать заявку
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label style={styles.label}>Полное имя</label>
                <input style={styles.input} type="text" placeholder="Иван Иванов"
                  value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div>
                <label style={styles.label}>Тип документа</label>
                <select style={styles.input} value={form.document_type}
                  onChange={e => setForm({ ...form, document_type: e.target.value })}>
                  <option value="passport">Паспорт</option>
                  <option value="id_card">ID-карта</option>
                  <option value="drivers_license">Водительское удостоверение</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Номер документа</label>
                <input style={styles.input} type="text" placeholder="AB123456"
                  value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} required />
              </div>
              <button type="submit" disabled={loading}
                style={{ ...styles.button, opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </form>
          </div>
        )}

        {message.text && (
          <div style={{
            marginTop: '24px', padding: '16px', borderRadius: '12px', textAlign: 'center',
            background: message.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: message.type === 'success' ? '#34d399' : '#f87171',
            border: `1px solid ${message.type === 'success' ? '#34d399' : '#f87171'}`,
          }}>
            {message.text}
          </div>
        )}

        {history.length > 0 && (
          <div style={{ marginTop: '50px' }}>
            <h2 style={{ fontSize: '22px', marginBottom: '20px', color: 'white' }}>
              История заявок ({history.length})
            </h2>
            {history.map(app => {
              const s = STATUS_COLORS[app.status] || STATUS_COLORS.PENDING;
              return (
                <div key={app.id} style={styles.historyCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>Заявка #{app.id}</div>
                      <div style={{ fontSize: '18px', fontWeight: '600', margin: '6px 0 4px' }}>{app.full_name}</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {app.document_type} · {app.document_number}
                      </div>
                    </div>
                    <span style={{ padding: '6px 18px', borderRadius: '9999px', fontSize: '13px',
                      fontWeight: '600', background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </div>
                  {app.rejection_reason && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                      background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '13px' }}>
                      Причина: {app.rejection_reason}
                    </div>
                  )}
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
                    Подано: {new Date(app.submitted_at).toLocaleDateString('ru-RU')}
                    {app.reviewed_at && ` · Рассмотрено: ${new Date(app.reviewed_at).toLocaleDateString('ru-RU')}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

