import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STATUS_LABELS = {
  PENDING: { label: "На рассмотрении", color: "#f59e0b" },
  APPROVED: { label: "Одобрено", color: "#10b981" },
  REJECTED: { label: "Отклонено", color: "#ef4444" },
};

const DOCUMENT_TYPES = [
  { value: "passport", label: "Паспорт" },
  { value: "id_card", label: "ID-карта" },
  { value: "drivers_license", label: "Водительское удостоверение" },
];

export default function KYC() {
  const [applications, setApplications] = useState([]);
  const [latestStatus, setLatestStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    document_type: "passport",
    document_number: "",
  });

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      // Получаем историю заявок
      const [histRes, statusRes] = await Promise.allSettled([
        api.get("/kyc/my-applications"),
        api.get("/kyc/status"),
      ]);

      if (histRes.status === "fulfilled") {
        setApplications(histRes.value.data);
      }
      if (statusRes.status === "fulfilled") {
        setLatestStatus(statusRes.value.data);
      }
    } catch (e) {
      // Нет заявок — нормально
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!form.full_name.trim()) return setError("Введите полное имя");
    if (!form.document_number.trim()) return setError("Введите номер документа");

    setSubmitting(true);
    try {
      await api.post("/kyc/submit", form);
      setSuccess("Заявка отправлена! Ожидайте проверки.");
      setForm({ full_name: "", document_type: "passport", document_number: "" });
      await fetchStatus();
    } catch (e) {
      setError(e.response?.data?.detail || "Ошибка при отправке заявки");
    } finally {
      setSubmitting(false);
    }
  };

  // Можно ли подать новую заявку
  const canSubmit =
    !latestStatus ||
    latestStatus.status === "REJECTED" ||
    applications.length === 0;

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={{ color: "#94a3b8" }}>Загрузка...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>KYC Верификация</h1>
      <p style={styles.subtitle}>
        Пройдите верификацию личности для получения полного доступа к платформе.
      </p>

      {/* Текущий статус */}
      {latestStatus && (
        <div style={styles.statusCard}>
          <div style={styles.statusHeader}>
            <span style={styles.statusLabel}>Последняя заявка</span>
            <span
              style={{
                ...styles.statusBadge,
                background: STATUS_LABELS[latestStatus.status]?.color || "#64748b",
              }}
            >
              {STATUS_LABELS[latestStatus.status]?.label || latestStatus.status}
            </span>
          </div>

          {latestStatus.status === "APPROVED" && (
            <p style={{ color: "#10b981", marginTop: 8 }}>
              ✅ Ваша личность подтверждена. Вам начислено 100 DPT.
            </p>
          )}

          {latestStatus.status === "REJECTED" && latestStatus.rejection_reason && (
            <div style={styles.rejectionBox}>
              <strong>Причина отклонения:</strong>
              <p style={{ margin: "4px 0 0" }}>{latestStatus.rejection_reason}</p>
            </div>
          )}

          {latestStatus.status === "PENDING" && (
            <p style={{ color: "#94a3b8", marginTop: 8 }}>
              Заявка на рассмотрении. Обычно проверка занимает до 24 часов.
            </p>
          )}
        </div>
      )}

      {/* Форма подачи */}
      {canSubmit && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>
            {latestStatus?.status === "REJECTED"
              ? "Подать повторную заявку"
              : "Подать заявку на верификацию"}
          </h2>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.successMsg}>{success}</div>}

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Полное имя (как в документе)</label>
            <input
              style={styles.input}
              placeholder="Иванов Иван Иванович"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Тип документа</label>
            <select
              style={styles.input}
              value={form.document_type}
              onChange={(e) => setForm({ ...form, document_type: e.target.value })}
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Номер документа</label>
            <input
              style={styles.input}
              placeholder="AB1234567"
              value={form.document_number}
              onChange={(e) => setForm({ ...form, document_number: e.target.value })}
            />
          </div>

          <button
            style={{
              ...styles.btn,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Отправка..." : "Отправить заявку"}
          </button>
        </div>
      )}

      {/* История заявок */}
      {applications.length > 1 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>История заявок</h2>
          <div style={styles.timeline}>
            {applications.map((app, i) => (
              <div key={app.id || i} style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                <div style={styles.timelineContent}>
                  <div style={styles.timelineHeader}>
                    <span style={styles.timelineDate}>
                      {app.submitted_at
                        ? new Date(app.submitted_at).toLocaleDateString("ru-RU")
                        : "—"}
                    </span>
                    <span
                      style={{
                        ...styles.statusBadge,
                        fontSize: 11,
                        background:
                          STATUS_LABELS[app.status]?.color || "#64748b",
                      }}
                    >
                      {STATUS_LABELS[app.status]?.label || app.status}
                    </span>
                  </div>
                  <p style={styles.timelineText}>
                    {app.document_type} · {app.document_number}
                  </p>
                  {app.rejection_reason && (
                    <p style={{ color: "#ef4444", fontSize: 13, margin: "4px 0 0" }}>
                      {app.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 600,
    margin: "0 auto",
    padding: "32px 16px",
    color: "#e2e8f0",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: "0 0 8px",
    color: "#f1f5f9",
  },
  subtitle: {
    color: "#94a3b8",
    margin: "0 0 24px",
    fontSize: 15,
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: "0 0 20px",
    color: "#f1f5f9",
  },
  statusCard: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  statusHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    color: "#94a3b8",
    fontSize: 14,
  },
  statusBadge: {
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
  },
  rejectionBox: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "10px 14px",
    marginTop: 10,
    fontSize: 14,
    color: "#fca5a5",
  },
  field: { marginBottom: 16 },
  fieldLabel: {
    display: "block",
    marginBottom: 6,
    fontSize: 14,
    color: "#94a3b8",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#f1f5f9",
    fontSize: 15,
    boxSizing: "border-box",
  },
  btn: {
    width: "100%",
    padding: "12px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    marginTop: 4,
  },
  error: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  successMsg: {
    background: "#052e16",
    border: "1px solid #166534",
    color: "#86efac",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  timeline: { display: "flex", flexDirection: "column", gap: 16 },
  timelineItem: { display: "flex", gap: 12, alignItems: "flex-start" },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#475569",
    marginTop: 5,
    flexShrink: 0,
  },
  timelineContent: { flex: 1 },
  timelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineDate: { fontSize: 13, color: "#64748b" },
  timelineText: { margin: "4px 0 0", fontSize: 14, color: "#94a3b8" },
};