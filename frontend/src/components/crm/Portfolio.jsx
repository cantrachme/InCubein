import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { RefreshCw, Rocket, Wallet, TrendingUp, Target, Users, AlertTriangle } from "lucide-react";
import { getPortfolio } from "../../lib/crmApi";
import { Card, Stat, HealthBadge, StagePill, Loading, Empty, SyncButton, fmtINR, fmtNum } from "./CrmUi";

export default function Portfolio() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getPortfolio());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Loading the portfolio…" />;
  if (!data) return <Empty title="No portfolio data" />;

  const t = data.totals || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 0 }}>
        <Stat label="Portfolio Companies" value={fmtNum(t.startups)} icon={<Rocket size={16} />} tone="primary" />
        <Stat label="External Funding Raised" value={fmtINR(t.funding_received)} icon={<Wallet size={16} />} tone="success" />
        <Stat label="Open Pipeline Value" value={fmtINR(t.pipeline_value)} icon={<Target size={16} />} tone="info" />
        <Stat label="Monthly Portfolio Revenue" value={fmtINR(t.monthly_revenue)} icon={<TrendingUp size={16} />} tone="warning" />
      </div>

      {(data.stage_buckets || []).map((bucket) => (
        <Card
          key={bucket.stage}
          title={`${bucket.stage} Stage`}
          subtitle={`${bucket.count} startup${bucket.count !== 1 ? "s" : ""} in this bucket`}
          action={<StagePill value={bucket.stage} />}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {bucket.records.map((s) => (
              <div key={s.id} className="directory-card" style={{ padding: 16, margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.92rem" }}>{s.name}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>{s.code}{s.city ? ` · ${s.city}` : ""}</div>
                  </div>
                  <HealthBadge value={s.health_band} />
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {s.sector && <span className="badge badge-info">{s.sector}</span>}
                  {s.status && <span className="badge badge-neutral">{s.status}</span>}
                </div>

                <div className="card-stats" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 12 }}>
                  <div>
                    <div className="card-stat-label">Health Score</div>
                    <div className="card-stat-val">{s.health_score ?? "—"}</div>
                  </div>
                  <div>
                    <div className="card-stat-label">Funding</div>
                    <div className="card-stat-val">{fmtINR(s.funding_received)}</div>
                  </div>
                  <div>
                    <div className="card-stat-label">Revenue (latest)</div>
                    <div className="card-stat-val">{fmtINR(s.latest_revenue)}</div>
                  </div>
                  <div>
                    <div className="card-stat-label">Pipeline</div>
                    <div className="card-stat-val">{fmtINR(s.pipeline_value)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="badge badge-neutral" style={{ textTransform: "none" }}><Users size={11} /> {s.founders_count || 0} founders</span>
                  <span className="badge badge-neutral" style={{ textTransform: "none" }}><Target size={11} /> {s.active_deals || 0} deals</span>
                  <span className="badge badge-neutral" style={{ textTransform: "none" }}><AlertTriangle size={11} /> {s.overdue_actions || 0} overdue</span>
                  <span className="badge badge-neutral" style={{ textTransform: "none" }}> {s.customer_count || 0} customers</span>
                </div>
              </div>
            ))}
          </div>
          {bucket.records.length === 0 && <Empty title="No startups in this stage" />}
        </Card>
      ))}

      {(data.stage_buckets || []).length === 0 && (
        <Card><Empty title="Portfolio is empty" sub="Startups will appear here once created in the CRM." /></Card>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
        <SyncButton />
        <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh portfolio"><RefreshCw size={14} /></button>
      </div>
    </div>
  );
}