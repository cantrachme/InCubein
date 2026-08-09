import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Settings2,
  Building2,
  Timer,
  Bot,
  Save,
  RotateCcw,
  Mail,
  Loader2,
} from "lucide-react";

const FIELD_SECTIONS = [
  {
    key: "organization",
    title: "Organization & Branding",
    icon: Building2,
    description: "Brand details used across every email template signature.",
    fields: [
      ["org_name", "Organization short name", "text"],
      ["org_full_name", "Organization full name", "text"],
      ["org_email", "Public email address", "text"],
      ["org_website", "Website", "text"],
      ["org_address", "Address / location", "text"],
      ["signature_text", "Extra signature line (optional)", "text"],
    ],
  },
  {
    key: "batching",
    title: "Batching & Rate Limits",
    icon: Timer,
    description: "How many emails/scrapes are sent per batch and the delay between batches.",
    fields: [
      ["scrape_batch_size", "Scrape batch size (per cycle)", "number"],
      ["scrape_batch_delay_seconds", "Scrape batch delay (seconds)", "number"],
      ["email_batch_size", "Email batch size (per cycle)", "number"],
      ["email_batch_delay_seconds", "Email batch delay (seconds)", "number"],
    ],
  },
  {
    key: "automation",
    title: "Automation & Scheduler",
    icon: Bot,
    description: "Background scanning interval and follow-up dispatch settings.",
    fields: [
      ["sync_interval", "Background scan interval (seconds)", "number"],
      ["followup_delay", "Follow-up delay after last contact (seconds)", "number"],
    ],
  },
];

const style = {
  card: { padding: "1.5rem" },
  label: { fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" },
  input: { width: "100%" },
  sectionHeader: { display: "flex", alignItems: "center", gap: "0.6rem" },
  sectionIcon: {
    width: "34px", height: "34px", borderRadius: "10px",
    background: "var(--primary-light)", color: "var(--primary)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  toggle: {
    width: "44px", height: "24px", borderRadius: "999px", border: "none",
    cursor: "pointer", position: "relative", transition: "background 0.25s ease",
  },
  toggleKnob: {
    position: "absolute", top: "3px", width: "18px", height: "18px",
    borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    transition: "left 0.25s ease",
  },
};

export default function SettingsTab() {
  const [settings, setSettings] = useState({});
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, tplRes] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/templates", { cache: "no-store" }),
      ]);
      setSettings(await settingsRes.json());
      const tpls = await tplRes.json();
      if (Array.isArray(tpls)) setTemplates(tpls);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load platform settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const setField = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
        toast.success("Platform settings saved.");
      } else {
        toast.error(data.detail || "Failed to save settings.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to backend.");
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (!window.confirm("Reset all platform settings to defaults?")) return;
    try {
      const res = await fetch("/api/settings/reset", { method: "POST" });
      const data = await res.json();
      setSettings(data);
      toast.success("Settings reset to defaults.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to reset settings.");
    }
  };

  const defaultTemplateOptions = (category) =>
    templates.filter(t => t.category === category);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <Loader2 size={22} className="spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div className="glass-card" style={style.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Settings2 size={18} style={{ color: "var(--primary)" }} /> Platform Settings
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-dim)" }}>
            These settings are stored in the database and drive all email templates, batching and automation.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-outline btn-icon" onClick={resetSettings} title="Reset to defaults">
            <RotateCcw size={15} />
          </button>
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" style={{ marginRight: "6px" }} /> : <Save size={14} style={{ marginRight: "6px" }} />}
            Save Settings
          </button>
        </div>
      </div>

      {FIELD_SECTIONS.map(({ key: sectionKey, title, icon: Icon, description, fields }) => (
        <div key={sectionKey} style={{ marginBottom: "1.5rem" }}>
          <div style={style.sectionHeader}>
            <div style={style.sectionIcon}><Icon size={16} /></div>
            <div>
              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>{title}</h4>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-dim)" }}>{description}</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
            {fields.map(([key, label, type]) => (
              <div key={key}>
                <label style={style.label}>{label}</label>
                <input
                  className="form-input"
                  style={{ marginTop: "4px" }}
                  type={type}
                  value={settings[key] ?? ""}
                  onChange={(e) => setField(key, type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Automation toggles */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={style.sectionHeader}>
          <div style={style.sectionIcon}><Bot size={16} /></div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Automation Toggles</h4>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Pause/resume background inbox scanning and automatic follow-up dispatch.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "2rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          {[
            ["scanning_paused", "Background inbox scanning"],
            ["followups_paused", "Automatic follow-up dispatch"],
          ].map(([key, label]) => {
            const on = settings[key] === false;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <button
                  style={{ ...style.toggle, background: on ? "var(--success)" : "#cbd5e1" }}
                  onClick={() => setField(key, !on)}
                  aria-label={label}
                >
                  <span style={{ ...style.toggleKnob, left: on ? "23px" : "3px" }} />
                </button>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: on ? "var(--success)" : "var(--text-muted)" }}>
                  {on ? "Active" : "Paused"} — {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Default templates */}
      <div>
        <div style={style.sectionHeader}>
          <div style={style.sectionIcon}><Mail size={16} /></div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Default Email Templates</h4>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Used automatically when no template is explicitly selected in a send.
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
          {[
            ["default_template_startup", "Startup invite (startups)", "startups"],
            ["default_template_incubator", "Incubator invite (incubators)", "incubators"],
            ["default_template_startup_followup", "Startup follow-up (followup)", "followup"],
            ["default_template_incubator_followup", "Incubator follow-up (followup)", "followup"],
          ].map(([key, label, category]) => (
            <div key={key}>
              <label style={style.label}>{label}</label>
              <select
                className="form-input"
                style={{ marginTop: "4px" }}
                value={settings[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
              >
                <option value="">— Not configured —</option>
                {defaultTemplateOptions(category).map(t => (
                  <option key={t.key} value={t.key}>{t.name} ({t.key})</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
