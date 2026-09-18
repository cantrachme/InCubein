import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { RefreshCw, AlertTriangle, ShieldCheck, Filter } from "lucide-react";
import { getAttention } from "../../lib/crmApi";
import { Card, HealthBadge, Loading, Empty, fmtINR, Tag } from "./CrmUi";

const SEV = {
  critical: { cls: "badge-danger", label: "Critical" },
  high: { cls: "badge-danger", label: "High" },
  medium: { cls: "badge-warning", label: "Medium" },
  low: { cls: "badge-info", label: "Low" },
};
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function AttentionRequired() {
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sev, setSev] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAttention(100);
      setRecords(data.records || []);
      setCount(data.count || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = sev === "all"
    ? records
    : records.filter((r) => (r._triggers || []).some((t) => t.sev === sev));

  // re-sort so the worst severity sits on top
  const sorted = [...filtered].sort((a, b) => {
    const sa = Math.min(...(a._triggers || []).map((t) => SEV_ORDER[t.sev] ?? 3));
    const sb = Math.min(...(b._triggers || []).map((t) => SEV_ORDER[t.sev] ?? 3));
    if (sa !== sb) return sa - sb;
    return (a.health_score ?? -1) - (b.health_score ?? -1);
  });

  const chips = [
    { key: "all", label: `All (${count})` },
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
  ];

  if (loading) return <Loading label="Scanning the portfolio for risks…" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="What needs your attention" subtitle="Every trigger below is derived live from audits, actions, risks, milestones, funding and financial data." bodyStyle={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {chips.map((c) => (
          <button
            key={c.key}
            className={`tab-item ${sev === c.key ? "active" : ""}`}
            onClick={() => setSev(c.key)}
            style={{ padding: "6px 12px", fontSize: "0.78rem" }}
          >
            {c.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto" }}><span className="badge badge-danger"><Filter size={11} /> {sorted.length} shown</span></div>
      </Card>

      {sorted.length === 0 ? (
        <Card><Empty title="All clear" sub="No startups currently need attention. Nice work!" /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {sorted.map((r) => {
            const worst = Math.min(...(r._triggers || []).map((t) => SEV_ORDER[t.sev] ?? 3));
            return (
              <Card
                key={r.id}
                style={{ borderLeft: `3px solid ${worst <= 1 ? "var(--danger)" : worst === 2 ? "var(--warning)" : "var(--info)"}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.95rem" }}>{r.name}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-dim)", marginTop: 2 }}>
                      {r.code} · {r.stage || "—"} · {r.sector || "Sector not set"}
                    </div>
                  </div>
                  <HealthBadge value={r.health_band} />
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {(r._triggers || []).map((tr, i) => (
                    <span key={i} className={`badge ${(SEV[tr.sev] || SEV.low).cls}`} style={{ textTransform: "none", letterSpacing: 0 }}>
                      {tr.label}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {(r.health_score != null) && <Tag color="#8B5CF6">Score {r.health_score}</Tag>}
                  {(r.overdue_actions || 0) > 0 && <Tag color="#EF4444">{r.overdue_actions} overdue</Tag>}
                  {(r.active_deals || 0) > 0 && <Tag color="#3B82F6">{r.active_deals} open deals</Tag>}
                  {r.funding_received > 0 && <Tag color="#00B59C">{fmtINR(r.funding_received)} raised</Tag>}
                  {r.stage === "Revenue" && <Tag color="#F59E0B"><ShieldCheck size={11} /> Revenue stage</Tag>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh attention list"><RefreshCw size={14} /></button>
        <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}><AlertTriangle size={11} style={{ verticalAlign: "middle" }} /> Triggers highlighted at startup-card level.</span>
      </div>
    </div>
  );
}