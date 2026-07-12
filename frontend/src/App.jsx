import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart2,
  Building2,
  Sparkles,
  RocketIcon,
  RefreshCcw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Bot,
  Trash2,
} from "lucide-react";

import AnalyticsDashboard from "./components/AnalyticsDashboard";
import DirectoryView from "./components/DirectoryView";
import AiAssistant from "./components/AiAssistant";
import OutreachAutomation from "./components/OutreachAutomation";
import CohortEvaluator from "./components/CohortEvaluator";
import StartupsDirectory from "./components/StartupsDirectory";
import { ToastContainer, toast } from "react-toastify";



import "react-toastify/dist/ReactToastify.css";

const NAV_ITEMS = [
  {
    section: "Analytics",
    items: [
      { id: "dashboard",  label: "Dashboard",           Icon: BarChart2,  subtitle: "Ecosystem metrics & insights" },
    ],
  },
  {
    section: "Outreach",
    items: [
      { id: "directory",  label: "Incubators Directory", Icon: Building2,  subtitle: "Discover & search TBIs" },
      { id: "outreach",   label: "Outreach Automation",  Icon: Sparkles,   subtitle: "MOU drafts & campaigns" },
      { id: "startups_directory", label: "Startups Directory", Icon: RocketIcon, subtitle: "Ecosystem startups list" },
      { id: "startups_outreach", label: "Startup Campaigns", Icon: Sparkles, subtitle: "Email cohort founders" },
    ],
  },
  {
    section: "Evaluation",
    items: [
      { id: "cohort_evaluator", label: "Cohort Evaluator", Icon: Sparkles, subtitle: "Secure ranking & analysis" },
    ],
  },
];

const PAGE_META = {
  dashboard:        { title: "Ecosystem Insights & Analytics",        sub: "Aggregated metrics, state distributions, and technology verticals." },
  directory:        { title: "Indian Incubators Directory",           sub: "Discover and search academic, government, and private TBIs." },
  outreach:         { title: "Email Outreach & Auto-Scheduler",       sub: "Draft collaboration MOUs, execute digital signatures, and run campaigns." },
  startups_directory: { title: "Ecosystem Startups Directory",        sub: "Filter, search, and manage cohort and ecosystem startups." },
  startups_outreach:{ title: "Startup Campaign Manager",              sub: "Manage email outreach sequences, check replies, and track communications." },
  cohort_evaluator: { title: "INCUBEIN Cohort Evaluator",             sub: "Secure field-level encryption, multi-criteria scoring, AI reviews, and similarity matching." },
};



