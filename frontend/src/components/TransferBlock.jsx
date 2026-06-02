import { useState } from 'react';
import api from '../api';

export default function TransferBlock({ wallets }) {
  const [fromId, setFromId]     = useState(wallets.find(w => w.is_primary)?.id ?? wallets[0]?.id ?? '');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);  // { ok, tx_hash, error }

  const fromWallet = wallets.find(w => w.id === fromId);

  const handleSubmit = async () => {
    if (!toAddress.trim() || !amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await api.post('/wallet/transfer', {
        wallet_id:  fromId,
        to_address: toAddress.trim(),
        amount:     parseFloat(amount),
      });
      setResult({ ok: true, tx_hash: r.data.tx_hash });
      setToAddress('');
      setAmount('');
    } catch (e) {
      setResult({ ok: false, error: e.response?.data?.detail || 'Transfer failed' });
    } finally {
      setLoading(false);
    }
  };

  const isValid = toAddress.trim().length > 0 && parseFloat(amount) > 0 && fromId;

  return (
    <div className="card">
      <div style={s.head}>
        <span style={s.icon}>↗</span>
        <span style={s.title}>Send DPT</span>
      </div>

      {/* От какого кошелька */}
      <div style={s.field}>
        <label style={s.label}>From wallet</label>
        <select
          style={s.select}
          value={fromId}
          onChange={e => setFromId(Number(e.target.value))}
        >
          {wallets.map(w => (
            <option key={w.id} value={w.id}>
              {w.label || 'Wallet'} — {w.address.slice(0,8)}…{w.address.slice(-6)}
              {w.is_primary ? ' ★' : ''}
            </option>
          ))}
        </select>
        {fromWallet && (
          <div style={s.fromAddr}>{fromWallet.address}</div>
        )}
      </div>

      {/* Адрес получателя */}
      <div style={s.field}>
        <label style={s.label}>Recipient address</label>
        <input
          style={s.input}
          placeholder="0x..."
          value={toAddress}
          onChange={e => setToAddress(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Сумма */}
      <div style={s.field}>
        <label style={s.label}>Amount (DPT)</label>
        <div style={s.amountRow}>
          <input
            style={{ ...s.input, flex: 1 }}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <span style={s.sym}>DPT</span>
        </div>
      </div>

      {/* Кнопка */}
      <button
        style={{ ...s.btn, ...(loading || !isValid ? s.btnDisabled : {}) }}
        onClick={handleSubmit}
        disabled={loading || !isValid}
      >
        {loading ? 'Sending…' : 'Send →'}
      </button>

      {/* Результат */}
      {result && (
        <div style={{ ...s.result, ...(result.ok ? s.resultOk : s.resultErr) }}>
          {result.ok ? (
            <>
              <div style={s.resultTitle}>✓ Sent successfully</div>
              <div style={s.resultHash}>
                tx: {result.tx_hash?.slice(0, 20)}…{result.tx_hash?.slice(-8)}
              </div>
            </>
          ) : (
            <>
              <div style={s.resultTitle}>✕ Failed</div>
              <div style={s.resultMsg}>{result.error}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  head:  { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  icon:  { fontSize: 20, color: '#38bdf8' },
  title: { fontWeight: 600, fontSize: 16, color: '#f1f5f9' },

  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#475569', textTransform: 'uppercase', marginBottom: 6 },

  select: {
    width: '100%',
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 13,
    padding: '9px 12px',
    outline: 'none',
    cursor: 'pointer',
  },
  fromAddr: {
    marginTop: 5,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#334155',
    wordBreak: 'break-all',
  },

  input: {
    width: '100%',
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 13,
    padding: '9px 12px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
  },

  amountRow: { display: 'flex', alignItems: 'center', gap: 10 },
  sym: { fontSize: 13, fontWeight: 700, color: '#475569', flexShrink: 0 },

  btn: {
    width: '100%',
    padding: '11px',
    background: '#38bdf8',
    border: 'none',
    borderRadius: 9,
    color: '#070d1a',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'opacity 0.15s',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },

  result: { marginTop: 14, borderRadius: 9, padding: '12px 14px' },
  resultOk:  { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' },
  resultErr: { background: 'rgba(239,68,68,0.1)',  border: '1px solid rgba(239,68,68,0.3)'  },
  resultTitle: { fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#f1f5f9' },
  resultHash:  { fontFamily: 'monospace', fontSize: 11, color: '#64748b' },
  resultMsg:   { fontSize: 13, color: '#fca5a5' },
};
