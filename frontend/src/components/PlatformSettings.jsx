import React, { useState } from "react";
import { Settings2, FileText, Megaphone } from "lucide-react";
import SettingsTab from "./SettingsTab";
import TemplatesTab from "./TemplatesTab";
import CampaignsTab from "./CampaignsTab";

const TABS = [
  { id: "settings", label: "Platform Settings", Icon: Settings2 },
  { id: "templates", label: "Email Templates", Icon: FileText },
  { id: "campaigns", label: "Campaigns", Icon: Megaphone },
];

export default function PlatformSettings() {
  const [tab, setTab] = useState("settings");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem", flexWrap: "wrap" }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="btn"
            style={{
              background: tab === id ? "var(--primary-light)" : "transparent",
              color: tab === id ? "var(--primary)" : "var(--text-muted)",
              borderColor: tab === id ? "var(--primary)" : "transparent",
              fontWeight: tab === id ? "700" : "500",
              padding: "8px 16px",
              fontSize: "0.85rem",
              border: "1px solid transparent",
            }}
            onClick={() => setTab(id)}
          >
            <Icon size={14} style={{ marginRight: "6px" }} />
            {label}
          </button>
        ))}
      </div>
      {tab === "settings" && <SettingsTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "campaigns" && <CampaignsTab />}
    </div>
  );
}
