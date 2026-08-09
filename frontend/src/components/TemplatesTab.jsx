import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Copy,
} from "lucide-react";

const CATEGORIES = ["startups", "incubators", "followup", "general"];

const EMPTY_FORM = {
  key: "",
  name: "",
  category: "startups",
  subject: "",
  body: "",
  cc: "",
  is_default: false,
};

const PLACEHOLDERS = [
  "{StartupName}", "{IncubatorName}", "{EntityName}",
  "{OrgName}", "{OrgFullName}", "{OrgEmail}", "{OrgWebsite}", "{OrgAddress}",
  "{Date}", "{Time}", "{MeetingLink}", "{FollowupNumber}",
];

const style = {
  label: { fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" },
  cell: { padding: "0.65rem 0.75rem", borderBottom: "1px solid var(--border-color)", verticalAlign: "top" },
  headerCell: { padding: "0.65rem 0.75rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" },
};

export default function TemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // template key being edited, or "new"
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const qs = category ? `?category=${category}` : "";
      const res = await fetch(`/api/templates${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setTemplates(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [category]);

  const startNew = () => {
    setEditing("new");
    setForm({ ...EMPTY_FORM, category: category || "startups" });
  };

  const startEdit = (tpl) => {
    setEditing(tpl.key);
    setForm({
      key: tpl.key,
      name: tpl.name || "",
      category: tpl.category || "general",
      subject: tpl.subject || "",
      body: tpl.body || "",
      cc: tpl.cc || "",
      is_default: !!tpl.is_default,
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const saveTemplate = async () => {
    if (!form.name || (!form.subject && !form.body)) {
      toast.warning("Name and at least subject/body are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/templates${editing === "new" ? "" : `/${editing}`}`, {
        method: editing === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.status !== "error") {
        toast.success(editing === "new" ? "Template created." : "Template updated.");
        setEditing(null);
        setForm(EMPTY_FORM);
        fetchTemplates();
      } else {
        toast.error(data.message || data.detail || "Failed to save template.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to backend.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (tpl) => {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      const res = await fetch(`/api/templates/${tpl.key}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.deleted) {
        toast.success("Template deleted.");
        fetchTemplates();
      } else {
        toast.error(data.message || "Failed to delete template.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to backend.");
    }
  };

  const insertPlaceholder = (p) => {
    setForm(prev => ({ ...prev, body: (prev.body || "") + p }));
  };

  const togglePreview = (tpl) => {
    setPreview(preview && preview.key === tpl.key ? null : tpl);
  };

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
              <FileText size={18} style={{ color: "var(--primary)" }} /> Email Templates
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Create and manage invite, follow-up and notification emails used across outreach.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <select
              className="form-input"
              style={{ width: "160px" }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary" onClick={startNew}>
              <Plus size={14} style={{ marginRight: "6px" }} /> New Template
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="glass-card" style={{ padding: "1.5rem", border: "1px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
              {editing === "new" ? "Create Template" : `Editing: ${form.name}`}
            </h4>
            <button className="btn btn-ghost btn-icon" onClick={cancelEdit}><X size={15} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={style.label}>Key (slug, auto-generated if blank)</label>
              <input className="form-input" style={{ marginTop: "4px" }} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e.g. my_campaign_mail" />
            </div>
            <div>
              <label style={style.label}>Name</label>
              <input className="form-input" style={{ marginTop: "4px" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={style.label}>Category</label>
              <select className="form-input" style={{ marginTop: "4px" }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={style.label}>CC (comma separated, optional)</label>
              <input className="form-input" style={{ marginTop: "4px" }} value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "end" }}>
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
              <label style={style.label}>Set as default for category</label>
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={style.label}>Subject</label>
            <input className="form-input" style={{ marginTop: "4px" }} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Introduction to {OrgName}" />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={style.label}>Body</label>
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                {PLACEHOLDERS.map(p => (
                  <button key={p} className="btn btn-outline" style={{ padding: "2px 8px", fontSize: "0.7rem" }} onClick={() => insertPlaceholder(p)}>
                    <Copy size={10} style={{ marginRight: "3px" }} />{p}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="form-input"
              rows={12}
              style={{ marginTop: "4px", fontFamily: "monospace", fontSize: "0.8rem" }}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" onClick={saveTemplate} disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" style={{ marginRight: "6px" }} /> : <Save size={14} style={{ marginRight: "6px" }} />}
            Save Template
          </button>
        </div>
      )}

      <div className="glass-card" style={{ padding: "0 1.5rem 1.5rem" }}>
        <div className="table-wrapper" style={{ margin: "0 -1.5rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                <th style={style.headerCell}>Name</th>
                <th style={style.headerCell}>Key</th>
                <th style={style.headerCell}>Category</th>
                <th style={style.headerCell}>Subject</th>
                <th style={style.headerCell}>Default</th>
                <th style={style.headerCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(tpl => (
                <tr key={tpl.key} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={style.cell}><strong style={{ fontSize: "0.85rem" }}>{tpl.name}</strong></td>
                  <td style={style.cell}><code style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{tpl.key}</code></td>
                  <td style={style.cell}><span className={`badge ${tpl.category === "startups" ? "badge-primary" : tpl.category === "incubators" ? "badge-info" : tpl.category === "followup" ? "badge-purple" : "badge-neutral"}`}>{tpl.category}</span></td>
                  <td style={{ ...style.cell, maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8rem" }}>{tpl.subject}</td>
                  <td style={style.cell}>{tpl.is_default ? <span className="badge badge-success">Default</span> : <span className="badge badge-neutral">—</span>}</td>
                  <td style={style.cell}>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button className="btn btn-ghost btn-icon" title="Preview" onClick={() => togglePreview(tpl)}>
                        {preview && preview.key === tpl.key ? <X size={14} /> : <Copy size={14} />}
                      </button>
                      <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => startEdit(tpl)}><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-icon" title="Delete" style={{ color: "var(--danger)" }} onClick={() => deleteTemplate(tpl)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={6} style={{ ...style.cell, textAlign: "center", color: "var(--text-dim)", fontSize: "0.85rem", padding: "2rem" }}>No templates found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {preview && (
          <div style={{ marginTop: "1rem", background: "var(--bg-surface)", borderRadius: "8px", padding: "1rem", border: "1px solid var(--border-color)" }}>
            <strong style={{ fontSize: "0.85rem" }}>Subject:</strong> <span style={{ fontSize: "0.8rem" }}>{preview.subject}</span>
            <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "0.75rem 0" }} />
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.8rem", lineHeight: "1.6", color: "var(--text-body)" }}>{preview.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
