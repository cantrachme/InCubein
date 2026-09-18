import React, { useState } from "react";
import { toast } from "react-toastify";
import { RefreshCw } from "lucide-react";
import { syncData } from "../../lib/crmApi";

export const fmtINR = (v) => {
  const n = Number(v || 0);
  if (n === 0) return "₹0";
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

export const fmtNum = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN");
};

export const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`;

export const HEALTH_BADGE = {
  GREEN: { cls: "badge-success", label: "GREEN" },
  GROWTH: { cls: "badge-info", label: "GROWTH" },
  AMBER: { cls: "badge-warning", label: "AMBER" },
  INTERVENTION: { cls: "badge-purple", label: "INTERVENTION" },
  CRITICAL: { cls: "badge-danger", label: "CRITICAL" },
};

export const RAG_BADGE = {
  GREEN: { cls: "badge-success", label: "ON TRACK" },
  AMBER: { cls: "badge-warning", label: "AT RISK" },
  RED: { cls: "badge-danger", label: "OVERDUE" },
};

export const RISK_BADGE = {
  Critical: { cls: "badge-danger", label: "Critical" },
  High: { cls: "badge-warning", label: "High" },
  Medium: { cls: "badge-info", label: "Medium" },
  Low: { cls: "badge-success", label: "Low" },
};

export const STAGE_STYLE = {
  Ideation: { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  Prototype: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  "MVP/Pre-Revenue": { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA" },
  Revenue: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  "Growth/Scaling": { bg: "#FDF4FF", text: "#86198F", border: "#F0ABFC" },
  "Seed Stage": { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
};

export function Card({ title, subtitle, action, children, style, bodyStyle }) {
  return (
    <div className="glass-card" style={{ display: "flex", flexDirection: "column", ...style }}>
      {(title || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: title ? 16 : 0 }}>
          <div>
            {title && <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "4px 0 0" }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div style={{ minWidth: 0, ...bodyStyle }}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone, center }) {
  const colorMap = {
    primary: "var(--primary)",
    info: "var(--info)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    success: "var(--success)",
    accent: "var(--accent)",
    purple: "#8B5CF6",
    muted: "var(--text-dim)",
  };
  const c = colorMap[tone] || "var(--primary)";
  return (
    <div className="metric-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div className="metric-header">
        <span className="metric-title">{label}</span>
        {icon && (
          <span className="metric-icon" style={{ background: `color-mix(in srgb, ${c} 10%, white)`, color: c }}>
            {icon}
          </span>
        )}
      </div>
      <div style={{ ...(center ? { textAlign: "center" } : {}) }}>
        <div className="metric-value" style={{ fontSize: "1.9rem" }}>{value}</div>
        {sub && <div className="metric-footer">{sub}</div>}
      </div>
    </div>
  );
}

export function HealthBadge({ value }) {
  const key = value || "Not Audited";
  const cfg = HEALTH_BADGE[key];
  const cls = cfg ? cfg.cls : "badge-neutral";
  return <span className={`badge ${cls}`}>{cfg ? cfg.label : "NOT AUDITED"}</span>;
}

export function RagBadge({ value }) {
  const cfg = RAG_BADGE[value];
  return <span className={`badge ${cfg ? cfg.cls : "badge-neutral"}`}>{cfg ? cfg.label : String(value || "—")}</span>;
}

export function RiskPill({ value }) {
  const cfg = RISK_BADGE[value];
  return <span className={`badge ${cfg ? cfg.cls : "badge-neutral"}`}>{value || "—"}</span>;
}

export function StagePill({ value }) {
  const st = STAGE_STYLE[value];
  if (!st || !value) return <span className="badge badge-neutral">{value || "—"}</span>;
  return (
    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 9px", borderRadius: "10px", background: st.bg, color: st.text, border: `1px solid ${st.border}` }}>
      {value}
    </span>
  );
}

export function Pill({ value, tone }) {
  const map = {
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    info: "badge-info",
    primary: "badge-primary",
    purple: "badge-purple",
    neutral: "badge-neutral",
  };
  const cls = map[tone] || "badge-neutral";
  return <span className={`badge ${cls}`}>{value ?? "—"}</span>;
}

export function BarRow({ label, count, total, color = "var(--primary)", suffix }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <span className="bar-label" title={label} style={{ width: 120, minWidth: 120 }}>{label}</span>
      <div className="bar-track" style={{ flex: 1 }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="bar-value" style={{ width: 46, textAlign: "right" }}>{suffix ? `${count} ${suffix}` : count}</span>
      <span style={{ width: 38, textAlign: "right", fontSize: "0.76rem", color: "var(--text-dim)", fontWeight: 700 }}>{pct}%</span>
    </div>
  );
}

export function Donut({ data, size = 150, thickness = 22, colors, valueKey = "count", labelKey = "key", showLegend = true }) {
  const items = (data || []).filter((d) => (d[valueKey] || 0) > 0);
  const total = items.reduce((s, d) => s + d[valueKey], 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, justifyContent: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-surface)" strokeWidth={thickness} />
          {total > 0 && items.map((d, i) => {
            const frac = d[valueKey] / total;
            const dash = `${frac * c} ${c}`;
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={colors ? colors[i % colors.length] : "var(--primary)"}
              strokeWidth={thickness} strokeDasharray={dash} strokeDashoffset={-acc * c}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.8s var(--ease-out)" }} />;
            acc += frac;
            return el;
          })}
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{total}</span>
          <span style={{ fontSize: "0.66rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total</span>
        </div>
      </div>
      {showLegend && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(data || []).map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", color: "var(--text-muted)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: colors ? colors[i % colors.length] : "var(--primary)" }} />
              <span style={{ color: "var(--text-body)", fontWeight: 600 }}>{d[labelKey]}{labelKey === "key" ? ` (${d[valueKey] || 0})` : ` — ${d[valueKey] || 0}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrendLine({ values, width = 260, height = 60, color = "var(--primary)", fill = "var(--primary-light)" }) {
  const nums = (values || []).map(Number);
  if (nums.length < 2) {
    return <div style={{ height, display: "flex", alignItems: "center", fontSize: "0.8rem", color: "var(--text-dim)" }}>Not enough data points</div>;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const pts = nums.map((v, i) => `${(i / (nums.length - 1)) * width},${height - ((v - min) / range) * (height - 8) - 4}`);
  const line = pts.join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", maxWidth: "100%" }}>
      <polyline points={`0,${height} ${line} ${width},${height}`} fill={fill} stroke="none" />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Modal({ open, onClose, title, children, width = 640 }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: width, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{title}</h3>
          <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "20px 0" }}>
      {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton-card" />)}
      <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-dim)" }}>{label}</div>
    </div>
  );
}

