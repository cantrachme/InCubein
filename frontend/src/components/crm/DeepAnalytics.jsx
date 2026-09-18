import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { RefreshCw, PieChart, Activity, LineChart, Layers, Percent } from "lucide-react";
import { getAnalytics } from "../../lib/crmApi";
import { Card, BarRow, Donut, Stat, TrendLine, Loading, Empty, fmtINR, fmtNum } from "./CrmUi";

const BAND_COLORS = { GREEN: "#10B981", GROWTH: "#3B82F6", AMBER: "#F59E0B", INTERVENTION: "#8B5CF6", CRITICAL: "#EF4444", "Not Audited": "#CBD5E1" };
const PALETTE = ["#00B59C", "#3B82F6", "#F59E0B", "#8B5CF6", "#EF4444", "#10B981", "#D11A5B", "#64748B"];

export default function DeepAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getAnalytics());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Crunching analytics…" />;
  if (!data) return <Empty title="No analytics available" />;

  const dist = data.distributions || {};
  const rev = data.revenue_trend || [];
  const aud = data.audit_trend || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Volume badges */}
      <Card title="Dataset coverage" subtitle="How much data is flowing into each module" bodyStyle={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(data.totals || {}).map(([k, v]) => (
          <span key={k} className="badge badge-neutral" style={{ textTransform: "none", fontSize: "0.76rem" }}>
            {k}: <strong>{fmtNum(v)}</strong>
          </span>
        ))}
      </Card>

      {/* Distributions */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Card title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><PieChart size={15} /> Health Bands</span>}>
          <Donut
            data={dist.health_bands || []}
            colors={(dist.health_bands || []).map((d) => BAND_COLORS[d.key] || "#CBD5E1")}
            valueKey="count" labelKey="key" size={140}
          />
        </Card>
        <Card title="Founder Demographics — Gender">
          <Donut data={(data.founder_demographics?.gender) || []} colors={PALETTE} valueKey="count" labelKey="key" size={140} />
        </Card>
        <Card title="Founder Demographics — Student Status">
          <Donut data={(data.founder_demographics?.student_status) || []} colors={["#F59E0B", "#3B82F6", "#00B59C"]} valueKey="count" labelKey="key" size={140} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <Card title="Startups by Stage">
          {(dist.stages || []).map((s, i) => <BarRow key={s.key} label={s.key} count={s.count} total={data.totals?.startups || 1} color={PALETTE[i % PALETTE.length]} />)}
          {!(dist.stages || []).length && <Empty />}
        </Card>
        <Card title="Startups by Sector">
          {(dist.sectors || []).map((s, i) => <BarRow key={s.key} label={s.key} count={s.count} total={data.totals?.startups || 1} color={PALETTE[i % PALETTE.length]} />)}
          {!(dist.sectors || []).length && <Empty />}
        </Card>
      </div>

      {/* Funding + funnel + risks */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <Card title="Funding by Stage" subtitle="Sought vs received (INR)">
          {(data.funding_by_stage || []).map((f) => {
            const max = Math.max(f.sought, 1);
            return (
              <div key={f.stage} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-body)" }}>{f.stage} <span style={{ color: "var(--text-dim)" }}>({f.count} deals)</span></span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Rcvd {fmtINR(f.received)}</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(f.sought / max) * 100}%`, background: "var(--info)", opacity: 0.35 }} /></div>
                <div className="bar-track" style={{ marginTop: 3 }}><div className="bar-fill" style={{ width: `${(f.received / max) * 100}%`, background: "var(--success)" }} /></div>
              </div>
            );
          })}
          {!(data.funding_by_stage || []).length && <Empty />}
        </Card>

        <Card title="Deal Funnel" subtitle="Pipeline value by sales stage">
          {(data.deal_funnel || []).map((d, i) => (
            <BarRow key={d.stage} label={`${d.stage} (${fmtINR(d.value)})`} count={d.count} total={data.deal_funnel.reduce((s, x) => s + x.count, 0) || 1} color={PALETTE[i % PALETTE.length]} suffix="deals" />
          ))}
          {!(data.deal_funnel || []).length && <Empty />}
        </Card>

        <Card title="Open Risks by Category" subtitle="Counted across the risk register">
          {(data.risk_by_category || []).map((r, i) => (
            <BarRow key={r.category} label={`${r.category}`} count={r.open || 0} total={(data.risk_by_category || []).reduce((s, x) => s + (x.open || 0), 0) || 1} color={r.open > 0 ? "#EF4444" : PALETTE[i % PALETTE.length]} suffix="open" />
          ))}
          {!(data.risk_by_category || []).length && <Empty />}
        </Card>
      </div>

      {/* Trends */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <Card title="Audit Trend" subtitle="Average audit score by month" action={<span className="badge badge-primary"><Activity size={11} /> {aud.length} months</span>}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, overflowX: "auto" }}>
            <TrendLine values={aud.map((a) => a.avg)} color="var(--warning)" fill="rgba(245, 158, 11, 0.12)" width={300} height={90} />
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              {aud.slice(-3).map((a) => <div key={a.month}><strong style={{ color: "var(--text-body)" }}>{a.month}</strong>: avg {a.avg} <span style={{ color: "var(--text-dim)" }}>({a.count} audits)</span></div>)}
            </div>
          </div>
          {aud.length < 2 && <Empty title="Not enough audits" />}
        </Card>

        <Card title="Revenue Trend" subtitle="Portfolio revenue vs expenses by month" action={<span className="badge badge-info"><LineChart size={11} /> {rev.length} months</span>}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, overflowX: "auto" }}>
            <TrendLine values={rev.map((r) => r.revenue)} color="var(--success)" fill="rgba(16, 185, 129, 0.12)" width={300} height={90} />
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              {rev.slice(-3).map((r) => <div key={r.month}><strong style={{ color: "var(--text-body)" }}>{r.month}</strong>: {fmtINR(r.revenue)}</div>)}
            </div>
          </div>
          {rev.length < 2 && <Empty title="Not enough financials" />}
        </Card>
      </div>

      {/* Commercial */}
      <Card title="Commercial KPIs" subtitle="Customer CRM aggregate metrics">
        <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 0 }}>
          <Stat label="Customers" value={fmtNum(data.commercial?.customers)} icon={<Layers size={16} />} tone="info" />
          <Stat label="Customer Revenue" value={fmtINR(data.commercial?.customer_revenue)} icon={<PieChart size={16} />} tone="success" />
          <Stat label="Repeat Customers" value={fmtNum(data.commercial?.repeat_customers)} icon={<Activity size={16} />} tone="primary" />
          <Stat label="Avg NPS" value={data.commercial?.nps_avg ?? "—"} icon={<Percent size={16} />} tone="purple" />
          <Stat label="Open Risks" value={fmtNum(data.commercial?.open_risks)} icon={<Activity size={16} />} tone="danger" />
          <Stat label="Total Funding Received" value={fmtINR(data.commercial?.total_funding_received)} icon={<RefreshCw size={16} />} tone="warning" />
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh analytics"><RefreshCw size={14} /></button>
      </div>
    </div>
  );
}