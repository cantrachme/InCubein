import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Building2, Search, RefreshCw, Rocket, Users, Wallet, TrendingUp, X,
  ChevronRight, MapPin, Activity, ShieldAlert, BadgeCheck, Eye,
} from "lucide-react";
import {
  Card, Stat, Donut, BarRow, HealthBadge, StagePill, Loading, Modal, DataError, fetchJson,
  fmtINR, fmtNum, fmtPct,
} from "./crm/CrmUi";

const CHART_COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#06B6D4", "#64748B"];

const kpiCard = { background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px" };
const kpiLabel = { fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" };
const kpiValue = { fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" };
const thStyle = { textAlign: "left", padding: "8px 10px", color: "var(--text-dim)", fontSize: "0.66rem", textTransform: "uppercase", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap" };
const tdStyle = { padding: "8px 10px", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: "0.78rem" };
const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border-color)",
  fontSize: "0.8rem", background: "white", color: "var(--text-primary)",
};

function ChartCard({ title, empty, children }) {
  return (
    <Card title={title} bodyStyle={{ width: "100%" }}>
      {empty ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "30px 10px", color: "var(--text-dim)", fontSize: "0.78rem", textAlign: "center" }}>
          <ShieldAlert size={22} opacity={0.4} />
          No sufficient data available for this view yet.
          <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>Data will appear once records are synced/entered.</span>
        </div>
      ) : children}
    </Card>
  );
}