export async function fetchJson(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body && body.detail ? ` — ${body.detail}` : "";
      } catch { /* non-JSON error body */ }
      throw new Error(`Server responded ${res.status}${detail}`);
    }
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s — is the backend running?`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function DataError({ message, onRetry }) {
  return (
    <div className="empty-state" style={{ maxWidth: 520, margin: "16px auto" }}>
      <h3 style={{ color: "var(--danger)" }}>Couldn't load data</h3>
      <p style={{ fontSize: "0.82rem" }}>{message}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title = "No records found", sub = "There is nothing to display here yet." }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{sub}</p>
    </div>
  );
}

export function Tag({ children, color = "var(--primary)" }) {
  return (
    <span className="tag-pill" style={{ border: `1px solid ${color}1A`, color, background: `${color}0F`, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export function Cell({ rec, col }) {
  const raw = rec[col.key];
  if (col.kind === "health") return <HealthBadge value={raw} />;
  if (col.kind === "rag") return <RagBadge value={raw} />;
  if (col.kind === "risk") return <RiskPill value={raw} />;
  if (col.kind === "stage") return <StagePill value={raw} />;
  if (col.kind === "money") return <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmtINR(raw)}</span>;
  if (col.kind === "number") return <span style={{ fontWeight: 600 }}>{fmtNum(raw)}</span>;
  if (col.kind === "score") {
    return <span className={`badge ${Number(raw) >= 80 ? "badge-success" : Number(raw) >= 50 ? "badge-warning" : "badge-danger"}`}>{raw ?? "—"}</span>;
  }
  if (col.kind === "date") return <span style={{ whiteSpace: "nowrap" }}>{raw ? String(raw).slice(0, 10) : "—"}</span>;
  if (col.kind === "pill") return <Pill value={raw || "—"} tone={col.tone} />;
  const style = col.main ? { fontWeight: 700, color: "var(--text-primary)" } : undefined;
  return <span style={style}>{raw || "—"}</span>;
}

export function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = [10, 15, 25, 50, 100] }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  if (total === 0) return null;
  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing <strong>{start}</strong> – <strong>{end}</strong> of <strong>{total}</strong> records
      </div>
      <div className="pagination-controls">
        <button className="pagination-btn" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>&laquo; Prev</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .map((p, i, arr) => {
            const prevP = arr[i - 1];
            return (
              <React.Fragment key={p}>
                {prevP && p - prevP > 1 && <span style={{ color: "var(--text-dim)", padding: "0 4px" }}>…</span>}
                <button className={`pagination-btn ${page === p ? "active" : ""}`} onClick={() => onPage(p)}>{p}</button>
              </React.Fragment>
            );
          })}
        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}>Next &raquo;</button>
      </div>
      <div className="pagination-size-select">
        {onPageSize && (
          <>
            <span>Per page:</span>
            <select value={pageSize} onChange={(e) => { onPageSize(Number(e.target.value)); onPage(1); }}>
              {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </>
        )}
      </div>
    </div>
  );
}

export function StatusPill({ value, map }) {
  const cfg = (map || {})[value];
  return <Pill value={value || "—"} tone={cfg ? cfg.tone : undefined} />;
}

export function useListPagination(total = 0, defaultSize = 15) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultSize);
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const start = (safePage - 1) * pageSize;
  const slice = (items) => (items || []).slice(start, start + pageSize);
  React.useEffect(() => { setPage(1); }, [total, pageSize]);
  return { page: safePage, pageSize, setPage, setPageSize, start, slice };
}

export function SyncButton({ compact = false }) {
  const [busy, setBusy] = useState(false);
  const onSync = async () => {
    if (busy) return;
    setBusy(true);
    toast.info("Syncing with your latest uploads…");
    try {
      const r = await syncData();
      const imp = r.imported || {};
      const coll = r.collections || {};
      const msg = r.message
        ? `${r.message}${coll.startups !== undefined ? `  (MongoDB: ${coll.startups} startups, ${coll.incubein_applications} applications)` : ""}`
        : `Synced ${imp.startups || 0} startups, ${imp.founders || 0} founders, ${imp.students || 0} students, ${imp.colleges || 0} colleges`;
      toast.success(msg);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="btn btn-secondary" onClick={onSync} disabled={busy} title="Refresh the CRM from your directory, cohort evaluation & other uploads">
      <RefreshCw size={14} className={busy ? "spin" : ""} /> {!compact && <span>&nbsp;Sync from uploads</span>}
    </button>
  );
}