export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mouPreselectedIncubator, setMouPreselectedIncubator] = useState("");
  const [outreachRefreshTrigger, setOutreachRefreshTrigger] = useState(0);
  const [logoError, setLogoError] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("rtmun_sidebar_collapsed") === "true"
  );

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("rtmun_sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleDraftMouFromFinder = (incubatorName) => {
    setMouPreselectedIncubator(incubatorName);
    setActiveTab("outreach");
  };

  const fetchEcosystemData = useCallback(async () => {
    setRefreshing(true);
    try {
      const analyticsRes = await fetch("/api/analytics");
      const analytics = await analyticsRes.json();
      setAnalyticsData(analytics);

      if (activeTab === "outreach") {
        setOutreachRefreshTrigger(prev => prev + 1);
      }

      setBackendError(false);
    } catch (e) {
      console.error("Backend offline:", e);
      setBackendError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchEcosystemData();
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  /* ─── Backend Error Screen ─────────────────────────────────── */
  if (backendError) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-dark)",
        padding: "16px",
        textAlign: "center",
      }}>
        <div style={{
          background: "white",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-lg)",
          padding: "36px 24px",
          maxWidth: "380px",
          width: "100%",
          boxShadow: "var(--shadow-md)",
          animation: "fadeSlideUp 0.35s var(--ease-out)",
        }}>
          {/* Icon */}
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "var(--danger-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <WifiOff size={24} color="var(--danger)" />
          </div>

          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>
            Server Connection Offline
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: "1.5", marginBottom: "24px" }}>
            The database and backend services are currently unavailable. Please verify the server is running and try again.
          </p>

          <button
            className="btn btn-primary"
            style={{ margin: "0 auto", width: "100%", justifyContent: "center" }}
            onClick={fetchEcosystemData}
            disabled={refreshing}
          >
            <RefreshCcw size={14} className={refreshing ? "spin" : ""} style={{ marginRight: "6px" }} />
            {refreshing ? "Connecting..." : "Reconnect to Server"}
          </button>
        </div>
      </div>
    );
  }

  /* ─── Active View Router ────────────────────────────────────── */
  const renderActiveView = () => {
    switch (activeTab) {
      case "dashboard":
        return <AnalyticsDashboard analyticsData={analyticsData} loading={loading} />;
      case "directory":
        return <DirectoryView filtersData={analyticsData ? analyticsData.filters : null} onDraftMou={handleDraftMouFromFinder} />;
      case "outreach":
        return <OutreachAutomation preselectedIncubatorName={mouPreselectedIncubator} refreshTrigger={outreachRefreshTrigger} />;
      case "startups_outreach":
        return <StartupsOutreachView />;
      case "startups_directory":
        return <StartupsDirectory />;
      case "cohort_evaluator":
        return <CohortEvaluator />;

      default:
        return <AnalyticsDashboard analyticsData={analyticsData} loading={loading} />;
    }
  };


  const pageMeta = PAGE_META[activeTab] || PAGE_META.dashboard;

  /* ─── Main Render ───────────────────────────────────────────── */
  return (
    <div className="app-container">
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <nav className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
        {/* Brand / Logo */}
        <div className="sidebar-brand" style={{ 
          padding: sidebarCollapsed ? "12px 10px" : "16px 18px", 
          justifyContent: sidebarCollapsed ? "center" : "flex-start",
          minHeight: "68px"
        }}>
          {!logoError ? (
            <img 
              src="https://incubein.com/site-logo.png" 
              alt="Incubein Logo" 
              style={{ 
                height: sidebarCollapsed ? "36px" : "42px", 
                maxWidth: sidebarCollapsed ? "44px" : "180px",
                objectFit: "contain",
                transition: "all var(--transition-base)"
              }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="sidebar-logo-icon">I</div>
          )}
          {!sidebarCollapsed && (
            <div className="sidebar-brand-text" style={{ marginLeft: "8px" }}>
              <span className="sidebar-brand-name" style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--text-primary)" }}>
                Incubein
              </span>
              <span className="sidebar-brand-sub" style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>
                Foundation
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ section, items }) => (
            <div key={section}>
              <div className="sidebar-section-label">{section}</div>
              <ul className="sidebar-menu">
                {items.map(({ id, label, Icon }) => (
                  <li key={id} className={`sidebar-item${activeTab === id ? " active" : ""}`}>
                    <button onClick={() => handleTabChange(id)} data-label={label}>
                      <span className="sidebar-item-icon">
                        <Icon size={17} />
                      </span>
                      <span className="sidebar-item-label">{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>



        {/* Collapse Toggle */}
        <button
          className="sidebar-collapse-btn"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed
            ? <ChevronRight size={13} />
            : <ChevronLeft size={13} />
          }
        </button>
      </nav>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div className={`main-content${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>

        {/* Top Header Bar */}
        <header className="top-header">
          <div className="header-breadcrumb">
            <span className="header-breadcrumb-item">Incubein Foundation</span>
            <span className="header-breadcrumb-sep">›</span>
            <span className="header-breadcrumb-item current">{pageMeta.title}</span>
          </div>

          <div className="header-right-cluster">
            <div className={`live-badge${backendError ? " offline" : ""}`}>
              <span className={`status-dot${backendError ? " offline" : ""}`} />
              {backendError ? "Offline" : "Live"}
            </div>
            <button
              className="btn btn-secondary btn-icon"
              onClick={fetchEcosystemData}
              disabled={refreshing}
              title="Refresh data"
            >
              <RefreshCcw size={15} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="content-body" key={activeTab}>
          {/* Page Heading */}
          <div className="header-section">
            <div className="header-title">
              <h1>{pageMeta.title}</h1>
              <p>{pageMeta.sub}</p>
            </div>
          </div>

          {renderActiveView()}
        </div>
      </div>

      {/* AI Assistant — floating on all pages */}
      <AiAssistant />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        toastStyle={{
          background: "white",
          color: "var(--text-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          fontSize: "0.875rem",
        }}
      />
    </div>
  );
}

const PREDEFINED_TEMPLATES = {
  incubation: {
    name: "Incubation Seat Offer",
    subject: "INCUBEIN Cohort: Incubation Seat Offer - {StartupName}",
    body: "Dear Founder,\n\nWe are pleased to inform you that {StartupName} has been selected for incubation in the INCUBEIN Startup Cohort!\n\nOur evaluation committee was highly impressed by your application. We will follow up shortly with formal onboarding details.\n\nBest regards,\nINCUBEIN Foundation Team"
  },
  deck_request: {
    name: "Pitch Deck Request",
    subject: "INCUBEIN Cohort: Pitch Deck Request - {StartupName}",
    body: "Dear Founder,\n\nThank you for applying to the INCUBEIN Startup Program.\n\nWe have completed our initial screening. To assist in our final ranking, please reply with your latest presentation deck and financial roadmap.\n\nBest regards,\nINCUBEIN Foundation Team"
  },
  interview: {
    name: "Selection Interview Invite",
    subject: "INCUBEIN Cohort: Selection Interview - {StartupName}",
    body: "Dear Founder,\n\nCongratulations! {StartupName} has shortlisted for the final interview phase of the INCUBEIN Cohort.\n\nPlease select a convenient slot to schedule a 15-minute pitch session with our selection committee.\n\nBest regards,\nINCUBEIN Foundation Team"
  }
};

function StartupsOutreachView() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("incubation");

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outreach/leads");
      if (res.ok) {
        const data = await res.json();
        // Filter only startup leads from incubein_cohort
        const startupLeads = data.filter(lead => lead.incubator_id === "incubein_cohort");
        setLeads(startupLeads);
      }
    } catch (e) {
      console.error("Error fetching leads:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleSendEmail = async (lead) => {
    setSendingEmailId(lead.id);
    
    // Compile template values
    const template = PREDEFINED_TEMPLATES[selectedTemplateKey];
    const compiledSubject = template.subject.replace(/{StartupName}/g, lead.incubator_name);
    const compiledBody = template.body.replace(/{StartupName}/g, lead.incubator_name);
    
    try {
      const res = await fetch("/api/outreach/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          subject: compiledSubject,
          body: compiledBody
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        fetchLeads();
      } else {
        toast.error(result.detail || "Failed to trigger email.");
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleClearCampaigns = async () => {
    if (!window.confirm("Are you sure you want to clear all startup campaign leads?")) return;
    try {
      const res = await fetch("/api/outreach/clear-startups", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        setLeads([]);
      } else {
        toast.error("Failed to clear campaign leads.");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "1rem" }}>
      <div style={{
        background: "white",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-xl)",
        padding: "20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Startup Campaign Manager
          </h2>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
            Manage email outreach sequences, check replies, and select pre-defined templates for cohort applicants.
          </p>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {leads.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontWeight: 700 }}>Active Template:</span>
              <select
                value={selectedTemplateKey}
                onChange={(e) => setSelectedTemplateKey(e.target.value)}
                style={{ height: "36px", fontSize: "0.82rem", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "white", fontWeight: 700, color: "var(--primary)" }}
              >
                {Object.entries(PREDEFINED_TEMPLATES).map(([key, t]) => (
                  <option key={key} value={key}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {leads.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={handleClearCampaigns}
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={14} style={{ marginRight: "6px" }} />
              Reset Startup Leads
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading leads...</div>
      ) : leads.length === 0 ? (
        <div style={{
          background: "white",
          border: "1px dashed var(--border-color)",
          borderRadius: "var(--radius-xl)",
          padding: "40px",
          textAlign: "center"
        }}>
          <AlertCircle size={24} style={{ color: "var(--text-dim)", marginBottom: "8px" }} />
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>No Startup Campaigns Active</h4>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "6px 0 16px" }}>
            Add shortlisted startups to campaigns from the Cohort Evaluator to initialize outreach campaigns.
          </p>
        </div>
      ) : (
        <div style={{
          background: "white",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--bg-dark)", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Startup</th>
                <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Email</th>
                <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Evaluation Score</th>
                <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Status</th>
                <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>{lead.incubator_name}</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>ID: {lead.id}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.82rem" }}>{lead.email}</td>
                  <td style={{ padding: "14px 16px", fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)" }}>{lead.lead_score}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span className="badge" style={{
                      background: lead.status === "New" ? "var(--primary-light)" : "var(--bg-dark)",
                      color: lead.status === "New" ? "var(--primary)" : "var(--text-primary)",
                      fontWeight: 700,
                      fontSize: "0.72rem"
                    }}>
                      {lead.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSendEmail(lead)}
                      disabled={sendingEmailId === lead.id}
                      style={{ padding: "5px 12px", fontSize: "0.74rem", height: "28px" }}
                    >
                      {sendingEmailId === lead.id ? "Sending..." : "Send Campaign Email"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
