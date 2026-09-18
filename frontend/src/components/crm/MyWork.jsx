import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { RefreshCw, ClipboardList, Clock, User, ListChecks, FolderOpen, Banknote, ShieldAlert } from "lucide-react";
import { getMyWork } from "../../lib/crmApi";
import { Card, Stat, RagBadge, RiskPill, Loading, Empty, fmtINR } from "./CrmUi";

const OWNER_SUGGESTIONS = ["Incubation Manager", "Manager Innovation", "Technical Assistant", "CEO"];

function MiniTable({ cols, rows, rowKey }) {
  if (!rows || rows.length === 0) return <Empty title="Nothing here" sub="No records assigned to you." />;
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[rowKey] ?? r.id}>
              {cols.map((c) => <td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MyWork() {
  const [owner, setOwner] = useState("Incubation Manager");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (o) => {
    setLoading(true);
    try {
      setData(await getMyWork(o || "Incubation Manager"));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(owner); }, [load, owner]);

  if (loading) return <Loading label="Pulling your work queue…" />;

  const s = data?.stats || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Owner selector */}
      <Card bodyStyle={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <User size={16} color="var(--primary)" />
        <div style={{ minWidth: 260, flex: 1, maxWidth: 420 }}>
          <input
            list="crm-owners"
            className="form-input"
            style={{ height: 36, fontSize: "0.85rem" }}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Type an owner name…"
          />
          <datalist id="crm-owners">
            {OWNER_SUGGESTIONS.map((o) => <option key={o} value={o} />)}
          </datalist>
        </div>
        <span className="badge badge-primary"><ClipboardList size={11} /> Queued for {owner || "Incubation Manager"}</span>
        <button className="btn btn-secondary btn-icon" onClick={() => load(owner)} title="Refresh"><RefreshCw size={14} /></button>
      </Card>

      {/* Stats */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", marginBottom: 0 }}>
        <Stat label="My Actions" value={s.my_actions ?? 0} icon={<ClipboardList size={16} />} tone="info" />
        <Stat label="Overdue" value={s.overdue ?? 0} icon={<Clock size={16} />} tone="danger" />
        <Stat label="Due This Week" value={s.due_this_week ?? 0} icon={<Clock size={16} />} tone="warning" />
        <Stat label="My Milestones" value={s.my_milestones ?? 0} icon={<FolderOpen size={16} />} tone="primary" />
        <Stat label="Upcoming Milestones" value={s.upcoming_milestones ?? 0} icon={<ListChecks size={16} />} tone="purple" />
        <Stat label="My Risks" value={s.my_risks ?? 0} icon={<ShieldAlert size={16} />} tone="warning" />
        <Stat label="Open Risks" value={s.open_risks ?? 0} icon={<ShieldAlert size={16} />} tone="danger" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card title="Overdue Actions" subtitle="Past deadline and not completed" action={<span className="badge badge-danger">{data?.overdue_actions?.length || 0}</span>}>
          <MiniTable
            rowKey="id"
            cols={[
              { key: "action", label: "Action", render: (r) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.action}</span> },
              { key: "startup_name", label: "Startup" },
              { key: "deadline", label: "Deadline", render: (r) => <span style={{ color: "var(--danger)", fontWeight: 700 }}>{(r.deadline || "").slice(0, 10)}</span> },
              { key: "rag", label: "RAG", render: (r) => <RagBadge value={r.rag} /> },
            ]}
            rows={data?.overdue_actions || []}
          />
        </Card>

        <Card title="Due This Week" subtitle="Deadlines between today and +7 days" action={<span className="badge badge-warning">{data?.due_this_week_actions?.length || 0}</span>}>
          <MiniTable
            rowKey="id"
            cols={[
              { key: "action", label: "Action", render: (r) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.action}</span> },
              { key: "startup_name", label: "Startup" },
              { key: "deadline", label: "Deadline", render: (r) => <span style={{ color: "var(--warning)", fontWeight: 700 }}>{(r.deadline || "").slice(0, 10)}</span> },
              { key: "priority", label: "Priority" },
            ]}
            rows={data?.due_this_week_actions || []}
          />
        </Card>
      </div>

      <Card title="My 90-Day Actions" subtitle="Everything assigned to you across the portfolio">
        <MiniTable
          rowKey="id"
          cols={[
            { key: "action", label: "Action", render: (r) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.action}</span> },
            { key: "startup_name", label: "Startup" },
            { key: "priority", label: "Priority" },
            { key: "deadline", label: "Deadline", render: (r) => <span>{(r.deadline || "").slice(0, 10) || "—"}</span> },
            { key: "rag", label: "RAG", render: (r) => <RagBadge value={r.rag} /> },
            { key: "status", label: "Status" },
          ]}
          rows={data?.actions || []}
        />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card title="My Milestones" subtitle="Milestones where you are the owner">
          <MiniTable
            rowKey="id"
            cols={[
              { key: "milestone", label: "Milestone", render: (r) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.milestone}</span> },
              { key: "startup_name", label: "Startup" },
              { key: "target_date", label: "Target", render: (r) => <span>{(r.target_date || "").slice(0, 10) || "—"}</span> },
              { key: "status", label: "Status" },
            ]}
            rows={data?.milestones || []}
          />
        </Card>

        <Card title="My Risks" subtitle="Risk register items you own">
          <MiniTable
            rowKey="id"
            cols={[
              { key: "risk", label: "Risk", render: (r) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.risk}</span> },
              { key: "startup_name", label: "Startup" },
              { key: "category", label: "Category" },
              { key: "risk_level", label: "Level", render: (r) => <RiskPill value={r.risk_level} /> },
              { key: "status", label: "Status" },
            ]}
            rows={data?.open_risks || []}
          />
        </Card>
      </div>

      <Card title="My Funding Applications" subtitle="Funding records where you are the owner">
        <MiniTable
          rowKey="id"
          cols={[
            { key: "scheme", label: "Scheme", render: (r) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.scheme}</span> },
            { key: "startup_name", label: "Startup" },
            { key: "stage", label: "Stage" },
            { key: "amount_sought", label: "Sought", render: (r) => fmtINR(r.amount_sought) },
            { key: "amount_received", label: "Received", render: (r) => fmtINR(r.amount_received) },
            { key: "status", label: "Status" },
          ]}
          rows={data?.funding || []}
        />
      </Card>

      <Card title="Recent Activity" subtitle="Latest changes across milestones, actions, risks and funding" action={<span className="badge badge-neutral"><Banknote size={11} /> {data?.recent_activity?.length || 0} events</span>}>
        {(data?.recent_activity || []).map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border-color)", fontSize: "0.8rem" }}>
            <span className="badge badge-primary" style={{ textTransform: "none" }}>{a.module}</span>
            <span style={{ color: "var(--text-body)", flex: 1 }}>{a.summary || `${a.action} #${a.record_id}`}</span>
            <span style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>{(a.created_at || "").replace("T", " ").slice(0, 16)}</span>
          </div>
        ))}
        {(data?.recent_activity || []).length === 0 && <Empty title="No recent activity" />}
      </Card>
    </div>
  );
}