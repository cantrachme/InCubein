import { useEffect, useState } from "react";
import { Card, Loading, fetchJson, DataError } from "./crm/CrmUi";

/** Shared small building blocks */

const kpiStyle = {
  background: "var(--bg-white, white)",
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  padding: "14px 16px",
};
const kpiLabel = { fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" };
const kpiValue = { fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" };
const sectionTitle = { fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", margin: "18px 0 10px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" };
const thStyle = { textAlign: "left", padding: "8px 10px", color: "var(--text-dim)", fontSize: "0.66rem", textTransform: "uppercase", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap" };
const tdStyle = { padding: "8px 10px", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)" };

function Bar({ value, color = "var(--primary)" }) {
  return (
    <div style={{ background: "var(--bg-dark)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
      <div style={{ height: "7px", background: color, width: `${Math.min(100, Math.max(0, value || 0))}%` }} />
    </div>
  );
}

function distOf(items, key) {
  const counts = {};
  for (const it of items) {
    const k = it && (it[key] || "N/A");
    counts[k] = (counts[k] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([k, n]) => ({ k: String(k), n }))
    .sort((a, b) => b.n - a.n);
}

function DistList({ data, color }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div style={{ display: "grid", gap: "7px" }}>
      {data.slice(0, 7).map((d) => (
        <div key={d.k} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ flex: "0 0 130px", fontSize: "0.72rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.k}</span>
          <div style={{ flex: "1" }}>
            <Bar value={(d.n / max) * 100} color={color} />
          </div>
          <span style={{ flex: "0 0 26px", textAlign: "right", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-primary)" }}>{d.n}</span>
        </div>
      ))}
    </div>
  );
}

function errState(setError) {
  return (e) => (setError ? setError(e.message) : null);
}

/* ------------------------------------------------------------------ */
/* 1. Inquirers Dashboard — only inquirer (application) data           */
/* ------------------------------------------------------------------ */

export function InquirersDashboard() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJson("/api/incubein/applications?entity_type=startup");
        setApps(Array.isArray(data) ? data : []);
      } catch (e) {
        errState(setError)(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tick]);

  if (loading && !error) return <Loading label="Loading inquirer data…" />;
  if (error) return <DataError message={error} onRetry={() => { setError(null); setTick((t) => t + 1); }} />;

  const high = apps.filter((a) => a.priority === "High").length;
  const avgScore = apps.length ? (apps.reduce((s, a) => s + (Number(a.final_score) || 0), 0) / apps.length).toFixed(1) : "—";
  const avgRule = apps.length ? (apps.reduce((s, a) => s + (Number(a.rule_score) || 0), 0) / apps.length).toFixed(1) : "—";
  const avgLlm = apps.length ? (apps.reduce((s, a) => s + (Number(a.llm_score) || 0), 0) / apps.length).toFixed(1) : "—";
  const byStage = distOf(apps, "stage_category");
  const byPriority = distOf(apps, "priority");
  const bySector = distOf(apps, "sector");
  const recent = [...apps]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 8);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        {[
          { l: "Total Inquirers", v: apps.length },
          { l: "High Priority", v: high, vc: "#ef4444" },
          { l: "Avg Final Score", v: avgScore },
          { l: "Avg Rule / LLM", v: `${avgRule} / ${avgLlm}` },
        ].map((k) => (
          <div key={k.l} style={kpiStyle}>
            <div style={kpiLabel}>{k.l}</div>
            <div style={{ ...kpiValue, ...(k.vc ? { color: k.vc } : {}) }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
        <Card label="Distribution by Stage"><DistList data={byStage} /></Card>
        <Card label="Evaluation Priority"><DistList data={byPriority} color="#f59e0b" /></Card>
        <Card label="Top Sectors"><DistList data={bySector} color="#06b6d4" /></Card>
      </div>

      <h4 style={sectionTitle}>Recent Inquiries</h4>
      <div style={{ overflowX: "auto", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Stage</th>
              <th style={thStyle}>Sector</th>
              <th style={thStyle}>Priority</th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((a, i) => (
              <tr key={a._id || i}>
                <td style={tdStyle}>{a.startup_name || a.name}</td>
                <td style={tdStyle}>{a.stage_category || a.stage || "—"}</td>
                <td style={tdStyle}>{a.sector || "—"}</td>
                <td style={tdStyle}>{a.priority || "Medium"}</td>
                <td style={tdStyle}>{a.final_score || "—"}</td>
                <td style={tdStyle}>{a.timestamp ? new Date(a.timestamp).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Startups Dashboard — only startup (CRM) data                     */
/* ------------------------------------------------------------------ */

export function StartupsDashboard() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJson("/api/crm/startups?page=1&page_size=500");
        setRecs((data && data.records) || []);
      } catch (e) {
        errState(setError)(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tick]);

  if (loading && !error) return <Loading label="Loading startup data…" />;
  if (error) return <DataError message={error} onRetry={() => { setError(null); setTick((t) => t + 1); }} />;

  const active = recs.filter((s) => String(s.status || "").toLowerCase() === "active").length;
  const avgHealth = recs.length
    ? (recs.reduce((s, x) => s + (Number(x.health_score) || 0), 0) / recs.length).toFixed(1)
    : "—";
  const byStage = distOf(recs, "stage");
  const bySector = distOf(recs, "sector");
  const byBand = distOf(recs, "health_band");
  const recent = [...recs]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 8);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        {[
          { l: "Startups in CRM", v: recs.length },
          { l: "Active", v: active, vc: "#22c55e" },
          { l: "Avg Health Score", v: avgHealth },
          { l: "Avg Confidence", v: recs.length ? (recs.reduce((s, x) => s + (Number(x.confidence_score) || 0), 0) / recs.length).toFixed(1) : "—" },
        ].map((k) => (
          <div key={k.l} style={kpiStyle}>
            <div style={kpiLabel}>{k.l}</div>
            <div style={{ ...kpiValue, ...(k.vc ? { color: k.vc } : {}) }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
        <Card label="By Stage"><DistList data={byStage} /></Card>
        <Card label="By Gender/Sector"><DistList data={bySector} color="#06b6d4" /></Card>
        <Card label="Health Band"><DistList data={byBand} color="#f59e0b" /></Card>
      </div>

      <h4 style={sectionTitle}>Recently Added Startups</h4>
      <div style={{ overflowX: "auto", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Stage</th>
              <th style={thStyle}>Sector</th>
              <th style={thStyle}>Health</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Added</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s, i) => (
              <tr key={s.id || i}>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>{s.stage || "—"}</td>
                <td style={tdStyle}>{s.sector || "—"}</td>
                <td style={tdStyle}>{s.health_score ?? "—"}</td>
                <td style={tdStyle}>{s.status || "—"}</td>
                <td style={tdStyle}>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Timeline Dashboard — only timeline / scheduling data             */
/* ------------------------------------------------------------------ */

export function TimelineDashboard() {
  const [meetings, setMeetings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [calEvents, setCalEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [m, l, c] = await Promise.all([
          fetchJson("/api/outreach/meetings").catch((e) => { setError((prev) => prev || e.message); return []; }),
          fetchJson("/api/outreach/leads").catch((e) => { setError((prev) => prev || e.message); return []; }),
          fetchJson("/api/outreach/calendar-events").catch((e) => { setError((prev) => prev || e.message); return []; }),
        ]);
        setMeetings(Array.isArray(m) ? m : []);
        setLeads(Array.isArray(l) ? l : []);
        setCalEvents(Array.isArray(c) ? c : Array.isArray(c && c.events) ? c.events : []);
      } catch (e) {
        errState(setError)(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tick]);

  if (loading && !error) return <Loading label="Loading timeline data…" />;
  if (error) return <DataError message={error} onRetry={() => { setError(null); setTick((t) => t + 1); }} />;

  const pendingReplies = leads.filter((l) => !l.reply_text && ["Sent", "Follow-up Sent"].includes(l.status));
  const replied = leads.filter((l) => l.reply_text).length;
  const scheduled = meetings.filter((mtg) => mtg.status && String(mtg.status).toLowerCase() !== "completed").length;
  const orderedMeetings = [...meetings].sort((a, b) => new Date(`${b.date}T${b.time || "00:00"}`) - new Date(`${a.date}T${a.time || "00:00"}`));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        {[
          { l: "Meetings on Docket", v: meetings.length },
          { l: "Scheduled (Active)", v: scheduled, vc: "#22c55e" },
          { l: "Awaiting Reply", v: pendingReplies.length, vc: "#f59e0b" },
          { l: "Replies Received", v: replied, vc: "#3b82f6" },
        ].map((k) => (
          <div key={k.l} style={kpiStyle}>
            <div style={kpiLabel}>{k.l}</div>
            <div style={{ ...kpiValue, ...(k.vc ? { color: k.vc } : {}) }}>{k.v}</div>
          </div>
        ))}
      </div>

      <h4 style={sectionTitle}>Scheduled Meetings</h4>
      <div style={{ overflowX: "auto", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Entity</th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Meeting Link</th>
            </tr>
          </thead>
          <tbody>
            {orderedMeetings.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, textAlign: "center", color: "var(--text-dim)", padding: "20px" }} colSpan={6}>No scheduled meetings yet.</td>
              </tr>
            )}
            {orderedMeetings.slice(0, 12).map((mtg, i) => (
              <tr key={mtg.id || i}>
                <td style={tdStyle}>{mtg.incubator_name || "—"}</td>
                <td style={tdStyle}>{mtg.title || "—"}</td>
                <td style={tdStyle}>{mtg.date || "—"}</td>
                <td style={tdStyle}>{mtg.time || "—"}</td>
                <td style={tdStyle}>{mtg.status || "—"}</td>
                <td style={tdStyle}>{mtg.meeting_link ? <a href={mtg.meeting_link} target="_blank" rel="noreferrer">Join</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 style={sectionTitle}>Calendar Events{calEvents.length ? ` (${calEvents.length})` : ""}</h4>
      {calEvents.length === 0 && (
        <div style={{ padding: "14px", background: "var(--bg-dark)", borderRadius: "10px", border: "1px dashed var(--border-color)", color: "var(--text-dim)", fontSize: "0.78rem" }}>
          No calendar events synced. Connect a Google/Microsoft calendar from the Outreach Hub.
        </div>
      )}
      {calEvents.length > 0 && (
        <div style={{ display: "grid", gap: "8px" }}>
          {calEvents.slice(0, 10).map((ev, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "10px 14px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", flex: "1" }}>{ev.summary || ev.title || "Untitled event"}</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{ev.start ? new Date(ev.start).toLocaleString() : ev.date || "—"}</span>
            </div>
          ))}
        </div>
      )}

      <h4 style={sectionTitle}>Outreach Contact Activity</h4>
      <div style={{ overflowX: "auto", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Entity</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Sent</th>
              <th style={thStyle}>Next Action</th>
            </tr>
          </thead>
          <tbody>
            {[...leads]
              .sort((a, b) => new Date(b.sent_at || 0) - new Date(a.sent_at || 0))
              .slice(0, 12)
              .map((l, i) => (
                <tr key={l.id || i}>
                  <td style={tdStyle}>{l.incubator_name || "—"}</td>
                  <td style={tdStyle}>{l.status || "—"}</td>
                  <td style={tdStyle}>{l.sent_at ? new Date(l.sent_at).toLocaleString() : "—"}</td>
                  <td style={tdStyle}>{l.next_action_date || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}