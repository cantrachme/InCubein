import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart2,
  Building2,
  Sparkles,
  RocketIcon,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  WifiOff,
  Settings2,
  Flag,
  ListChecks,
  ShieldAlert,
  CalendarCheck,
  Inbox,
  CalendarClock,
  Globe,
} from "lucide-react";

import AnalyticsDashboard from "./components/AnalyticsDashboard";
import DirectoryView from "./components/DirectoryView";
import AiAssistant from "./components/AiAssistant";
import OutreachAutomation from "./components/OutreachAutomation";
import CohortEvaluator from "./components/CohortEvaluator";
import StartupsDirectory from "./components/StartupsDirectory";
import EnrichmentHub from "./components/EnrichmentHub";
import ActionPlans from "./components/ActionPlans";
import ActionTracker from "./components/ActionTracker";
import MilestonesView from "./components/MilestonesView";
import RisksView from "./components/RisksView";
import PlatformSettings from "./components/PlatformSettings";
import InquirerDashboard from "./components/InquiryDashboards";
import StartupDashboard from "./components/StartupDashboard";
import TimelineDashboard from "./components/TimelineDashboard";
import { ToastContainer } from "react-toastify";

import "react-toastify/dist/ReactToastify.css";

const NAV_ITEMS = [
  {
    section: "Main Dashboard",
    items: [
      { id: "dashboard", label: "Incubator + Startup Analysis", Icon: BarChart2, subtitle: "Two separate views — incubation & startup never mixed" },
    ],
  },
  {
    section: "View",
    items: [
      { id: "inquirers",       label: "Inquirer Dashboard",     Icon: Inbox,        subtitle: "Incubation + Startup inquiries from the Outreach Hub" },
      { id: "startups_view",   label: "Startup Dashboard",      Icon: RocketIcon,   subtitle: "Real startup intelligence, charts & filters" },
      { id: "timeline",        label: "Timeline",               Icon: CalendarClock, subtitle: "Clickable activity feed across outreach & execution" },
    ],
  },
  {
    section: "Execution",
    items: [
      { id: "action_plans", label: "90-Day Action Plan",    Icon: CalendarCheck, subtitle: "Per-startup plans — select a startup, add or remove it" },
      { id: "actions",      label: "90-Day Action Tracker", Icon: ListChecks,     subtitle: "Status, check/cross markers, auto-sync to Milestones & Risks" },
      { id: "milestones",   label: "Milestones",            Icon: Flag,           subtitle: "Auto-view: consolidated timeline flagged in the tracker" },
      { id: "risks",        label: "Risk Register",         Icon: ShieldAlert,    subtitle: "Auto-view: risk matrix updated from tracker logs & plan risks" },
    ],
  },
  {
    section: "Outreach & Nurturing",
    items: [
      { id: "directory",  label: "Incubators Directory",     Icon: Building2,  subtitle: "Discover & search TBIs" },
      { id: "startups_directory", label: "Startups Directory", Icon: RocketIcon, subtitle: "Ecosystem startups list" },
      { id: "outreach",   label: "Outreach Hub",             Icon: Sparkles,    subtitle: "Campaigns, replies & onboarding" },
    ],
  },
  {
    section: "Intelligence & Evaluation",
    items: [
      { id: "cohort_evaluator", label: "Cohort Evaluator", Icon: Sparkles, subtitle: "Startup & Incubator ranking" },
      { id: "enrichment_hub", label: "Scraper & Enrichment", Icon: Globe, subtitle: "Web lookup & data extraction" },
    ],
  },
  {
    section: "Configuration",
    items: [
      { id: "platform_settings", label: "Platform Settings", Icon: Settings2, subtitle: "Templates, campaigns & automation" },
    ],
  },
];

const PAGE_META = {
  dashboard:          { title: "Main Dashboard — Incubator & Startup Analysis", sub: "Two separate analyses; incubation and startup data are never mixed." },
  inquirers:          { title: "Inquirer Dashboard",                  sub: "Incubation + Startup inquiries (Outreach Hub) with reply & meeting actions." },
  startups_view:      { title: "Startup Dashboard",                   sub: "Real startup intelligence from the CRM — KPIs, charts, search & profiles." },
  timeline:           { title: "Timeline",                            sub: "Clickable activity feed across outreach, meetings & execution." },
  milestones:         { title: "Milestones",                           sub: "Automated view — consolidated timeline of milestones flagged in the Action Tracker." },
  actions:            { title: "90-Day Action Tracker",                sub: "Assign, track and complete actions; check/cross markers auto-sync to Milestones & Risks." },
  action_plans:       { title: "90-Day Action Plan",                  sub: "Per-startup plans — select a startup (or add one), define steps, milestones & risks." },
  risks:              { title: "Risk Register",                        sub: "Automated view — risk matrix updated from tracker logs & initial plan risks." },
  directory:          { title: "Indian Incubators Directory",           sub: "Discover and search academic, government, and private TBIs." },
  outreach:           { title: "Outreach & Onboarding Hub",             sub: "Draft MOUs, run targeted campaigns, and track startup pipeline." },
  startups_directory: { title: "Ecosystem Startups Directory",        sub: "Filter, search, and manage cohort and ecosystem startups." },
  cohort_evaluator:   { title: "INCUBEIN Cohort Evaluator",             sub: "Secure evaluation, multi-criteria scoring, and incubator ranking." },
  enrichment_hub:     { title: "Web Scraping & Data Enrichment Hub",    sub: "DuckDuckGo web search integration to auto-discover missing addresses, emails, & focus areas." },
  platform_settings:  { title: "Platform Settings",                    sub: "Manage email templates, outreach campaigns, and automation configuration." },
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
      case "inquirers":
        return <InquirerDashboard />;
      case "startups_view":
        return <StartupDashboard />;
      case "timeline":
        return <TimelineDashboard />;
      case "directory":
        return <DirectoryView filtersData={analyticsData ? analyticsData.filters : null} onDraftMou={handleDraftMouFromFinder} onDataChanged={fetchEcosystemData} />;
      case "outreach":
        return <OutreachAutomation preselectedIncubatorName={mouPreselectedIncubator} refreshTrigger={outreachRefreshTrigger} />;
      case "startups_directory":
        return <StartupsDirectory onDataChanged={fetchEcosystemData} />;
      case "cohort_evaluator":
        return <CohortEvaluator />;
      case "enrichment_hub":
        return <EnrichmentHub />;
      case "platform_settings":
        return <PlatformSettings />;
      case "milestones":
        return <MilestonesView />;
      case "actions":
        return <ActionTracker />;
      case "action_plans":
        return <ActionPlans />;
      case "risks":
        return <RisksView />;
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

