import { useState, useEffect, useCallback } from 'react';
import api from '../api';

const TABS = ["Overview", "KYC Queue", "All Users"];

const DOC_LABEL = {
  passport: "Паспорт",
  id_card: "ID-карта",
  drivers_license: "Водит. удост.",
};

const ROLE_COLOR = {
  ADMIN: "#7c3aed",
  USER: "#0284c7",
  UNVERIFIED: "#475569",
};

export default function Admin() {
  const [tab, setTab] = useState("Overview");
  const [stats, setStats] = useState(null);
  const [kycQueue, setKycQueue] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const flash = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3000);
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch {
      flash("Ошибка загрузки статистики");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadKycQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/kyc/pending");
      setKycQueue(res.data);
    } catch {
      flash("Ошибка загрузки KYC очереди");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch {
      flash("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "Overview") loadStats();
    if (tab === "KYC Queue") loadKycQueue();
    if (tab === "All Users") loadUsers();
  }, [tab, loadStats, loadKycQueue, loadUsers]);

  const approveKyc = async (kycId) => {
    try {
      await api.post(`/admin/kyc/approve/${kycId}`);
      flash("✅ KYC одобрен");
      loadKycQueue();
    } catch (e) {
      flash(e.response?.data?.detail || "Ошибка при одобрении");
    }
  };

  const rejectKyc = async () => {
    if (!rejectReason.trim()) return;
    try {
      await api.post(`/admin/kyc/reject/${rejectModal.kycId}?reason=${encodeURIComponent(rejectReason)}`);
      flash("❌ KYC отклонён");
      setRejectModal(null);
      setRejectReason("");
      loadKycQueue();
    } catch (e) {
      flash(e.response?.data?.detail || "Ошибка при отклонении");
    }
  };

  const toggleBan = async (userId, isActive) => {
    try {
      await api.patch(`/admin/users/${userId}?is_active=${!isActive}`);
      flash(isActive ? "Заблокирован" : "Разблокирован");
      loadUsers();
    } catch (e) {
      flash(e.response?.data?.detail || "Ошибка");
    }
  };

  const getPrimaryWallet = (user) => {
    if (!user.wallets || user.wallets.length === 0) return null;
    return user.wallets.find(w => w.is_primary) || user.wallets[0];
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Admin Panel</h1>
      {actionMsg && <div style={styles.toast}>{actionMsg}</div>}

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button key={t}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {loading && <p style={styles.hint}>Загрузка...</p>}

      {/* Overview */}
      {tab === "Overview" && stats && (
        <div style={styles.grid}>
          {[
            { label: "Всего пользователей", value: stats.total_users ?? "—", color: "#3b82f6" },
            { label: "Активных", value: stats.active_users ?? "—", color: "#10b981" },
            { label: "Заблокированных", value: stats.banned_users ?? "—", color: "#ef4444" },
            { label: "Верифицированных", value: stats.verified_users ?? "—", color: "#8b5cf6" },
            { label: "Pending KYC", value: stats.pending_kyc ?? "—", color: "#f59e0b" },
            { label: "Approved KYC", value: stats.approved_kyc ?? "—", color: "#10b981" },
          ].map((s) => (
            <div key={s.label} style={styles.statCard}>
              <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* KYC Queue */}
      {tab === "KYC Queue" && !loading && (
        <>
          {kycQueue.length === 0 ? (
            <p style={styles.hint}>Нет заявок на рассмотрении</p>
          ) : (
            <div style={styles.cardList}>
              {kycQueue.map((app) => (
                <div key={app.id} style={styles.kycCard}>
                  <div style={styles.kycMeta}>
                    <div>
                      <span style={styles.kycName}>{app.full_name}</span>
                      {app.user && (
                        <span style={styles.kycSub}>
                          {" "}· @{app.user.uid} · {app.user.email}
                        </span>
                      )}
                    </div>
                    <span style={styles.kycDate}>
                      {app.submitted_at
                        ? new Date(app.submitted_at).toLocaleDateString("ru-RU")
                        : "—"}
                    </span>
                  </div>
                  <div style={styles.kycDoc}>
                    <span style={styles.docBadge}>
                      {DOC_LABEL[app.document_type] || app.document_type}
                    </span>
                    <span style={styles.kycDocNum}>{app.document_number}</span>
                  </div>
                  <div style={styles.kycActions}>
                    <button style={styles.btnApprove} onClick={() => approveKyc(app.id)}>
                      Одобрить
                    </button>
                    <button style={styles.btnReject} onClick={() => setRejectModal({ kycId: app.id })}>
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* All Users */}
      {tab === "All Users" && !loading && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["ID", "UID", "Username", "Email", "Роль", "Кошелёк", "Активен", "Действия"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const w = getPrimaryWallet(u);
                return (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}>{u.id}</td>
                    <td style={{ ...styles.td, color: "#94a3b8" }}>{u.uid || "—"}</td>
                    <td style={styles.td}>{u.username}</td>
                    <td style={{ ...styles.td, color: "#94a3b8" }}>{u.email}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.roleBadge, background: ROLE_COLOR[u.role] || "#334155" }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: "#94a3b8", fontSize: 12 }}>
                      {w ? w.address.slice(0, 6) + "…" + w.address.slice(-4) : "—"}
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: u.is_active ? "#10b981" : "#ef4444" }}>
                        {u.is_active ? "Да" : "Нет"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {u.role !== "ADMIN" && (
                        <button
                          style={u.is_active ? styles.btnBan : styles.btnUnban}
                          onClick={() => toggleBan(u.id, u.is_active)}
                        >
                          {u.is_active ? "Бан" : "Разбан"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Причина отклонения</h3>
            <textarea
              style={styles.textarea}
              placeholder="Опишите причину..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
            <div style={styles.modalBtns}>
              <button style={styles.btnApprove} onClick={rejectKyc}>
                Подтвердить
              </button>
              <button style={styles.btnBan} onClick={() => { setRejectModal(null); setRejectReason(""); }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 960, margin: "0 auto", padding: "32px 16px", color: "#e2e8f0" },
  title: { fontSize: 28, fontWeight: 700, margin: "0 0 20px", color: "#f1f5f9" },
  tabs: { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" },
  tab: { padding: "8px 20px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 },
  tabActive: { background: "#3b82f6", border: "1px solid #3b82f6", color: "#fff" },
  toast: { background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 14 },
  hint: { color: "#64748b", fontSize: 15 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 },
  statCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "20px 16px", textAlign: "center" },
  statValue: { fontSize: 32, fontWeight: 700 },
  statLabel: { fontSize: 13, color: "#64748b", marginTop: 4 },
  cardList: { display: "flex", flexDirection: "column", gap: 16 },
  kycCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20 },
  kycMeta: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  kycName: { fontWeight: 600, fontSize: 16, color: "#f1f5f9" },
  kycSub: { fontSize: 13, color: "#64748b" },
  kycDate: { fontSize: 13, color: "#64748b", flexShrink: 0 },
  kycDoc: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
  docBadge: { background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "2px 8px", fontSize: 12, color: "#94a3b8" },
  kycDocNum: { fontSize: 14, color: "#e2e8f0" },
  kycActions: { display: "flex", gap: 10 },
  btnApprove: { padding: "8px 18px", background: "#166534", border: "1px solid #16a34a", color: "#86efac", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500 },
  btnReject: { padding: "8px 18px", background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { padding: "10px 12px", background: "#1e293b", borderBottom: "1px solid #334155", textAlign: "left", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #1e293b" },
  td: { padding: "10px 12px", color: "#e2e8f0", verticalAlign: "middle" },
  roleBadge: { padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: "#fff" },
  btnBan: { padding: "5px 12px", background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  btnUnban: { padding: "5px 12px", background: "#052e16", border: "1px solid #166534", color: "#86efac", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 },
  modalTitle: { fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#f1f5f9" },
  textarea: { width: "100%", padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 14, resize: "vertical", boxSizing: "border-box", marginBottom: 16 },
  modalBtns: { display: "flex", gap: 10 },
};
