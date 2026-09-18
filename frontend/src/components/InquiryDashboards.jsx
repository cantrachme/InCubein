import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Inbox,
  Mail,
  MailOpen,
  Clock,
  CalendarPlus,
  Send,
  Phone,
  MessageSquare,
  Activity,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Loading, Pill, fetchJson, DataError } from "./crm/CrmUi";

/* ── shared helpers ─────────────────────────────────────────── */

const kpiCard = {
  background: "var(--bg-white, white)",
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  padding: "14px 16px",
};
const kpiLabel = { fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" };
const kpiValue = { fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" };
const sectionTitle = { fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", margin: "18px 0 10px", display: "flex", alignItems: "center", gap: 6 };
const thStyle = { textAlign: "left", padding: "8px 10px", color: "var(--text-dim)", fontSize: "0.66rem", textTransform: "uppercase", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap" };
const tdStyle = { padding: "8px 10px", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: "0.78rem" };
const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border-color)",
  fontSize: "0.8rem", background: "white", color: "var(--text-primary)",
};
const labelStyle = { fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "4px", display: "block" };

function fmtAgo(ts) {
  if (!ts) return "—";
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
  if (isNaN(d)) return ts.slice(0, 16);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function fmtDT(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    if (isNaN(d)) return String(ts);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(ts);
  }
}

function ScoreBadge({ score }) {
  const n = Number(score || 0);
  const cls = n >= 80 ? "badge-success" : n >= 50 ? "badge-warning" : "badge-danger";
  return <span className={`badge ${cls}`}>{score ?? "—"}</span>;
}

function StageBadge({ stage }) {
  const colorMap = {
    "Draft": { bg: "#F1F5F9", text: "#475569" },
    "Sent": { bg: "#EFF6FF", text: "#2563EB" },
    "Follow-up Sent": { bg: "#E0E7FF", text: "#4338CA" },
    "Replied": { bg: "#FEF3C7", text: "#92400E" },
    "Meeting Scheduled": { bg: "#E0E7FF", text: "#3730A3" },
    "In Loop": { bg: "#FCE7F3", text: "#BE185D" },
    "Interviewed": { bg: "#F3E8FF", text: "#7E22CE" },
    "MOUs": { bg: "#FEF3C7", text: "#92400E" },
    "Incubated": { bg: "#D1FAE5", text: "#065F46" },
    "TBI Partnership": { bg: "#DBEAFE", text: "#1E40AF" },
    "Not Interested": { bg: "#FEE2E2", text: "#B91C1C" },
  };
  const c = colorMap[stage] || { bg: "#E2E8F0", text: "#334155" };
  return <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 9px", borderRadius: "10px", background: c.bg, color: c.text, whiteSpace: "nowrap" }}>{stage || "—"}</span>;
}

function MeetingPill({ meeting }) {
  if (!meeting) return <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>—</span>;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 9px", borderRadius: "10px", background: meeting.status === "Completed" ? "#F1F5F9" : "#D1FAE5", color: meeting.status === "Completed" ? "#475569" : "#065F46", whiteSpace: "nowrap" }}>
      {meeting.status || "Scheduled"}
      {meeting.date ? ` · ${String(meeting.date).slice(5, 10)}` : ""}
    </span>
  );
}

const ENTITY_COLOR = {
  startup: { bg: "#ECFDF5", text: "#065F46", label: "Startup" },
  incubation: { bg: "#EFF6FF", text: "#1D4ED8", label: "Incubation" },
};

/* ── KPI Row ────────────────────────────────────────────────── */
function KpiRow({ bucket, typeLabel }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
      <div style={kpiCard}>
        <div style={kpiLabel}>Total {typeLabel} Inquiries</div>
        <div style={kpiValue}>{bucket.total || 0}</div>
      </div>
      <div style={kpiCard}>
        <div style={kpiLabel}>New</div>
        <div style={{ ...kpiValue, color: "#3b82f6" }}>{bucket.new || 0}</div>
      </div>
      <div style={kpiCard}>
        <div style={kpiLabel}>In Progress</div>
        <div style={{ ...kpiValue, color: "#f59e0b" }}>{bucket.in_progress || 0}</div>
      </div>
      <div style={kpiCard}>
        <div style={kpiLabel}>Replied</div>
        <div style={{ ...kpiValue, color: "#22c55e" }}>{bucket.replied || 0}</div>
      </div>
      <div style={kpiCard}>
        <div style={kpiLabel}>Meetings</div>
        <div style={{ ...kpiValue, color: "#8b5cf6" }}>{bucket.meetings || 0}</div>
      </div>
    </div>
  );
}

