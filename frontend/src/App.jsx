import React, { useState, useEffect } from "react";
import { 
  Building, 
  LineChart, 
  AlertCircle,
  RefreshCcw,
  Sparkles,
  FileSignature,
  MessageSquare
} from "lucide-react";

import AnalyticsDashboard from "./components/AnalyticsDashboard";
import DirectoryView from "./components/DirectoryView";
import AiAssistant from "./components/AiAssistant";
import OutreachAutomation from "./components/OutreachAutomation";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mouPreselectedIncubator, setMouPreselectedIncubator] = useState("");
  const [outreachRefreshTrigger, setOutreachRefreshTrigger] = useState(0);
  
  const handleDraftMouFromFinder = (incubatorName) => {
    setMouPreselectedIncubator(incubatorName);
    setActiveTab("outreach");
  };
  
  // App state
  const [analyticsData, setAnalyticsData] = useState(null);


  
  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEcosystemData = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch Analytics
      const analyticsRes = await fetch("http://127.0.0.1:8000/api/analytics");
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
  };

  useEffect(() => {
    fetchEcosystemData();
  }, []);



  if (backendError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", textAlign: "center", background: "#f8f9ff" }}>
        <div className="glass-card" style={{ padding: "3rem", maxWidth: "550px", border: "1px solid var(--accent-red)" }}>
          <AlertCircle size={48} style={{ color: "var(--accent-red)", marginBottom: "1.5rem" }} />
          <h2 style={{ fontSize: "1.75rem", fontWeight: "800", color: "var(--text-primary)", marginBottom: "0.5rem" }}>Backend Server Offline</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "2rem" }}>
            The India Startup Ecosystem Intelligence Platform frontend is running, but it cannot connect to the Python FastAPI backend on <code style={{ color: "var(--secondary)", background: "rgba(0,0,0,0.03)", padding: "0.15rem 0.35rem", borderRadius: "4px" }}>http://127.0.0.1:8000</code>.
          </p>
          
          <div style={{ background: "black", padding: "1.25rem", borderRadius: "8px", fontFamily: "monospace", fontSize: "0.85rem", textAlign: "left", color: "#38bdf8", border: "1px solid var(--border-color)", marginBottom: "2rem" }}>
            <span style={{ color: "var(--text-dim)" }}># Launch backend in another terminal:</span><br />
            cd backend<br />
            python run.py
          </div>

          <button className="btn btn-primary" style={{ margin: "0 auto" }} onClick={fetchEcosystemData}>
            <RefreshCcw size={16} /> Reconnect to Backend
          </button>
        </div>
      </div>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case "dashboard":
        return <AnalyticsDashboard analyticsData={analyticsData} loading={loading} />;
      case "directory":
        return <DirectoryView filtersData={analyticsData ? analyticsData.filters : null} onDraftMou={handleDraftMouFromFinder} />;
      case "outreach":
        return <OutreachAutomation preselectedIncubatorName={mouPreselectedIncubator} refreshTrigger={outreachRefreshTrigger} />;
      default:
        return <AnalyticsDashboard analyticsData={analyticsData} loading={loading} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <ul className="sidebar-menu">
          <li className={`sidebar-item ${activeTab === "dashboard" ? "active" : ""}`}>
            <button onClick={() => setActiveTab("dashboard")}>
              <LineChart size={18} />
              <span>Dashboard</span>
            </button>
          </li>
          <li className={`sidebar-item ${activeTab === "directory" ? "active" : ""}`}>
            <button onClick={() => setActiveTab("directory")}>
              <Building size={18} />
              <span>Incubators Directory</span>
            </button>
          </li>

          <li className={`sidebar-item ${activeTab === "outreach" ? "active" : ""}`}>
            <button onClick={() => setActiveTab("outreach")}>
              <Sparkles size={18} style={{ color: "var(--secondary)" }} />
              <span>Outreach Automation</span>
            </button>
          </li>
        </ul>

      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="header-section">
          <div className="header-title">
            <h1>
              {activeTab === "dashboard" && "Ecosystem Insights & Analytics"}
              {activeTab === "directory" && "Indian Incubators Directory"}
              {activeTab === "outreach" && "Email Outreach & Auto-Scheduler"}
            </h1>
            <p>
              {activeTab === "dashboard" && "Aggregated metrics, state distributions, and technology verticals."}
              {activeTab === "directory" && "Discover and search academic, government, and private TBIs."}
              {activeTab === "outreach" && "Draft collaboration MOUs, execute digital signatures, run campaign outreach, and monitor inbox replies."}
            </p>
          </div>

          <div className="header-actions">
            <button 
              className="btn btn-secondary" 
              onClick={fetchEcosystemData}
              disabled={refreshing}
              style={{ padding: "0.5rem 0.75rem" }}
              title="Refresh Data"
            >
              <RefreshCcw size={16} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </div>

        {renderActiveView()}
        {activeTab === "dashboard" && <AiAssistant />}
      </div>
    </div>
  );
}
