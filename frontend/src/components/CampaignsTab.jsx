import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Send,
  Loader2,
  ListChecks,
} from "lucide-react";

const TARGET_OPTIONS = [
  ["all_startups", "All draft startups"],
  ["all_incubators", "All draft incubators"],
  ["lead:", "Single lead (lead:<lead_id>) — prefix 'lead:' with the lead id"],
  ["custom:", "Custom recipient (custom:<email>)"],
];

const STATUS_META = {
  draft: { label: "Draft", cls: "badge-neutral" },
  sending: { label: "Sending…", cls: "badge-warning" },
  completed: { label: "Completed", cls: "badge-success" },
  paused: { label: "Paused", cls: "badge-info" },
};

const EMPTY = {
  name: "",
  target_type: "all_startups",
  template_id: "",
  subject: "",
  body: "",
  cc: "",
  bcc: "",
  batch_size: 8,
  delay_seconds: 15,
};

const style = {
  label: { fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" },
  cell: { padding: "0.65rem 0.75rem", borderBottom: "1px solid var(--border-color)", verticalAlign: "middle" },
  headerCell: { padding: "0.65rem 0.75rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" },
};

export default function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // campaign_id or "new"
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [logsFor, setLogsFor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showLogsLoading, setShowLogsLoading] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const [campRes, tplRes] = await Promise.all([
        fetch("/api/campaigns", { cache: "no-store" }),
        fetch("/api/templates", { cache: "no-store" }),
      ]);
      const camps = await campRes.json();
      const tpls = await tplRes.json();
      if (Array.isArray(camps)) setCampaigns(camps);
      if (Array.isArray(tpls)) setTemplates(tpls);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const startNew = () => {
    setEditing("new");
    setForm(EMPTY);
  };

  const startEdit = (camp) => {
    setEditing(camp.campaign_id || camp.id);
    setForm({
      name: camp.name || "",
      target_type: camp.target_type || "all_startups",
      template_id: camp.template_id || "",
      subject: camp.subject || "",
      body: camp.body || "",
      cc: camp.cc || "",
      bcc: camp.bcc || "",
      batch_size: camp.batch_size || 8,
      delay_seconds: camp.delay_seconds || 15,
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const saveCampaign = async () => {
    if (!form.name) {
      toast.warning("Campaign name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns${editing === "new" ? "" : `/${editing}`}`, {
        method: editing === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.status !== "error") {
        toast.success(editing === "new" ? "Campaign created." : "Campaign updated.");
        setEditing(null);
        setForm(EMPTY);
        fetchCampaigns();
      } else {
        toast.error(data.message || data.detail || "Failed to save campaign.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to backend.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (camp) => {
    if (!window.confirm(`Delete campaign "${camp.name}"?`)) return;
    try {
      const res = await fetch(`/api/campaigns/${camp.campaign_id || camp.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.deleted) {
        toast.success("Campaign deleted.");
        fetchCampaigns();
      } else {
        toast.error(data.message || "Failed to delete campaign.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to backend.");
    }
  };

  const sendCampaign = async (camp) => {
    if (!window.confirm(`Send campaign "${camp.name}" now to its recipients?`)) return;
    setSendingId(camp.campaign_id || camp.id);
    try {
      const res = await fetch(`/api/campaigns/${camp.campaign_id || camp.id}/send`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Campaign dispatched.");
      } else {
        toast.error(data.detail || data.message || "Failed to dispatch campaign.");
      }
      fetchCampaigns();
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to backend.");
    } finally {
      setSendingId(null);
    }
  };

  const loadLogs = async (camp) => {
    const cid = camp.campaign_id || camp.id;
    setLogsFor(cid);
    setShowLogsLoading(true);
    try {
      const res = await fetch(`/api/email-logs?campaign_id=${cid}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
      else setLogs([]);
    } catch (e) {
      console.error(e);
      setLogs([]);
    } finally {
      setShowLogsLoading(false);
    }
  };

  const selectedTemplate = templates.find(t => t.key === form.template_id);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <Loader2 size={22} className="spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="glass-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Megaphone size={18} style={{ color: "var(--primary)" }} /> Email Campaigns
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Build reusable campaigns, choose a template, and dispatch to startup/incubator leads.
            </p>
          </div>
          <button className="btn btn-primary" onClick={startNew}>
            <Plus size={14} style={{ marginRight: "6px" }} /> New Campaign
          </button>
        </div>
      </div>

      {editing && (
        <div className="glass-card" style={{ padding: "1.5rem", border: "1px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>{editing === "new" ? "Create Campaign" : `Editing: ${form.name}`}</h4>
            <button className="btn btn-ghost btn-icon" onClick={cancelEdit}><X size={15} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={style.label}>Campaign name</label>
              <input className="form-input" style={{ marginTop: "4px" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={style.label}>Target</label>
              <select className="form-input" style={{ marginTop: "4px" }} value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value })}>
                {TARGET_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label style={style.label}>Template</label>
              <select className="form-input" style={{ marginTop: "4px" }} value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
                <option value="">— No template (type manually) —</option>
                {templates.map(t => <option key={t.key} value={t.key}>{t.name} ({t.category})</option>)}
              </select>
            </div>
            <div>
              <label style={style.label}>CC (optional)</label>
              <input className="form-input" style={{ marginTop: "4px" }} value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} />
            </div>
            <div>
              <label style={style.label}>BCC (optional)</label>
              <input className="form-input" style={{ marginTop: "4px" }} value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} />
            </div>
            <div>
              <label style={style.label}>Batch size</label>
              <input className="form-input" style={{ marginTop: "4px" }} type="number" min="1" value={form.batch_size} onChange={(e) => setForm({ ...form, batch_size: Number(e.target.value) })} />
            </div>
            <div>
              <label style={style.label}>Delay between batches (sec)</label>
              <input className="form-input" style={{ marginTop: "4px" }} type="number" min="0" value={form.delay_seconds} onChange={(e) => setForm({ ...form, delay_seconds: Number(e.target.value) })} />
            </div>
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={style.label}>Subject (overrides template if provided)</label>
            <input className="form-input" style={{ marginTop: "4px" }} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={selectedTemplate ? selectedTemplate.subject : "Type a subject or leave blank to use template"} />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={style.label}>Body (overrides template if provided)</label>
            <textarea className="form-input" rows={8} style={{ marginTop: "4px", fontFamily: "monospace", fontSize: "0.8rem" }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={selectedTemplate ? "Leave blank to use the selected template body." : "Type the email body…"} />
          </div>
          <button className="btn btn-primary" onClick={saveCampaign} disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" style={{ marginRight: "6px" }} /> : <Save size={14} style={{ marginRight: "6px" }} />}
            Save Campaign
          </button>
        </div>
      )}

      <div className="glass-card" style={{ padding: "0 1.5rem 1.5rem" }}>
        <div className="table-wrapper" style={{ margin: "0 -1.5rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                <th style={style.headerCell}>Name</th>
                <th style={style.headerCell}>Target</th>
                <th style={style.headerCell}>Template</th>
                <th style={style.headerCell}>Batch</th>
                <th style={style.headerCell}>Status</th>
                <th style={style.headerCell}>Created</th>
                <th style={style.headerCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(camp => {
                const statusMeta = STATUS_META[camp.status] || STATUS_META.draft;
                const campId = camp.campaign_id || camp.id;
                return (
                  <tr key={campId} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={style.cell}><strong style={{ fontSize: "0.85rem" }}>{camp.name}</strong></td>
                    <td style={style.cell}><span className="badge badge-neutral" style={{ fontSize: "0.7rem" }}>{camp.target_type}</span></td>
                    <td style={style.cell}><code style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{camp.template_id || "—"}</code></td>
                    <td style={style.cell}><span style={{ fontSize: "0.8rem" }}>{camp.batch_size} / {camp.delay_seconds}s</span></td>
                    <td style={style.cell}><span className={`badge ${statusMeta.cls}`}>{statusMeta.label}</span></td>
                    <td style={style.cell}><span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{(camp.created_at || "").replace("T", " ").slice(0, 16)}</span></td>
                    <td style={style.cell}>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button className="btn btn-primary btn-icon" title="Send now" disabled={camp.status === "sending" || sendingId === campId} onClick={() => sendCampaign(camp)}>
                          {sendingId === campId ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                        </button>
                        <button className="btn btn-ghost btn-icon" title="Send log" onClick={() => loadLogs(camp)}><ListChecks size={14} /></button>
                        <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => startEdit(camp)}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-icon" title="Delete" style={{ color: "var(--danger)" }} onClick={() => deleteCampaign(camp)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {campaigns.length === 0 && (
                <tr><td colSpan={7} style={{ ...style.cell, textAlign: "center", color: "var(--text-dim)", fontSize: "0.85rem", padding: "2rem" }}>No campaigns yet. Create one to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {logsFor && (
          <div style={{ marginTop: "1rem", background: "var(--bg-surface)", borderRadius: "8px", padding: "1rem", border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <strong style={{ fontSize: "0.85rem" }}>Dispatch Log</strong>
              <button className="btn btn-ghost btn-icon" onClick={() => setLogsFor(null)}><X size={14} /></button>
            </div>
            {showLogsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "1rem" }}><Loader2 size={16} className="spin" /></div>
            ) : logs.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>No emails logged for this campaign yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ ...style.cell, fontSize: "0.75rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{log.timestamp}</td>
                      <td style={{ ...style.cell, fontSize: "0.8rem" }}>{log.recipient_name} ({log.recipient_email})</td>
                      <td style={{ ...style.cell, fontSize: "0.78rem", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.subject}</td>
                      <td style={{ ...style.cell }}><span className={`badge ${log.status === "sent" ? "badge-success" : "badge-warning"}`}>{log.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
