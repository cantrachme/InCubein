import { useEffect, useMemo, useState } from "react";
import {
  Mail, MailOpen, CalendarPlus, ClipboardList, RefreshCw, Clock, User, Search,
  ExternalLink, Activity, TrendingUp, MessageSquare,
} from "lucide-react";
import { fetchJson, DataError, Pagination } from "./crm/CrmUi";

const thStyle = { textAlign: "left", padding: "8px 10px", color: "var(--text-dim)", fontSize: "0.66rem", textTransform: "uppercase", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap" };
const tdStyle = { padding: "8px 10px", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: "0.78rem" };
const sectionTitle = { fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", margin: "18px 0 10px", display: "flex", alignItems: "center", gap: 6 };

function fmtDT(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    if (isNaN(d)) return String(ts);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch { return String(ts); }
}

function fmtAgo(ts) {
  if (!ts) return "—";
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
  if (isNaN(d)) return "";
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function dayKey(ts) {
  if (!ts) return "Unknown";
  try {
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    return d.toDateString();
  } catch { return "Unknown"; }
}

const TYPE_META = {
  email_received:    { icon: Mail,          color: "#F59E0B", label: "Email received" },
  reply_sent:        { icon: MailOpen,      color: "#10B981", label: "Reply sent" },
  outreach_sent:     { icon: Mail,          color: "#3B82F6", label: "Email dispatched" },
  followup_sent:     { icon: Mail,          color: "#6366F1", label: "Follow-up" },
  meeting_scheduled: { icon: CalendarPlus,  color: "#8B5CF6", label: "Meeting" },
  meeting_completed: { icon: CalendarPlus,  color: "#06B6D4", label: "Meeting" },
  stage_change:      { icon: RefreshCw,     color: "#06B6D4", label: "Stage change" },
  note:              { icon: MessageSquare, color: "#64748B", label: "Note" },
  reviewed:          { icon: User,          color: "#64748B", label: "Reviewed" },
};

function metaFor(type) {
  if (TYPE_META[type]) return TYPE_META[type];
  if (type && type.startsWith("crm_")) return { icon: ClipboardList, color: "#EC4899", label: "Execution update" };
  return { icon: Activity, color: "#64748B", label: "Activity" };
}

const FILTERS = [
  { key: "all", label: "All activity" },
  { key: "incoming", label: "Incoming (received)" },
  { key: "outgoing", label: "Outgoing (sent)" },
  { key: "meetings", label: "Meetings" },
  { key: "execution", label: "Execution" },
];

export default function TimelineDashboard() {
  const [events, setEvents] = useState(null);
  const [startups, setStartups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [selectedStartup, setSelectedStartup] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [feed, startupList] = await Promise.all([
        fetchJson(`/api/outreach/activity-feed?limit=500${selectedStartup ? `&startup_id=${selectedStartup}` : ""}`),
        fetchJson("/api/crm/refs"),
      ]);
      setEvents(Array.isArray(feed) ? feed : (feed.events || []));
      setStartups((startupList && startupList.startups) || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedStartup]);

  const visible = useMemo(() => {
    let list = events || [];
    if (filter === "incoming") list = list.filter((e) => e.type === "email_received");
    if (filter === "outgoing") list = list.filter((e) => e.type === "outreach_sent" || e.type === "reply_sent" || e.type === "followup_sent");
    if (filter === "meetings") list = list.filter((e) => e.type.startsWith("meeting_"));
    if (filter === "execution") list = list.filter((e) => e.type.startsWith("crm_"));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((e) => [e.title, e.details, e.entity_name, e.email, e.type].some((f) => String(f || "").toLowerCase().includes(needle)));
    }
    return [...list].sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  }, [events, filter, q]);

  const pageStart = (page - 1) * pageSize;
  const pageItems = visible.slice(pageStart, pageStart + pageSize);

  const grouped = useMemo(() => {
    const map = {};
    for (const e of pageItems) {
      const k = dayKey(e.timestamp);
      (map[k] = map[k] || []).push(e);
    }
    return Object.entries(map).sort((a, b) => dayKey(b[0]) > dayKey(a[0]) ? 1 : -1);
  }, [pageItems]);

  const counts = useMemo(() => {
    const all = events || [];
    return {
      all: all.length,
      incoming: all.filter((e) => e.type === "email_received").length,
      outgoing: all.filter((e) => ["outreach_sent", "reply_sent", "followup_sent"].includes(e.type)).length,
      meetings: all.filter((e) => e.type.startsWith("meeting_")).length,
      execution: all.filter((e) => e.type.startsWith("crm_")).length,
    };
  }, [events]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
          <Activity size={17} style={{ marginRight: 6, verticalAlign: -2 }} /> Activity Timeline
          <span style={{ fontWeight: 600, fontSize: "0.78rem", color: "var(--text-dim)", marginLeft: 8 }}>
            {events ? `${events.length} events, ${Math.max(1, grouped.length)} days` : ""}
          </span>
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <input
              style={{ padding: "7px 10px 7px 28px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "0.78rem", width: "200px", background: "white", color: "var(--text-primary)" }}
              placeholder="Search timeline…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="form-input"
              value={selectedStartup}
              onChange={(e) => { setSelectedStartup(e.target.value); setPage(1); }}
              style={{ minWidth: 220, height: 36, fontSize: "0.76rem" }}
            >
              <option value="">All startups</option>
              {startups.map((s) => (
                <option key={s.id} value={s.id}>{s.code ? `${s.code} – ` : ""}{s.name}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh"><RefreshCw size={14} /></button>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 14px", borderRadius: "20px", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
              background: filter === f.key ? "var(--primary)" : "white", color: filter === f.key ? "white" : "var(--text-muted)",
              border: `1px solid ${filter === f.key ? "var(--primary)" : "var(--border-color)"}`, transition: "all 0.15s ease",
            }}
          >
            {f.label} <span style={{ opacity: 0.75 }}>({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {loading && !events && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton skeleton-card" style={{ height: 52 }} />)}
        </div>
      )}

      {error && !events && <DataError message={error} onRetry={load} />}

      {!loading && !error && visible.length === 0 && (
        <div className="empty-state"><h3>No activity yet</h3><p>Outreach & execution events will appear here as they happen.</p></div>
      )}

      {!loading && !error && visible.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={visible.length}
          onPage={setPage}
          onPageSize={(size) => { setPageSize(size); setPage(1); }}
          sizes={[5, 10, 20, 30, 50]}
        />
      )}

      {grouped.map(([day, evs]) => (
        <div key={day}>
          <div style={sectionTitle}>
            <Clock size={13} /> {fmtDT(evs[0].timestamp).split(",")[0]}
            <span style={{ fontWeight: 600, fontSize: "0.7rem", color: "var(--text-dim)", marginLeft: 6 }}>{evs.length} events</span>
          </div>
          <div style={{ overflowX: "auto", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Activity</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Entity</th>
                  <th style={thStyle}>Message</th>
                  <th style={thStyle}>By</th>
                  <th style={thStyle}>Time</th>
                </tr>
              </thead>
              <tbody>
                {evs.map((e) => {
                  const m = metaFor(e.type);
                  const Icon = m.icon;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelected(e)}
                      style={{ cursor: "pointer", transition: "background 0.15s ease", borderBottom: "1px solid var(--border-color)" }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--bg-surface, #F8FAFC)")}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
                    >
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        {e.title}
                        <span style={{ display: "block", fontSize: "0.66rem", color: "var(--text-dim)", fontWeight: 500 }}>
                          {String(e.type || "").replace("_", " ")}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: "12px", color: m.color, background: `${m.color}14`, border: `1px solid ${m.color}30`, whiteSpace: "nowrap" }}>
                          <Icon size={11} /> {m.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{e.entity_name}</td>
                      <td style={{ ...tdStyle, color: "var(--text-muted)", maxWidth: "340px" }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.details || "—"}</span>
                      </td>
                      <td style={tdStyle}>{e.performed_by || "—"}</td>
                      <td style={tdStyle}>
                        <div style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{fmtDT(e.timestamp)}</div>
                        <div style={{ fontSize: "0.66rem", color: "var(--text-dim)", marginTop: 2 }}>{fmtAgo(e.timestamp)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {selected && <ActivityDetailModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ActivityDetailModal({ event, onClose }) {
  const m = metaFor(event.type);
  const Icon = m.icon;
  const extra = event.extra || {};
  const rows = [
    ["Activity type", m.label],
    ["Time", fmtDT(event.timestamp)],
    ["Performed by", event.performed_by],
    ["Entity", event.entity_name + (event.entity_kind ? ` (${event.entity_kind})` : "")],
    ["Email", event.email],
    ["Lead ID", event.lead_id ? `INQ-${String(event.lead_id).split("-").pop()}` : ""],
  ].filter(([, v]) => v);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: "14px", padding: "22px", maxWidth: "620px", width: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${m.color}16`, color: m.color }}>
              <Icon size={18} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "var(--text-primary)" }}>{event.title}</h3>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{m.label} · {fmtAgo(event.timestamp)}</span>
            </div>
          </div>
          <button onClick={onClose} className="drawer-close" aria-label="Close">✕</button>
        </div>

        {/* Message / details */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px", fontSize: "0.83rem", lineHeight: 1.6, color: "var(--text-primary)", whiteSpace: "pre-wrap", marginBottom: 14, maxHeight: "260px", overflowY: "auto" }}>
          {event.details || <span style={{ color: "var(--text-dim)" }}>No details.</span>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 18px", fontSize: "0.8rem" }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
              <span style={{ color: "var(--text-dim)", flex: "0 0 112px", fontWeight: 600 }}>{label}</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600, wordBreak: "break-word" }}>{value}</span>
            </div>
          ))}
        </div>

        {extra.meeting_link && (
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-primary" href={extra.meeting_link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ExternalLink size={14} /> Join meeting
            </a>
          </div>
        )}
        {extra.meeting_id && (
          <div style={{ marginTop: 12, fontSize: "0.74rem", color: "var(--text-dim)" }}>
            Meeting ID: {extra.meeting_id}
          </div>
        )}
        {(extra.intent || extra.score || extra.sentiment) && (
          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {extra.intent && <InfoTag label={`Intent: ${extra.intent}`} />}
            {extra.score && <InfoTag label={`Score: ${extra.score}`} />}
            {extra.sentiment && <InfoTag label={`Sentiment: ${extra.sentiment}`} />}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTag({ label }) {
  return <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "3px 10px", borderRadius: "10px", background: "#F1F5F9", color: "#334155", border: "1px solid var(--border-color)" }}>{label}</span>;
}