/* ── Main Inquirer Dashboard ────────────────────────────────── */
export default function InquirerDashboard() {
  const [entityTab, setEntityTab] = useState("incubation");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // inquiry workspace
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson("/api/outreach/inquiry-dashboard");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tick]);

  const rows = useMemo(() => {
    const bucket = data && data[entityTab] ? data[entityTab].inquiries || [] : [];
    let list = [...bucket];
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((r) =>
        [r.incubator_name, r.contact_name, r.email, r.sector, r.inquiry_id].some((f) =>
          String(f || "").toLowerCase().includes(needle)
        )
      );
    }
    if (stageFilter !== "All") {
      list = list.filter((r) => r.status === stageFilter);
    }
    return list;
  }, [data, entityTab, q, stageFilter]);

  if (selected) {
    return (
      <InquiryWorkspace
        leadId={selected.id}
        onBack={() => { setSelected(null); load(); }}
        entityKind={selected.entity_kind}
      />
    );
  }

  if (loading && !data && !error) return <Loading label="Loading inquiries from Outreach Hub…" />;
  if (error && !data) return <DataError message={error} onRetry={() => setTick((t) => t + 1)} />;

  const bucket = (data && data[entityTab]) || { total: 0, new: 0, in_progress: 0, replied: 0, meetings: 0, inquiries: [] };
  const typeLabel = entityTab === "startup" ? "Startup" : "Incubation";
  const stages = [...new Set((bucket.inquiries || []).map((r) => r.status).filter(Boolean))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Tabs + refresh */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={`btn ${entityTab === "incubation" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setEntityTab("incubation")}
            style={{ fontSize: "0.82rem", padding: "6px 16px" }}
          >
            🏢 Incubation Inquiries
          </button>
          <button
            className={`btn ${entityTab === "startup" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setEntityTab("startup")}
            style={{ fontSize: "0.82rem", padding: "6px 16px" }}
          >
            🚀 Startup Inquiries
          </button>
        </div>
        <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <KpiRow bucket={bucket} typeLabel={typeLabel} />

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", position: "relative" }}>
          <input
            style={{ ...inputStyle, paddingLeft: "30px" }}
            placeholder="Search inquiry, organization, contact, sector…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <SearchIcon />
        </div>
        <select style={{ ...inputStyle, width: "180px" }} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="All">All stages</option>
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Inquiry</th>
              <th style={thStyle}>Organization</th>
              <th style={thStyle}>Contact</th>
              <th style={thStyle}>Sector</th>
              <th style={thStyle}>Stage</th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Meeting</th>
              <th style={thStyle}>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "var(--text-dim)", padding: "26px 0" }}>
                  No {typeLabel.toLowerCase()} inquiries found yet. Run the outreach pipeline to populate the inbox.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                style={{ cursor: "pointer", transition: "background 0.15s ease" , borderBottom: "1px solid var(--border-color)"}}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface, #F8FAFC)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap" }}>{r.inquiry_id}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>
                  {r.incubator_name}
                  <span style={{ display: "block", fontSize: "0.68rem", color: "var(--text-dim)", fontWeight: 500 }}>{r.email}</span>
                </td>
                <td style={tdStyle}>{r.contact_name || "—"}</td>
                <td style={tdStyle}>{r.sector}</td>
                <td style={tdStyle}><StageBadge stage={r.stage} /></td>
                <td style={tdStyle}><ScoreBadge score={r.lead_score} /></td>
                <td style={tdStyle}><MeetingPill meeting={r.meeting} /></td>
                <td style={tdStyle}>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-body)" }}>{r.last_activity}</div>
                  <div style={{ fontSize: "0.66rem", color: "var(--text-dim)" }}>{fmtAgo(r.last_activity_at)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/* ── Inquiry Workspace ──────────────────────────────────────── */
function InquiryWorkspace({ leadId, onBack, entityKind }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [mtgModal, setMtgModal] = useState(false);
  const [mtg, setMtg] = useState({ title: "", date: "", time: "", duration_minutes: 30, participants: "", meeting_type: "Google Meet", meeting_link: "", notes: "" });
  const [newStage, setNewStage] = useState("");
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchJson(`/api/outreach/inquiries/${leadId}`);
      setDetail(d);
      setNewStage(d.status || "Draft");
      if (!replySubject) setReplySubject(`Re: Introduction to Incubein Foundation`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [leadId]);

  const sendReply = async () => {
    if (!replyBody.trim()) {
      toast.error("Write a reply message first.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/outreach/inquiries/${leadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody, subject: replySubject, performed_by: "Incubein Team" }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message);
        setReplyBody("");
        await load();
      } else {
        toast.error(json.detail || "Failed to send reply.");
      }
    } catch (e) {
      toast.error("Network error: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const schedule = async () => {
    if (!mtg.date || !mtg.time) {
      toast.error("Meeting date and time are required.");
      return;
    }
    try {
      const res = await fetch(`/api/outreach/inquiries/${leadId}/meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...mtg, performed_by: "Incubein Team" }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message);
        setMtgModal(false);
        setMtg({ title: "", date: "", time: "", duration_minutes: 30, participants: "", meeting_type: "Google Meet", meeting_link: "", notes: "" });
        await load();
      } else {
        toast.error(json.detail || "Failed to schedule meeting.");
      }
    } catch (e) {
      toast.error("Network error: " + e.message);
    }
  };

  const changeStage = async (stage) => {
    try {
      const res = await fetch(`/api/outreach/inquiries/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, performed_by: "Incubein Team" }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(json.message);
        setNewStage(stage);
        await load();
      }
    } catch (e) {
      toast.error("Network error: " + e.message);
    }
  };

  if (loading && !detail && !error) return <Loading label="Opening inquiry…" />;
  if (error && !detail) return <DataError message={error} onRetry={load} />;
  if (!detail) return <div style={{ color: "var(--danger)", fontSize: "0.8rem" }}>Unable to open inquiry.</div>;

  const ec = ENTITY_COLOR[entityKind] || ENTITY_COLOR.startup;
  const activities = (detail.activity || []).slice().reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} /> Back to Inquiries
        </button>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>{detail.incubator_name}</h3>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: "12px", background: ec.bg, color: ec.text }}>{ec.label} Inquiry</span>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: "12px", background: "var(--bg-dark)", color: "var(--text-dim)" }}>{detail.inquiry_id}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          <select value={newStage} onChange={(e) => changeStage(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: "0.75rem", fontWeight: 700 }}>
            {["Draft", "Sent", "Follow-up Sent", "Replied", "Meeting Scheduled", "In Loop", "Interviewed", "MOUs", "Incubated", "TBI Partnership", "Not Interested"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Key facts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
        {[
          { l: "Sector", v: detail.sector, sub: detail.sub_sector && detail.sub_sector !== "—" ? detail.sub_sector : "" },
          { l: "Stage", v: detail.stage, badge: <StageBadge stage={detail.stage} /> },
          { l: "Score", v: <ScoreBadge score={detail.lead_score} /> },
          { l: "Priority", v: detail.priority },
          { l: "Source", v: detail.source },
          { l: "Received", v: fmtDT(detail.received_at) },
          { l: "Owner", v: detail.assigned_to || "—" },
          { l: "Reply Status", v: <Pill value={detail.reply_status} tone={detail.reply_status === "Replied" ? "success" : "warning"} /> },
          { l: "Next Action", v: detail.next_action || "—" },
        ].map((k) => (
          <div key={k.l} style={kpiCard} title={typeof k.v === "string" ? k.v : ""}>
            <div style={kpiLabel}>{k.l}</div>
            <div style={{ ...kpiValue, fontSize: "1.05rem", marginTop: "6px" }}>{k.badge || k.v || "—"}</div>
            {k.sub && <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "4px" }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "14px", alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Message */}
          <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "16px" }}>
            <h4 style={{ ...sectionTitle, margin: 0, marginBottom: 10 }}>
              <MessageSquare size={15} /> Received Message
            </h4>
            <div style={{ fontSize: "0.82rem", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "var(--bg-surface)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", color: "var(--text-primary)", maxHeight: "300px", overflowY: "auto" }}>
              {detail.message || <span style={{ color: "var(--text-dim)" }}>No received message stored for this inquiry yet.</span>}
            </div>
          </div>

          {/* Activity */}
          <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "16px" }}>
            <h4 style={{ ...sectionTitle, margin: 0, marginBottom: 12 }}>
              <Activity size={15} /> Activity
            </h4>
            {activities.length === 0 ? (
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>No activity recorded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", borderLeft: "2px solid var(--border-color)", paddingLeft: "16px", marginLeft: "6px", gap: "12px" }}>
                {activities.map((a, i) => (
                  <div key={a.id || i} style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "-23px", top: "3px", width: "11px", height: "11px", borderRadius: "50%", background: TYPE_COLORS[a.activity_type] || "var(--primary)", border: "2px solid white", boxShadow: "0 0 0 2px rgba(0,0,0,0.06)" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{a.title || a.activity_type}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{fmtDT(a.created_at)}</span>
                    </div>
                    {a.details && <div style={{ fontSize: "0.76rem", color: "var(--text-body)", marginTop: "3px", whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }}>{a.details}</div>}
                    {a.activity_type === "email_received" && a.extra && (a.extra.intent || a.extra.score) && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                        {a.extra.intent && <TagPill>Intent: {a.extra.intent}</TagPill>}
                        {a.extra.score && <TagPill>Score: {a.extra.score}</TagPill>}
                        {a.extra.sentiment && <TagPill>Sentiment: {a.extra.sentiment}</TagPill>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Contact */}
          <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "16px" }}>
            <h4 style={{ ...sectionTitle, margin: 0, marginBottom: 10 }}>
              <Mail size={15} /> Contact
            </h4>
            <div style={{ display: "grid", gap: "8px", fontSize: "0.8rem" }}>
              <Row label="Name" value={detail.contact_name || detail.incubator_name || "—"} />
              <Row label="Email" value={<a href={`mailto:${detail.email}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{detail.email}</a>} />
              <Row label="Phone" value={detail.phone || "—"} />
              <Row label="City" value={detail.city || "—"} />
              <Row label="Entity Type" value={ec.label} />
            </div>
          </div>

          {/* Meeting */}
          <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ ...sectionTitle, margin: 0 }}><CalendarPlus size={15} /> Meeting</h4>
              <button className="btn btn-primary" style={{ fontSize: "0.74rem", padding: "6px 12px" }} onClick={() => setMtgModal(true)}>
                + Schedule Meeting
              </button>
            </div>
            {detail.meeting ? (
              <div style={{ display: "grid", gap: "6px", fontSize: "0.78rem", background: "var(--bg-surface)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                <Row label="Status" value={<MeetingPill meeting={detail.meeting} />} />
                {detail.meeting.title && <Row label="Title" value={detail.meeting.title} />}
                {detail.meeting.date && <Row label="Date" value={detail.meeting.date} />}
                {detail.meeting.time && <Row label="Time" value={detail.meeting.time} />}
                {detail.meeting.meeting_link && <Row label="Link" value={<a href={detail.meeting.meeting_link} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>Join meeting →</a>} />}
              </div>
            ) : (
              <div style={{ fontSize: "0.76rem", color: "var(--text-dim)" }}>No meeting scheduled yet.</div>
            )}
            {(detail.meetings_list || []).length > 1 && (
              <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
                {(detail.meetings_list || []).slice(1).map((m) => (
                  <div key={m.id} style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {m.title} · {m.date} {m.time}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reply */}
          <div style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "16px" }}>
            <h4 style={{ ...sectionTitle, margin: 0, marginBottom: 10 }}>
              <Send size={15} /> Reply
            </h4>
            <div style={{ display: "grid", gap: "8px" }}>
              <div>
                <label style={labelStyle}>Subject</label>
                <input style={inputStyle} value={replySubject} onChange={(e) => setReplySubject(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Message</label>
                <textarea
                  style={{ ...inputStyle, minHeight: "130px", resize: "vertical", lineHeight: 1.5 }}
                  placeholder="Write your reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={sendReply} disabled={sending} style={{ justifyContent: "center" }}>
                {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {mtgModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setMtgModal(false)}>
          <div style={{ background: "white", borderRadius: "14px", padding: "20px", maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px", fontSize: "0.98rem", fontWeight: 800, color: "var(--text-primary)" }}>
              <CalendarPlus size={16} style={{ marginRight: 6, verticalAlign: -2 }} /> Schedule Meeting
            </h3>
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <label style={labelStyle}>Meeting title</label>
                <input style={inputStyle} value={mtg.title} onChange={(e) => setMtg({ ...mtg, title: e.target.value })} placeholder="e.g. Introductory call with startup" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" style={inputStyle} value={mtg.date} onChange={(e) => setMtg({ ...mtg, date: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Time</label>
                  <input type="time" style={inputStyle} value={mtg.time} onChange={(e) => setMtg({ ...mtg, time: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Duration (min)</label>
                  <select style={inputStyle} value={mtg.duration_minutes} onChange={(e) => setMtg({ ...mtg, duration_minutes: Number(e.target.value) })}>
                    {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={labelStyle}>Participants</label>
                  <input style={inputStyle} value={mtg.participants} onChange={(e) => setMtg({ ...mtg, participants: e.target.value })} placeholder="Comma separated" />
                </div>
                <div>
                  <label style={labelStyle}>Meeting type</label>
                  <select style={inputStyle} value={mtg.meeting_type} onChange={(e) => setMtg({ ...mtg, meeting_type: e.target.value })}>
                    <option>Google Meet</option>
                    <option>In person</option>
                    <option>Phone call</option>
                    <option>Microsoft Teams</option>
                    <option>Zoom</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Location / link</label>
                <input style={inputStyle} value={mtg.meeting_link} onChange={(e) => setMtg({ ...mtg, meeting_link: e.target.value })} placeholder="meet.google.com/… or physical venue" />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={mtg.notes} onChange={(e) => setMtg({ ...mtg, notes: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button className="btn btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => setMtgModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ fontSize: "0.8rem" }} onClick={schedule}>
                <CalendarPlus size={14} /> Save Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TYPE_COLORS = {
  email_received: "#F59E0B",
  reply_sent: "#10B981",
  meeting_scheduled: "#8B5CF6",
  outreach_sent: "#3B82F6",
  followup_sent: "#6366F1",
  reviewed: "#64748B",
  stage_change: "#06B6D4",
  note: "#64748B",
};

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
      <span style={{ color: "var(--text-dim)", fontWeight: 600, flex: "0 0 92px" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function TagPill({ children }) {
  return <span style={{ fontSize: "0.66rem", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: "#F1F5F9", color: "#334155", border: "1px solid var(--border-color)" }}>{children}</span>;
}