import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { AlertOctagon, RefreshCw, ScanEye } from "lucide-react";
import { listModule } from "../lib/crmApi";
import { Pagination, Loading, Empty, Pill } from "./crm/CrmUi";
import ControlCard from "./execution/ControlCard";
import { RISK_STATUSES, PRIORITIES, PRIORITY_STYLE, p1toP4, downloadCsv, downloadTemplate, parseCsvFile } from "../lib/executionConfig";

const LEVEL_STYLES = {
  Critical: { color: "#dc2626", bg: "#FEE2E2", order: 4 },
  High: { color: "#ea580c", bg: "#FFEDD5", order: 3 },
  Medium: { color: "#d97706", bg: "#FEF3C7", order: 2 },
  Low: { color: "#16a34a", bg: "#DCFCE7", order: 1 },
};

const levelOf = (r) => {
    if (r.risk_level) return r.risk_level;
    const p = Number(r.probability) || 0;
    const i = Number(r.impact) || 0;
    const score = Number(r.risk_score) || (p * i) || 0;
    if (score >= 20) return "Critical";
    if (score >= 12) return "High";
    if (score >= 6) return "Medium";
    return "Low";
  };

  const probTo5 = (prob) => {
    const p = Number(prob) || 0;
    if (p >= 80) return 5;
    if (p >= 60) return 4;
    if (p >= 40) return 3;
    if (p >= 20) return 2;
    return 1;
  };

  const impactTo5 = (imp) => ({ High: 5, Medium: 3, Low: 1 })[String(imp || "").trim()] || 3;

