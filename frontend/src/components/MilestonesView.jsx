import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { Flag, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { listModule } from "../lib/crmApi";
import { Loading, Empty, Pagination } from "./crm/CrmUi";
import ControlCard from "./execution/ControlCard";
import { MILESTONE_STATUSES, PRIORITIES, STATUS_STYLE, PRIORITY_STYLE, RAG_STYLE, p1toP4, downloadCsv } from "../lib/executionConfig";

const ragOf = (m) => {
  if (m && m.rag) return String(m.rag).toUpperCase();
  const st = m.status || "Not Started";
  const today = new Date().toISOString().slice(0, 10);
  if (["Delayed", "Cancelled"].includes(st)) return "RED";
  if (["Completed", "Achieved"].includes(st)) return m.target_date && m.target_date < today ? "AMBER" : "GREEN";
  if (m.status === "Blocked") return "RED";
  if (m.target_date && m.target_date < today) return "RED";
  if (st === "In Progress") return "AMBER";
  return "GREEN";
};

const cell = { padding: "9px 12px", fontSize: "0.74rem", verticalAlign: "middle" };
const headCell = { ...cell, fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", background: "var(--bg-dark)", whiteSpace: "nowrap" };

export default function MilestonesView() {
  const [records, setRecords] = useState([]);
  const [startupOptions, setStartupOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [startup, setStartup] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ms, st] = await Promise.all([
        listModule("milestones", {}),
        listModule("startups", {}),
      ]);
      setRecords(ms.records || []);
      setStartupOptions(st.records || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startupMap = useMemo(() => {
    const m = {};
    for (const s of startupOptions) m[s.id] = s;
    return m;
  }, [startupOptions]);

  const today = new Date().toISOString().slice(0, 10);

  const decorated = useMemo(() => {
    return (records || []).map((m) => {
      const st = startupMap[m.startup_id];
      const sc = STATUS_STYLE[m.status] || { color: "#9ca3af", bg: "#F3F4F6" };
      return {
        ...m,
        sc,
        rag: ragOf(m),
        startup_name: m.startup_name || (st ? st.name : ""),
        startup_code: st ? st.code : "",
        overdue: !["Completed", "Achieved"].includes(m.status || "") && m.target_date && m.target_date < today,
      };
    });
  }, [records, startupMap, today]);

  const counts = {
    All: decorated.length,
    Achieved: decorated.filter((m) => ["Completed", "Achieved"].includes(m.status)).length,
    "In Progress": decorated.filter((m) => m.status === "In Progress").length,
    Delayed: decorated.filter((m) => m.status === "Delayed").length,
    Overdue: decorated.filter((m) => m.overdue).length,
  };

  const owners = [...new Set(decorated.map((m) => m.owner).filter(Boolean))];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return decorated.filter((m) => {
      if (needle && !(
        String(m.milestone || m.title || "").toLowerCase().includes(needle) ||
        String(m.startup_name || "").toLowerCase().includes(needle)
      )) return false;
      if (startup && String(m.startup_id) !== String(startup)) return false;
      if (status && m.status !== status) return false;
      if (owner && m.owner !== owner) return false;
      if (priority && p1toP4(m.priority) !== priority) return false;
      return true;
    });
  }, [decorated, q, startup, status, owner, priority]);

  const exportCsv = () =>
    downloadCsv("milestones.csv", filtered, [
      { key: "startup_code", label: "Startup Code" },
      { key: "startup_name", label: "Startup" },
      { key: "milestone", label: "Milestone" },
      { key: "milestone_type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "owner", label: "Owner" },
      { key: "target_date", label: "Target Date" },
      { key: "actual_date", label: "Actual Date" },
      { key: "target_metric", label: "Target Metric" },
      { key: "rag", label: "RAG" },
    ]);

  const updateStatus = async (m, status) => {
    try {
      const res = await fetch(`/api/crm/milestones/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, change_reason: `Milestone marked ${status} in Milestones tab` }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Milestone ${status}.`);
        setRecords((rs) => rs.map((r) => (r.id === m.id ? { ...r, status } : r)));
      } else {
        toast.error(data.detail || "Failed to update milestone.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  if (loading) return <Loading label="Loading Milestones…" />;
  if (error) {
    return (
      <div className="empty-state" style={{ maxWidth: 520, margin: "16px auto" }}>
        <h3 style={{ color: "var(--danger)" }}>Couldn't load milestones</h3>
        <p style={{ fontSize: "0.82rem" }}>{error}</p>
        <button className="btn btn-primary" onClick={load} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
        Auto-synced Milestones table — flagged/staged in the 90-Day Action Tracker and mirrored here with types, priorities and RAG health.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {Object.entries(counts).map(([label, value]) => (
          <div key={label} className="metric-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="metric-title">{label}</span>
            <span className="metric-value" style={{ fontSize: "1.4rem", color: label === "Overdue" && value > 0 ? "var(--danger)" : "var(--text-primary)" }}>{value}</span>
          </div>
        ))}
      </div>

      <ControlCard
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        startup={startup}
        onStartup={(v) => { setStartup(v); setPage(1); }}
        startups={startupOptions}
        status={status}
        onStatus={(v) => { setStatus(v); setPage(1); }}
        statuses={MILESTONE_STATUSES}
        owner={owner}
        onOwner={(v) => { setOwner(v); setPage(1); }}
        owners={owners}
        priority={priority}
        onPriority={(v) => { setPriority(v); setPage(1); }}
        priorities={PRIORITIES}
        total={decorated.length}
        shown={filtered.length}
        onReset={() => { setQ(""); setStartup(""); setStatus(""); setOwner(""); setPriority(""); setPage(1); }}
        onExport={exportCsv}
      />

      {pageItems.length === 0 ? (
        <Empty title="No milestones found" sub={records.length === 0 ? "Check off or add milestones in the 90-Day Action Plan / Tracker — they appear here automatically." : "Nothing matches the current filters."} />
      ) : (
        <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden", background: "white" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 860 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <th style={headCell}>Startup</th>
                  <th style={headCell}>Milestone</th>
                  <th style={headCell}>Status</th>
                  <th style={headCell}>Target</th>
                  <th style={headCell}>Actual</th>
                  <th style={headCell}>Priority</th>
                  <th style={headCell}>RAG</th>
                  <th style={headCell}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color)", background: m.status === "Delayed" || m.overdue ? "#FEF2F2" : "white" }}>
                    <td style={cell}>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{m.startup_code ? `${m.startup_code} – ${m.startup_name}` : (m.startup_name || "—")}</div>
                      {m.target_metric && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{m.target_metric}</div>}
                    </td>
                    <td style={cell}>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{m.milestone || m.title || "—"}</div>
                      {m.milestone_type && <span style={{ display: "inline-block", marginTop: 2, fontSize: "0.6rem", fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "#EEF2FF", color: "#4F46E5" }}>{m.milestone_type}</span>}
                    </td>
                    <td style={cell}>
                      <select
                        className="form-input"
                        style={{ height: 30, fontSize: "0.72rem", width: "100%", minWidth: 128, fontWeight: 700, color: m.sc.color, borderColor: m.sc.bg }}
                        value={m.status || "Not Started"}
                        onChange={(e) => updateStatus(m, e.target.value)}
                      >
                        {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={cell}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Flag size={11} style={{ color: "var(--text-dim)" }} /> {m.target_date || "—"}
                      </span>
                      {m.overdue && <span style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2, color: "#ef4444", fontSize: "0.68rem", fontWeight: 700 }}><AlertTriangle size={10} /> Overdue</span>}
                    </td>
                    <td style={cell}>
                      {m.actual_date ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#065f46" }}><CheckCircle2 size={11} /> {m.actual_date}</span>
                      ) : (
                        <span style={{ color: "var(--text-dim)" }}>—</span>
                      )}
                    </td>
                    <td style={cell}>
                      {m.priority ? (() => { const ps = PRIORITY_STYLE[p1toP4(m.priority)] || { bg: "#FEF3C7", color: "#92400e" }; return (
                        <span style={{ fontSize: "0.64rem", fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: ps.bg, color: ps.color, whiteSpace: "nowrap" }}>{p1toP4(m.priority)}</span>
                      ); })() : <span style={{ color: "var(--text-dim)" }}>—</span>}
                    </td>
                    <td style={cell}>
                      {(() => { const rg = RAG_STYLE[m.rag] || RAG_STYLE.green; return (
                        <span style={{ fontSize: "0.62rem", fontWeight: 800, padding: "2px 9px", borderRadius: 99, background: rg.bg, color: rg.color }}>{m.rag.toUpperCase()}</span>
                      ); })()}
                    </td>
                    <td style={cell}>{m.owner || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} sizes={[6, 12, 18, 30, 50]} />
    </div>
  );
}