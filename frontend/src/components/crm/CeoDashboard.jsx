import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Rocket, Users, Activity, GraduationCap, AlertTriangle, Wallet,
  TrendingUp, Target, CheckCircle2, Clock, AlertCircle, ArrowUpRight,
  RefreshCw, CircleDot, LayoutDashboard,
} from "lucide-react";
import { getCeo } from "../../lib/crmApi";
import { Card, Stat, BarRow, Donut, HealthBadge, Loading, Empty, fmtINR } from "./CrmUi";

const SEV = {
  critical: { cls: "badge-danger", label: "CRITICAL" },
  high: { cls: "badge-danger", label: "HIGH" },
  medium: { cls: "badge-warning", label: "MEDIUM" },
  low: { cls: "badge-info", label: "LOW" },
};

export default function CeoDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getCeo());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Assembling the CEO dashboard…" />;
  if (!data) return <Empty title="No data available" />;

  const t = data.totals || {};
  const healthDonut = (data.health_bands || []).map((b) => ({ key: b.band, count: b.count }));
  const bandColors = {
    GREEN: "#10B981", GROWTH: "#3B82F6", AMBER: "#F59E0B",
    INTERVENTION: "#8B5CF6", CRITICAL: "#EF4444", "Not Audited": "#CBD5E1",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Key metrics */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", marginBottom: 0 }}>
        <Stat label="Portfolio Startups" value={fmtNum(t.startups)} icon={<Rocket size={16} />} tone="primary" />
        <Stat label="Active Startups" value={fmtNum(t.active_startups)} icon={<Activity size={16} />} tone="info" />
        <Stat label="Founders Managed" value={fmtNum(t.founders)} icon={<Users size={16} />} tone="purple" />
        <Stat label="Audits Completed" value={fmtNum(t.audits)} icon={<CheckCircle2 size={16} />} tone="success" />
        <Stat label="Avg Health Score" value={t.avg_health || "—"} icon={<LayoutDashboard size={16} />} tone="warning" />
        <Stat label="Healthy (GREEN/GROWTH)" value={fmtNum(t.healthy_count)} icon={<TrendingUp size={16} />} tone="success" />
        <Stat label="Attention Required" value={fmtNum(t.attention_count)} icon={<AlertTriangle size={16} />} tone="danger" />
        <Stat label="University Colleges" value={fmtNum(t.colleges)} icon={<GraduationCap size={16} />} tone="accent" />
        <Stat label="Student Pipeline" value={fmtNum(t.students)} icon={<Users size={16} />} tone="info" />
        <Stat label="Student Referrals" value={fmtNum(t.student_referrals)} icon={<ArrowUpRight size={16} />} tone="primary" />
      </div>

      {/* Health + Stages */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <Card title="Portfolio Health" subtitle="Distribution across audit rating bands" action={<HealthBadge value="GREEN" />} bodyStyle={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
          <Donut data={healthDonut} colors={healthDonut.map((d) => bandColors[d.key] || "#CBD5E1")} valueKey="count" labelKey="key" />
        </Card>

        <Card title="Startups by Stage" subtitle="Where the portfolio sits today">
          <BarRow label="Total" count={data.stages.reduce((s, d) => s + d.count, 0)} total={data.stages.reduce((s, d) => s + d.count, 0)} color="var(--primary)" suffix="" />
          {(data.stages || []).map((s) => (
            <BarRow key={s.stage} label={s.stage} count={s.count} total={t.startups || 1} color="var(--primary)" />
          ))}
          {(data.stages || []).length === 0 && <Empty title="No stage data" />}
        </Card>
      </div>

      {/* Finance */}
      <Card title="Financial Snapshot" subtitle={data.finance?.latest_month ? `Latest reporting month: ${data.finance.latest_month}` : "No financial records yet"}>
        <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 0 }}>
          <Stat label="Monthly Revenue" value={fmtINR(data.finance?.monthly_revenue)} icon={<TrendingUp size={16} />} tone="success" />
          <Stat label="Monthly Recurring (MRR)" value={fmtINR(data.finance?.mrr)} icon={<TrendingUp size={16} />} tone="info" />
          <Stat label="Funding Received" value={fmtINR(data.finance?.funding_received)} icon={<Wallet size={16} />} tone="primary" />
          <Stat label="Funding Pipeline" value={fmtINR(data.finance?.funding_pipeline)} icon={<Target size={16} />} tone="warning" />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Sales pipeline */}
        <Card title="Sales Pipeline" subtitle={`${fmtINR(data.pipeline?.total_pipeline_value)} open pipeline · ${data.pipeline?.won_deals} won of ${data.pipeline?.total_deals} deals`}>
          {(data.pipeline?.deal_stages || []).map((s, i) => (
            <BarRow key={s.stage} label={s.stage} count={s.count} total={data.pipeline?.total_deals || 1} color={["#00B59C", "#3B82F6", "#F59E0B", "#8B5CF6", "#EF4444", "#10B981"][i % 6]} suffix="deals" />
          ))}
          {(data.pipeline?.deal_stages || []).length === 0 && <Empty title="No deals" />}
        </Card>

        {/* Execution */}
        <Card title="90-Day Execution" subtitle="Action tracker health across the portfolio">
          <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 0 }}>
            <Stat label="Total Actions" value={fmtNum(data.execution?.total_actions)} icon={<Activity size={16} />} tone="info" />
            <Stat label="Completed" value={fmtNum(data.execution?.completed_actions)} icon={<CheckCircle2 size={16} />} tone="success" />
            <Stat label="On Track" value={fmtNum(data.execution?.on_track_actions)} icon={<CircleDot size={16} />} tone="primary" />
            <Stat label="Overdue" value={fmtNum(data.execution?.overdue_actions)} icon={<Clock size={16} />} tone="danger" />
          </div>
          <div style={{ marginTop: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Overdue ratios are recomputed daily; overdue items surface in <strong>Attention Required</strong>.
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Attention */}
        <Card
          title="Needs Attention"
          subtitle="Startups that require focus right now"
          action={<span className="badge badge-danger">{data.attention?.count || 0} flagged</span>}
        >
          {(data.attention?.records || []).map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.88rem" }}>{r.code} — {r.name}</span>
                <HealthBadge value={r.health_band} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                {(r._triggers || []).map((tr, i) => (
                  <span key={i} className={`badge ${(SEV[tr.sev] || SEV.low).cls}`} style={{ textTransform: "none", letterSpacing: 0 }}>
                    {tr.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {(data.attention?.records || []).length === 0 && <Empty title="All clear" sub="No startups currently require attention." />}
        </Card>

        {/* Upcoming milestones */}
        <Card title="Upcoming Milestones" subtitle="Next six milestones across the portfolio" action={<CalendarIcon />}>
          {(data.upcoming_milestones || []).map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-color)", padding: "10px 0" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.86rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{m.startup_name}{m.owner ? ` · ${m.owner}` : ""}</div>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-body)" }}>{(m.target_date || "").slice(0, 10) || "—"}</div>
                <div><span className="badge badge-neutral">{m.status || "—"}</span></div>
              </div>
            </div>
          ))}
          {(data.upcoming_milestones || []).length === 0 && <Empty title="No upcoming milestones" />}
        </Card>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh CEO dashboard"><RefreshCw size={14} /></button>
        <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}><AlertCircle size={11} style={{ verticalAlign: "middle" }} /> Data refreshes automatically when this view opens.</span>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return <span className="badge badge-primary"><Target size={11} /> Ship dates</span>;
}