export default function RisksView() {
  const [records, setRecords] = useState([]);
  const [plans, setPlans] = useState([]);
  const [startupOptions, setStartupOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levelTab, setLevelTab] = useState("All");
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
      const [rs, st, pl] = await Promise.all([
        listModule("risks", {}),
        listModule("startups", {}),
        fetch("/api/crm/action-plans", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      setRecords(rs.records || []);
      setStartupOptions(st.records || []);
      setPlans(pl);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const planMap = useMemo(() => {
    const m = {};
    for (const p of plans || []) m[p.id] = p;
    return m;
  }, [plans]);

  const decorated = useMemo(() => (records || []).map((r) => ({
    ...r,
    level: levelOf(r),
    plan_title: planMap[r.plan_id] ? planMap[r.plan_id].title : (r.plan_title || ""),
    isPlanRisk: Boolean(r.plan_id),
  })), [records, planMap]);

  const counts = useMemo(() => ({
    All: decorated.length,
    Open: decorated.filter((r) => (r.status || "Open") === "Open").length,
    Monitoring: decorated.filter((r) => r.status === "Monitoring").length,
    Mitigating: decorated.filter((r) => r.status === "Mitigating").length,
    Closed: decorated.filter((r) => r.status === "Closed").length,
  }), [decorated]);

  const openRisks = useMemo(() => decorated.filter((r) => (r.status || "Open") !== "Closed"), [decorated]);
  const criticalCount = openRisks.filter((r) => r.level === "Critical").length;
  const highCount = openRisks.filter((r) => r.level === "High").length;

  const matrix = useMemo(() => {
    const grid = Array.from({ length: 5 }, () => Array(5).fill(0));
    for (const r of openRisks) {
      const p = probTo5(r.probability);
      const i = impactTo5(r.impact);
      if (!p || !i) continue;
      grid[i - 1][p - 1] += 1;
    }
    return grid;
  }, [openRisks]);

  const levelDist = useMemo(() => {
    const dist = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const r of openRisks) dist[r.level] += 1;
    return dist;
  }, [openRisks]);

  const owners = useMemo(() => [...new Set(decorated.map((r) => r.owner).filter(Boolean))], [decorated]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return decorated.filter((r) => {
      const st = r.status || "Open";
      if (status && st !== status) return false;
      if (levelTab !== "All" && r.level !== levelTab) return false;
      if (startup && String(r.startup_id) !== String(startup)) return false;
      if (owner && r.owner !== owner) return false;
      if (priority && p1toP4(r.priority) !== priority) return false;
      if (needle) {
        return (
          String(r.risk || r.title || "").toLowerCase().includes(needle) ||
          String(r.startup_name || "").toLowerCase().includes(needle) ||
          String(r.category || "").toLowerCase().includes(needle) ||
          String(r.owner || "").toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [decorated, status, levelTab, startup, owner, priority, q]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => (LEVEL_STYLES[b.level].order - LEVEL_STYLES[a.level].order)), [filtered]);

  const exportCsv = () =>
    downloadCsv("risk-register.csv", sorted, [
      { key: "startup_name", label: "Startup" },
      { key: "risk", label: "Risk" },
      { key: "category", label: "Category" },
      { key: "level", label: "Level" },
      { key: "probability", label: "Probability %" },
      { key: "impact", label: "Impact" },
      { key: "risk_score", label: "Score" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "owner", label: "Owner" },
      { key: "due_date", label: "Due Date" },
      { key: "mitigation", label: "Mitigation" },
    ]);

  const downloadRiskTemplate = () =>
    downloadTemplate("risks-template.csv", [
      { key: "item_type", label: "item_type" },
      { key: "risk", label: "risk" },
      { key: "category", label: "category" },
      { key: "severity", label: "severity" },
      { key: "probability", label: "probability" },
      { key: "impact", label: "impact" },
      { key: "status", label: "status" },
      { key: "owner", label: "owner" },
      { key: "due_date", label: "due_date" },
      { key: "mitigation", label: "mitigation" },
    ]);

  const handleBulkUpload = async (file) => {
    try {
      const rows = await parseCsvFile(file);
      const planSelect = plans[0];
      if (!planSelect) {
        toast.warn("Create an Action Plan first — risks are imported into a plan.");
        return;
      }
      const res = await fetch(`/api/crm/action-plans/${planSelect.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Imported ${data.created && data.created.risks} risks (action: ${data.created && data.created.actions}, milestone: ${data.created && data.created.milestones}).`);
        await load();
      } else {
        toast.error(data.detail || "Import failed.");
      }
    } catch {
      toast.error("Network error during import.");
    }
  };

  const start = (page - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  if (loading) return <Loading label="Loading Risk Register…" />;
  if (error) {
    return (
      <div className="empty-state" style={{ maxWidth: 520, margin: "16px auto" }}>
        <h3 style={{ color: "var(--danger)" }}>Couldn't load risks</h3>
        <p style={{ fontSize: "0.82rem" }}>{error}</p>
        <button className="btn btn-primary" onClick={load} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const stats = [
    { label: "Total Risks", value: decorated.length, tone: "var(--text-primary)" },
    { label: "Open", value: counts.Open, tone: "var(--info)" },
    { label: "High / Critical", value: highCount + criticalCount, tone: "var(--warning)" },
    { label: "Mitigating", value: counts.Mitigating, tone: "var(--primary)" },
    { label: "Closed", value: counts.Closed, tone: "var(--success)" },
  ];

  const matrixFont = (val) => {
    if (val === 0) return "var(--text-dim)";
    return val >= 3 ? "#fff" : "#7c2d12";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
        Risk register — plan risks from the 90-Day Action Plan plus risks logged in the Tracker surface here automatically.
      </p>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {stats.map((s) => (
          <div key={s.label} className="metric-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="metric-title">{s.label}</span>
            <span className="metric-value" style={{ fontSize: "1.5rem", color: s.tone }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
        {/* Risk matrix heatmap */}
        <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, background: "white", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <ScanEye size={15} style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-primary)" }}>Live Risk Matrix (Open)</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--text-dim)", padding: "2px 0 2px", writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center", alignSelf: "stretch", gap: 2 }}>
              <span>Impact 5 (high)</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                {matrix.flat().map((v, idx) => {
                  const level = ["Low", "Low", "Medium", "High", "Critical"][idx % 5];
                  return (
                    <div key={idx} title={`${level} cell`} style={{
                      aspectRatio: "1 / 1", borderRadius: 8, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "0.78rem", fontWeight: 800, color: matrixFont(v),
                      background: v === 0
                        ? "var(--bg-dark)"
                        : level === "Critical" ? "#dc2626" : level === "High" ? "#ea580c" : level === "Medium" ? "#f59e0b" : "#22c55e",
                      border: "1px solid var(--border-color)",
                    }}>
                      {v > 0 ? v : ""}
                    </div>
                  );
                })}
              </div>
              <div style={{ textAlign: "center", fontSize: "0.62rem", color: "var(--text-dim)", marginTop: 6 }}>Probability 1 (low) → 5 (high)</div>
            </div>
          </div>
        </div>

        {/* Level distribution */}
        <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, background: "white", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <AlertOctagon size={15} style={{ color: "var(--danger)" }} />
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-primary)" }}>Severity Distribution (Open)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.keys(LEVEL_STYLES).map((lv) => {
              const n = levelDist[lv] || 0;
              const total = Math.max(1, Object.values(levelDist).reduce((a, b) => a + b, 0) || 1);
              const st = LEVEL_STYLES[lv];
              return (
                <div key={lv}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 700, color: st.color, marginBottom: 4 }}>
                    <span>{lv}</span>
                    <span>{n}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--bg-dark)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(n / total) * 100}%`, background: st.color, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-dim)" }}>Severity</span>
        <select className="form-input" style={{ height: 34, width: "auto", fontSize: "0.78rem" }} value={levelTab} onChange={(e) => { setLevelTab(e.target.value); setPage(1); }}>
          <option value="All">All levels</option>
          {Object.keys(LEVEL_STYLES).map((lv) => <option key={lv} value={lv}>{lv}</option>)}
        </select>
      </div>

      <ControlCard
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        startup={startup}
        onStartup={(v) => { setStartup(v); setPage(1); }}
        startups={startupOptions}
        status={status}
        onStatus={(v) => { setStatus(v); setPage(1); }}
        statuses={RISK_STATUSES}
        owner={owner}
        onOwner={(v) => { setOwner(v); setPage(1); }}
        owners={owners}
        priority={priority}
        onPriority={(v) => { setPriority(v); setPage(1); }}
        priorities={PRIORITIES}
        total={decorated.length}
        shown={sorted.length}
        onReset={() => { setQ(""); setStartup(""); setStatus(""); setOwner(""); setPriority(""); setPage(1); }}
        onExport={exportCsv}
        onTemplate={downloadRiskTemplate}
        onBulkUpload={handleBulkUpload}
      />

      {/* Table */}
      {pageItems.length === 0 ? (
        <Empty title="No risks found" sub={decorated.length === 0 ? "No risks recorded yet. Risk items from the 90-Day Action Plan appear here." : "Nothing matches the current filters in this view."} />
      ) : (
        <div className="table-wrapper" style={{ maxHeight: 560 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Startup</th>
                <th>Risk</th>
                <th>Category</th>
                <th>Prob.</th>
                <th>Impact</th>
                <th>Score</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Mitigation</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r) => {
                const st = LEVEL_STYLES[r.level] || LEVEL_STYLES.Low;
                const score = Number(r.risk_score) || (probTo5(r.probability) * impactTo5(r.impact)) || "—";
                return (
                  <tr key={r.id}>
                    <td><Pill value={r.level} color={st.color} /></td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: "0.76rem", color: "var(--text-primary)" }}>{r.startup_name || "—"}</div>
                      {r.plan_title && <div style={{ fontSize: "0.66rem", color: "var(--text-dim)" }}>{r.plan_title}</div>}
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-primary)" }}>{r.risk || r.title || "—"}</div>
                    </td>
                    <td><Pill value={r.category || "—"} /></td>
                    <td style={{ textAlign: "center" }}>{r.probability || "—"}</td>
                    <td style={{ textAlign: "center" }}>{r.impact || "—"}</td>
                    <td style={{ fontWeight: 700, color: st.color }}>{score || "—"}</td>
                    <td>
                      {r.priority ? (() => { const ps = PRIORITY_STYLE[p1toP4(r.priority)] || { bg: "#FEF3C7", color: "#92400e" }; return (
                        <span style={{ fontSize: "0.64rem", fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: ps.bg, color: ps.color, whiteSpace: "nowrap" }}>{p1toP4(r.priority)}</span>
                      ); })() : <span style={{ color: "var(--text-dim)" }}>—</span>}
                    </td>
                    <td><Pill value={r.status || "Open"} color={r.status === "Closed" ? "var(--success)" : r.status === "Mitigating" ? "var(--primary)" : r.status === "Monitoring" ? "var(--info)" : "var(--warning)"} /></td>
                    <td style={{ maxWidth: 220, fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "normal" }}>{r.mitigation || "—"}</td>
                    <td>{r.owner || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={pageSize} total={sorted.length} onPage={setPage} onPageSize={setPageSize} sizes={[6, 9, 12, 18, 30]} />
    </div>
  );
}