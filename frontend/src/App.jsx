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
      { id: "startups_directory", label: "Startups Directory", Icon: RocketIcon, subtitle: "Ecosystem startups list" },
      { id: "outreach_incubators", label: "Incubator Outreach", Icon: Sparkles, subtitle: "MOU drafts & campaigns" },
      { id: "outreach_startups", label: "Startup Outreach", Icon: Sparkles, subtitle: "Onboarding & campaigns" },
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
  outreach_incubators: { title: "Incubator Outreach & Campaigns",     sub: "Draft collaboration MOUs, execute digital signatures, and run campaigns." },
  outreach_startups: { title: "Startup Outreach & Onboarding",       sub: "Run onboarding campaigns, track replies, and schedule startup cohort calls." },
  startups_directory: { title: "Ecosystem Startups Directory",        sub: "Filter, search, and manage cohort and ecosystem startups." },
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
    setActiveTab("outreach_incubators");
  };

  const fetchEcosystemData = useCallback(async () => {
    setRefreshing(true);
    try {
      const analyticsRes = await fetch("/api/analytics");
      const analytics = await analyticsRes.json();
      setAnalyticsData(analytics);

      if (activeTab === "outreach_incubators" || activeTab === "outreach_startups") {
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
      case "outreach_incubators":
        return <OutreachAutomation defaultTargetType="incubators" preselectedIncubatorName={mouPreselectedIncubator} refreshTrigger={outreachRefreshTrigger} />;
      case "outreach_startups":
        return <OutreachAutomation defaultTargetType="startups" preselectedIncubatorName={mouPreselectedIncubator} refreshTrigger={outreachRefreshTrigger} />;
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