function MiniBars({ points, color = "var(--primary)", valueFmt }) {
  if (!points || points.length < 2) {
    return <div style={{ fontSize: "0.76rem", color: "var(--text-dim)", padding: "20px 0", textAlign: "center" }}>Not enough data points</div>;
  }
  const max = Math.max(...points.map((p) => Number(p.value) || 0)) || 1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: "150px", width: "100%", paddingTop: "10px" }}>
      {points.map((p, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
          <span style={{ fontSize: "0.64rem", color: "var(--text-primary)", fontWeight: 700, marginBottom: 4, whiteSpace: "nowrap" }}>
            {valueFmt ? valueFmt(p.value) : p.value}
          </span>
          <div
            title={p.label}
            style={{ width: "100%", maxWidth: 46, borderRadius: "6px 6px 0 0", background: color, minHeight: 3 }}
          />
          <span style={{ fontSize: "0.62rem", color: "var(--text-dim)", marginTop: 4, whiteSpace: "nowrap", transform: "rotate(-35deg)" }}>{p.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function StartupDashboard() {
  const [startups, setStartups] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ sector: "All", stage: "All", city: "All" });
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, anal, sum] = await Promise.all([
        fetchJson("/api/crm/startups"),
        fetchJson("/api/crm/analytics"),
        fetchJson("/api/crm/summary"),
      ]);
      setStartups((list && list.records) || []);
      setAnalytics(anal);
      setSummary(sum);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tick]);

  const options = useMemo(() => ({
    sector: [...new Set(startups.map((s) => (s.sector || "").trim()).filter(Boolean))].sort(),
    stage: [...new Set(startups.map((s) => (s.stage || "").trim()).filter(Boolean))].sort(),
    city: [...new Set(startups.map((s) => (s.city || "").trim()).filter(Boolean))].sort(),
  }), [startups]);

  const visible = useMemo(() => {
    let list = [...startups];
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((s) =>
        [s.name, s.code, s.sector, s.stage, s.city, s.status, s.founder].some((f) =>
          String(f || "").toLowerCase().includes(needle)
        )
      );
    }
    if (filters.sector !== "All") list = list.filter((s) => (s.sector || "").trim() === filters.sector);
    if (filters.stage !== "All") list = list.filter((s) => (s.stage || "").trim() === filters.stage);
    if (filters.city !== "All") list = list.filter((s) => (s.city || "").trim() === filters.city);
    return list;
  }, [startups, q, filters]);

  const dist = (key) => {
    const out = {};
    for (const s of startups) {
      const v = (s[key] || "").trim() || "Unspecified";
      out[v] = (out[v] || 0) + 1;
    }
    return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, count: v }));
  };

  const sectorDist = useMemo(() => dist("sector"), [startups]);
  const stageDist = useMemo(() => dist("stage"), [startups]);
  const cityDist = useMemo(() => dist("city"), [startups]);
  const bandDist = useMemo(() => dist("health_band"), [startups]);

  const scoreDist = useMemo(() => {
    const out = {};
    for (const s of startups) {
      if (s.health_score == null && s.health_score === undefined) { out["Unaudited"] = (out["Unaudited"] || 0) + 1; continue; }
      const v = Number(s.health_score);
      const band = v >= 80 ? "80 – 100" : v >= 65 ? "65 – 79" : v >= 50 ? "50 – 64" : "0 – 49";
      out[band] = (out[band] || 0) + 1;
    }
    return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, count: v }));
  }, [startups]);

  const funding = analytics && analytics.funding_by_stage;
  const fundingPoints = (funding || []).map((f) => ({ label: f.stage, value: f.received }));
  const fundingReceived = (funding || []).reduce((s, f) => s + Number(f.received || 0), 0);
  const fundingSought = (funding || []).reduce((s, f) => s + Number(f.sought || 0), 0);

  const revPoints = ((analytics && analytics.revenue_trend) || []).map((r) => ({ label: r.month || "", value: Number(r.revenue || 0) }));
  const auditPoints = ((analytics && analytics.audit_trend) || []).map((a) => ({ label: a.month || "", value: Number(a.avg || 0) }));
  const auditedCount = bandDist.filter((b) => b.key !== "Not Audited").reduce((s, b) => s + b.count, 0);

  if (loading && startups.length === 0 && !error) return <Loading label="Loading startup intelligence…" />;
  if (error && startups.length === 0) return <DataError message={error} onRetry={() => setTick((t) => t + 1)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
          <Rocket size={17} style={{ marginRight: 6, verticalAlign: -2 }} /> Startup Dashboard
          <span style={{ fontWeight: 600, fontSize: "0.78rem", color: "var(--text-dim)", marginLeft: 8 }}>{startups.length} startups · {visible.length} shown</span>
        </h3>
        <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        <div style={kpiCard}><div style={kpiLabel}>Startups</div><div style={kpiValue}>{summary ? fmtNum(summary.startups) : "—"}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Audited / Scored</div><div style={{ ...kpiValue, color: "#3b82f6" }}>{auditedCount}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Funding Received</div><div style={{ ...kpiValue, color: "#10b981" }}>{fundingReceived > 0 ? fmtINR(fundingReceived) : "—"}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Funding Sought</div><div style={{ ...kpiValue, color: "#8b5cf6" }}>{fundingSought > 0 ? fmtINR(fundingSought) : "—"}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Portfolio Revenue (last)</div><div style={{ ...kpiValue, color: "#f59e0b" }}>{revPoints.length ? fmtINR(revPoints.slice(-1)[0].value) : "—"}</div></div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
        <ChartCard title="Sector Distribution" empty={sectorDist.length === 0 || sectorDist.every((d) => d.key === "Unspecified")}>
          {sectorDist.map((d, i) => (
            <BarRow key={i} label={d.key} count={d.count} total={startups.length} color={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </ChartCard>

        <ChartCard title="Stage Funnel" empty={stageDist.length === 0 || stageDist.every((d) => d.key === "Unspecified")}>
          {stageDist.map((d, i) => (
            <BarRow key={i} label={d.key} count={d.count} total={startups.length} color={CHART_COLORS[(i + 1) % CHART_COLORS.length]} />
          ))}
        </ChartCard>

        <ChartCard title="City / State Distribution" empty={cityDist.length === 0 || cityDist.every((d) => d.key === "Unspecified")}>
          {cityDist.map((d, i) => (
            <BarRow key={i} label={d.key} count={d.count} total={startups.length} color={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
          ))}
        </ChartCard>

        <ChartCard title="Health Scores" empty={bandDist.length === 0}>
          <Donut data={bandDist} colors={CHART_COLORS} />
        </ChartCard>

        <ChartCard title="Score Distribution" empty={scoreDist.length === 0}>
          {scoreDist.map((d, i) => (
            <BarRow key={i} label={d.key} count={d.count} total={startups.length} color={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
          ))}
        </ChartCard>

        <ChartCard title="Funding by Stage" empty={!funding || funding.length === 0}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Received</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textAlign: "right" }}>{fmtINR(fundingReceived)}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Sought</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textAlign: "right" }}>{fmtINR(fundingSought)}</div>
          </div>
          <MiniBars points={fundingPoints} color="#10B981" valueFmt={fmtINR} />
        </ChartCard>

        <ChartCard title="Cohort Revenue Trend" empty={revPoints.length === 0}>
          <MiniBars points={revPoints.slice(-12)} color="#F59E0B" valueFmt={fmtINR} />
        </ChartCard>

        <ChartCard title="Audit Score Trend" empty={auditPoints.length === 0}>
          <MiniBars points={auditPoints.slice(-12)} color="#3B82F6" valueFmt={(v) => v.toFixed?.(1) ?? v} />
        </ChartCard>
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <input
            style={{ ...inputStyle, paddingLeft: "30px" }}
            placeholder="Search startup, sector, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
        </div>
        <select style={{ ...inputStyle, width: "150px" }} value={filters.sector} onChange={(e) => setFilters({ ...filters, sector: e.target.value })}>
          <option value="All">All sectors</option>
          {options.sector.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select style={{ ...inputStyle, width: "150px" }} value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
          <option value="All">All stages</option>
          {options.stage.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select style={{ ...inputStyle, width: "150px" }} value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })}>
          <option value="All">All cities</option>
          {options.city.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Startups table */}
      <div style={{ overflowX: "auto", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Startup</th>
              <th style={thStyle}>Sector</th>
              <th style={thStyle}>Stage</th>
              <th style={thStyle}>City</th>
              <th style={thStyle}>Health</th>
              <th style={thStyle}>Funding</th>
              <th style={thStyle}>Revenue</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "var(--text-dim)", padding: "26px 0" }}>No startups match your filters. Sync uploaded directories or add records in the CRM to populate this view with real data.</td></tr>
            )}
            {visible.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSelected(s)}
                style={{ cursor: "pointer", transition: "background 0.15s ease", borderBottom: "1px solid var(--border-color)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface, #F8FAFC)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap", color: "var(--primary)" }}>{s.code || "—"}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{s.name}</td>
                <td style={tdStyle}>{s.sector || "—"}</td>
                <td style={tdStyle}><StagePill value={s.stage} /></td>
                <td style={tdStyle}>{s.city || "—"}</td>
                <td style={tdStyle}><HealthBadge value={s.health_band} /></td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{s.funding_received > 0 ? fmtINR(s.funding_received) : "—"}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{s.monthly_revenue > 0 ? fmtINR(s.monthly_revenue) : "—"}</td>
                <td style={tdStyle}><ChevronRight size={14} style={{ color: "var(--text-dim)", verticalAlign: "middle" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <StartupProfile startup={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StartupProfile({ startup, onClose }) {
  const fields = [
    ["Code", startup.code],
    ["Name", startup.name],
    ["Sector", startup.sector],
    ["Sub-sector", startup.sub_sector],
    ["Stage", startup.stage],
    ["Status", startup.status],
    ["City", startup.city],
    ["State", startup.state],
    ["Founded", startup.founded_year || startup.incorporated_on],
    ["Website", startup.website],
    ["Primary Mentor", startup.primary_mentor],
    ["Founders", `${startup.founders_count ?? startup.founder_count ?? 0} recorded`],
    ["Funding Received", startup.funding_received > 0 ? fmtINR(startup.funding_received) : null],
    ["Funding Stage", startup.funding_stage],
    ["Monthly Revenue", startup.monthly_revenue > 0 ? fmtINR(startup.monthly_revenue) : null],
    ["Health Score", startup.health_score != null ? `${startup.health_score} / 100` : null],
    ["Action Plan", startup.plan_title || startup.plan_id ? String(startup.plan_id || "linked") : null],
    ["Overdue Actions", startup.overdue_actions > 0 ? `${startup.overdue_actions}` : null],
    ["Active Deals", startup.active_deals > 0 ? `${startup.active_deals}` : null],
    ["Customers", startup.customer_count > 0 ? `${startup.customer_count}` : null],
  ].filter(([, v]) => v != null && v !== "");
  return (
    <Modal open onClose={onClose} title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Building2 size={16} /> Startup Profile</span>} width={680}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>{startup.name}</span>
        {startup.code && <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: "12px", background: "var(--bg-dark)", color: "var(--text-dim)" }}>{startup.code}</span>}
        <HealthBadge value={startup.health_band} />
      </div>
      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0 0 14px" }}>This is the same `crm_startups` record used across the CRM — edits made here persist to the whole portfolio.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: "0.8rem" }}>
        {fields.map(([label, value]) => (
          <div key={label} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px dashed var(--border-color)" }}>
            <span style={{ color: "var(--text-dim)", flex: "0 0 132px", fontWeight: 600 }}>{label}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 700, wordBreak: "break-word" }}>{value}</span>
          </div>
        ))}
      </div>
      {startup.about && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>About</div>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "var(--text-body)", margin: 0 }}>{startup.about}</p>
        </div>
      )}
    </Modal>
  );
}