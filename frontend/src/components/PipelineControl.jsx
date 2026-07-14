import React, { useState } from "react";
import { Terminal, Play, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";

const STAGES = [
  { id: "scrape", name: "1. Data Collection Scraper", desc: "Scrapes directories, government databases, universityTBIs, & private studios." },
  { id: "clean", name: "2. Data Cleaning Rules", desc: "Standardizes states/cities, validates email patterns, ensures https:// url format." },
  { id: "resolve", name: "3. Entity Resolution", desc: "Deduplicates matching entities (SINE, CIIE) using string similarity, maps graph edges." },
  { id: "enrich", name: "4. AI Enrichment", desc: "Infers missing sectors, categories, and coordinates using rule-based tags and Gemini API." }
];

export default function PipelineControl({ logs, onRefreshLogs, onRefreshAllData }) {
  const [runningStage, setRunningStage] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");

  const triggerPipeline = async (stageId) => {
    setRunningStage(stageId);
    setStatusMsg(`Initiating stage: ${stageId}...`);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/pipeline/run?stage=${stageId}`, {
        method: "POST"
      });
      const data = await res.json();
      
      if (res.ok && data.status === "success") {
        setStatusMsg(`Stage ${stageId} completed successfully!`);
        onRefreshLogs();
        onRefreshAllData();
      } else {
        setStatusMsg(`Error executing stage: ${data.detail || "Server error"}`);
      }
    } catch (e) {
      console.error(e);
      setStatusMsg(`Connection error occurred.`);
    } finally {
      setRunningStage(null);
    }
  };

  const triggerReset = async () => {
    if (!window.confirm("Are you sure you want to clear the entire ecosystem database? This will remove all scraped and enriched data.")) {
      return;
    }
    setRunningStage("reset");
    setStatusMsg("Resetting database tables...");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/pipeline/reset", {
        method: "POST"
      });
      if (res.ok) {
        setStatusMsg("Database cleared successfully.");
        onRefreshLogs();
        onRefreshAllData();
      } else {
        setStatusMsg("Failed to reset database.");
      }
    } catch (e) {
      console.error(e);
      setStatusMsg("Connection error occurred during reset.");
    } finally {
      setRunningStage(null);
    }
  };

  const getLogClass = (stage, status) => {
    if (status === "ERROR") return "log-entry error";
    if (status === "START") return "log-entry start";
    if (stage === "SYSTEM") return "log-entry system";
    return "log-entry success";
  };

  const formatTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString();
    } catch {
      return "";
    }
  };

  return (
    <div className="pipeline-layout">
      {/* Interactive Controller */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="glass-card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "white" }}>
            ⚙️ Run Ingestion Pipeline
          </h3>
          
          <div className="pipeline-steps">
            {STAGES.map((step) => {
              const isRunning = runningStage === step.id;
              const hasRunLogs = logs.some(l => l.stage === step.id.toUpperCase() && l.status === "SUCCESS");
              
              return (
                <div 
                  key={step.id} 
                  className={`glass-card step-card ${isRunning ? "active" : ""} ${hasRunLogs ? "completed" : ""}`}
                  style={{ padding: "1rem" }}
                >
                  <div className="step-number">
                    {isRunning ? "⚙️" : step.id === "scrape" ? "1" : step.id === "clean" ? "2" : step.id === "resolve" ? "3" : "4"}
                  </div>
                  <div className="step-info">
                    <div className="step-name">{step.name}</div>
                    <div className="step-desc">{step.desc}</div>
                  </div>
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                    disabled={runningStage !== null}
                    onClick={() => triggerPipeline(step.id)}
                  >
                    Run
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.25rem" }}>
            <button 
              className="btn btn-primary"
              style={{ flexGrow: 1 }}
              disabled={runningStage !== null}
              onClick={() => triggerPipeline("all")}
            >
              <Play size={16} />
              Run Full Pipeline
            </button>
            
            <button 
              className="btn btn-secondary"
              style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)" }}
              disabled={runningStage !== null}
              onClick={triggerReset}
              title="Reset Database"
            >
              <RotateCcw size={16} />
              Reset DB
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="glass-card" style={{ padding: "1rem", borderColor: "var(--border-focus)", background: "rgba(139, 92, 246, 0.05)" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem", fontWeight: "600" }}>
              <AlertTriangle size={16} style={{ color: "var(--primary)" }} />
              <span>Status: {statusMsg}</span>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Console Logs */}
      <div className="glass-card console-panel">
        <div className="console-header">
          <span className="console-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Terminal size={18} style={{ color: "var(--secondary)" }} />
            Console Output & Pipeline Logs
          </span>
          <button 
            className="btn btn-secondary" 
            style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
            onClick={onRefreshLogs}
          >
            Refresh Logs
          </button>
        </div>
        
        <div className="console-body">
          {logs.map((log) => (
            <div key={log.id} className={getLogClass(log.stage, log.status)}>
              <span className="log-time">[{formatTime(log.timestamp)}]</span>
              <span style={{ fontWeight: "700", marginRight: "0.5rem" }}>[{log.stage}]</span>
              <span>{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-dim)", marginTop: "8rem" }}>
              No console logs found. Run a pipeline stage above to view output.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
