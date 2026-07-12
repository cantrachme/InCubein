import React, { useState, useEffect } from "react";
import {
  Upload,
  Search,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  Globe,
  RefreshCw,
  Trash2,
  Lock,
  ExternalLink,
  Info,
  CheckSquare,
  Square,
  BarChart2,
  X,
  Send,
  Database
} from "lucide-react";
import { toast } from "react-toastify";

export default function CohortEvaluator() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  
  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  
  // Shortlist selection: "all", 5, 10, 20
  const [shortlistLimit, setShortlistLimit] = useState("all"); 
  
  // Comparison & Export states
  const [checkedIds, setCheckedIds] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [exportingDb, setExportingDb] = useState(false);
  const [exportingCamp, setExportingCamp] = useState(false);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/incubein/applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
        if (data.length > 0 && !selectedApp) {
          setSelectedApp(data[0]);
        }
      } else {
        toast.error("Failed to load applications.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch("/api/incubein/upload", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (res.ok && result.status === "success") {
        toast.success(result.message);
        fetchApplications();
        setCheckedIds([]);
      } else {
        toast.error(result.detail || result.message || "Failed to process Excel file.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error during file upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Are you sure you want to delete all applications? This action is irreversible.")) return;
    
    try {
      const res = await fetch("/api/incubein/delete", { method: "POST" });
      if (res.ok) {
        toast.success("Database cleared successfully.");
        setApplications([]);
        setSelectedApp(null);
        setCheckedIds([]);
      } else {
        toast.error("Failed to clear database.");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };

  const handleExportToDb = async (all = false) => {
    const ids = all ? [] : checkedIds;
    if (!all && ids.length === 0) {
      toast.warning("Please select at least one startup.");
      return;
    }

    setExportingDb(true);
    try {
      const res = await fetch("/api/incubein/add-to-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_ids: ids, all }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.detail || "Failed to add to database.");
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setExportingDb(false);
    }
  };

  const handleExportToCampaign = async (all = false) => {
    const ids = all ? [] : checkedIds;
    if (!all && ids.length === 0) {
      toast.warning("Please select at least one startup.");
      return;
    }

    setExportingCamp(true);
    try {
      const res = await fetch("/api/incubein/add-to-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_ids: ids, all }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.detail || "Failed to add to campaigns.");
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setExportingCamp(false);
    }
  };

  const toggleCheck = (id) => {
    setCheckedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllCheck = (visibleApps) => {
    const visibleIds = visibleApps.map(app => app._id);
    const allChecked = visibleIds.every(id => checkedIds.includes(id));
    if (allChecked) {
      setCheckedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setCheckedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  // Get Unique Sectors & Stages
  const sectors = ["All", ...new Set(applications.map(app => app.sector).filter(Boolean))];
  const stages = ["All", ...new Set(applications.map(app => app.stage).filter(Boolean))];

  // Filters logic
  let filteredApps = applications.filter(app => {
    const matchesSearch = 
      app.startup_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.name && app.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (app.business_summary && app.business_summary.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesSector = sectorFilter === "All" || app.sector === sectorFilter;
    const matchesStage = stageFilter === "All" || app.stage === stageFilter;
    const matchesScore = app.final_score >= minScoreFilter;

    return matchesSearch && matchesSector && matchesStage && matchesScore;
  });

  // Shortlist selection filter (Top 5, 10, 20)
  if (shortlistLimit !== "all") {
    const limit = parseInt(shortlistLimit, 10);
    filteredApps = filteredApps.slice(0, limit);
  }

  // Get recommended shortlist size based on entries count
  const getRecommendedShortlist = () => {
    const count = applications.length;
    if (count <= 10) return 3;
    if (count <= 50) return 5;
    if (count <= 200) return 10;
    return 20;
  };

  const formatCurrency = (val) => {
    if (!val) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  const getRecommendationColor = (rec) => {
    switch (rec) {
      case "Highly Recommended":
        return { bg: "#ECFDF5", text: "#10B981", border: "#A7F3D0" };
      case "Recommended":
        return { bg: "#EFF6FF", text: "#3B82F6", border: "#BFDBFE" };
      case "Consider with Reservations":
        return { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" };
      default:
        return { bg: "#FEF2F2", text: "#EF4444", border: "#FCA5A5" };
    }
  };

  // Compare List
  const compareStartupsList = applications.filter(app => checkedIds.includes(app._id)).slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "1rem" }}>
      
      {/* ─── Control Header ─────────────────────────────────────── */}
      <div style={{
        background: "white",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-xl)",
        padding: "20px",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px"
      }}>
        <div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Cohort Evaluator & Ranking
          </h2>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Upload applications, score automatically, run similarity audits, and add leads to campaigns.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {applications.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={() => handleExportToDb(true)} disabled={exportingDb}>
                <Database size={14} style={{ marginRight: "6px" }} />
                Add All to DB
              </button>
              <button className="btn btn-secondary" onClick={() => handleExportToCampaign(true)} disabled={exportingCamp}>
                <Send size={14} style={{ marginRight: "6px" }} />
                Add All to Campaign
              </button>
              <button className="btn btn-secondary" onClick={handleClear} style={{ color: "var(--danger)" }}>
                <Trash2 size={14} style={{ marginRight: "6px" }} />
                Reset
              </button>
            </>
          )}

          <label className={`btn btn-primary ${uploading ? "disabled" : ""}`} style={{ cursor: "pointer" }}>
            <Upload size={14} style={{ marginRight: "6px" }} />
            {uploading ? "Processing Applications..." : "Upload Cohort Excel"}
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      {applications.length === 0 ? (
        /* ─── Empty State ────────────────────────────────────────── */
        <div style={{
          background: "white",
          border: "1px dashed var(--border-color)",
          borderRadius: "var(--radius-xl)",
          padding: "60px 20px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "40vh"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: "var(--primary-light)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px"
          }}>
            <FileText size={28} />
          </div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            No Cohort Uploaded
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "380px", margin: "8px 0 20px", lineHeight: "1.6" }}>
            Upload a spreadsheet containing application columns like Name, Email, Sector, Revenue, Business Summary, and Stage to score, encrypt, and rank applicants.
          </p>
          <label className="btn btn-primary" style={{ cursor: "pointer" }}>
            <Upload size={14} style={{ marginRight: "6px" }} />
            Upload Applications Sheet
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>
      ) : (
        /* ─── Dashboard Workspace ────────────────────────────────── */
        <div style={{ display: "grid", gridTemplateColumns: "1.24fr 0.76fr", gap: "20px", alignItems: "start" }}>
          
          {/* ─── LEFT COLUMN: Filters, Shortlist limit & Table ──────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Filters panel */}
            <div style={{
              background: "white",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-xl)",
              padding: "16px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px"
            }}>
              {/* Search */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Search</span>
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search name, idea..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: "30px", height: "36px", fontSize: "0.82rem" }}
                  />
                </div>
              </div>

              {/* Sector Filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Sector</span>
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  style={{ height: "36px", fontSize: "0.82rem", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "white" }}
                >
                  {sectors.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </div>

              {/* Stage Filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Stage</span>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  style={{ height: "36px", fontSize: "0.82rem", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "white" }}
                >
                  {stages.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>

              {/* Shortlist Filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Shortlist Mode</span>
                <select
                  value={shortlistLimit}
                  onChange={(e) => setShortlistLimit(e.target.value)}
                  style={{ height: "36px", fontSize: "0.82rem", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "white", fontWeight: shortlistLimit !== "all" ? 700 : 400, color: shortlistLimit !== "all" ? "var(--primary)" : "var(--text-primary)" }}
                >
                  <option value="all">Show All</option>
                  <option value="5">Top 5 Shortlist</option>
                  <option value="10">Top 10 Shortlist</option>
                  <option value="20">Top 20 Shortlist</option>
                </select>
              </div>
            </div>

            {/* Recommended Shortlist Indicator */}
            <div style={{
              background: "var(--primary-light)",
              border: "1px solid rgba(0, 181, 156, 0.2)",
              borderRadius: "var(--radius-lg)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.78rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--primary)", fontWeight: 700 }}>
                <TrendingUp size={14} />
                <span>Recommended Shortlist: Top {getRecommendedShortlist()}</span>
              </div>
              <span style={{ color: "var(--text-muted)" }}>
                Calculated dynamically for your cohort of {applications.length} applications
              </span>
            </div>

            {/* Application List Card */}
            <div style={{
              background: "white",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden"
            }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-dark)", borderBottom: "1px solid var(--border-color)" }}>
                      <th style={{ padding: "12px 16px", width: "40px" }}>
                        <button
                          onClick={() => toggleAllCheck(filteredApps)}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--primary)" }}
                        >
                          {filteredApps.every(app => checkedIds.includes(app._id)) ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </th>
                      <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Rank</th>
                      <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Startup</th>
                      <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Sector</th>
                      <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Stage</th>
                      <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((app) => {
                      const isSelected = selectedApp && selectedApp._id === app._id;
                      const isChecked = checkedIds.includes(app._id);
                      const hasDuplicates = app.similarity_matches && app.similarity_matches.some(m => m.similarity_score >= 80);

                      return (
                        <tr
                          key={app._id}
                          style={{
                            borderBottom: "1px solid var(--border-color)",
                            cursor: "pointer",
                            background: isSelected ? "var(--primary-light)" : "white",
                            transition: "background 0.2s ease",
                          }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: "14px 16px" }} onClick={(e) => { e.stopPropagation(); toggleCheck(app._id); }}>
                            <div style={{ color: isChecked ? "var(--primary)" : "var(--text-dim)" }}>
                              {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px" }} onClick={() => setSelectedApp(app)}>
                            <div style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background: app.rank <= 3 ? "linear-gradient(135deg, #FFD700, #FFA500)" : "var(--bg-dark)",
                              color: app.rank <= 3 ? "white" : "var(--text-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.78rem",
                              fontWeight: 800
                            }}>
                              {app.rank}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px" }} onClick={() => setSelectedApp(app)}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                {app.startup_name}
                              </span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                {app.name}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "0.82rem" }} onClick={() => setSelectedApp(app)}>{app.sector}</td>
                          <td style={{ padding: "14px 16px" }} onClick={() => setSelectedApp(app)}>
                            <span className="badge" style={{ background: "var(--bg-dark)", color: "var(--text-primary)", fontSize: "0.72rem" }}>
                              {app.stage}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "center" }} onClick={() => setSelectedApp(app)}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--primary)" }}>
                                {app.final_score}
                              </span>
                              {hasDuplicates && (
                                <span title="High similarity duplicate detected!" style={{ color: "var(--danger)", display: "inline-flex" }}>
                                  <AlertTriangle size={13} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredApps.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: "30px", textAlign: "center", fontSize: "0.85rem", color: "var(--text-dim)" }}>
                          No applications matched the filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: Profile & Evaluations ─────────────── */}
          {selectedApp && (
            <div style={{
              background: "white",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-xl)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              position: "sticky",
              top: "20px"
            }}>
              
              {/* Header profile */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Rank #{selectedApp.rank}
                    </span>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                      {selectedApp.startup_name}
                    </h3>
                  </div>

                  {selectedApp.evaluation?.recommendation && (
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: `1px solid ${getRecommendationColor(selectedApp.evaluation.recommendation).border}`,
                      background: getRecommendationColor(selectedApp.evaluation.recommendation).bg,
                      color: getRecommendationColor(selectedApp.evaluation.recommendation).text
                    }}>
                      {selectedApp.evaluation.recommendation}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "0.74rem", background: "var(--bg-dark)", padding: "4px 8px", borderRadius: "4px", color: "var(--text-primary)" }}>
                    Sector: {selectedApp.sector}
                  </span>
                  <span style={{ fontSize: "0.74rem", background: "var(--bg-dark)", padding: "4px 8px", borderRadius: "4px", color: "var(--text-primary)" }}>
                    Stage: {selectedApp.stage}
                  </span>
                  {selectedApp.dpiit && (
                    <span style={{ fontSize: "0.74rem", background: "var(--primary-light)", padding: "4px 8px", borderRadius: "4px", color: "var(--primary)", fontWeight: 700 }}>
                      DPIIT: {selectedApp.dpiit_number || "Yes"}
                    </span>
                  )}
                </div>
              </div>

              {/* Decrypted Contact Info Box */}
              <div style={{
                background: "var(--bg-dark)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-lg)",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px", marginBottom: "2px" }}>
                  <Lock size={12} color="var(--primary)" />
                  <span style={{ fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)" }}>Decrypted PII Fields (Admin Only)</span>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.78rem" }}>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Founder:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedApp.name || "N/A"}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Email:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedApp.email || "N/A"}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Mobile:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedApp.mobile || "N/A"}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Address:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={selectedApp.address}>
                      {selectedApp.address || "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Rule Engine</div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", margin: "4px 0" }}>{selectedApp.rule_score}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Weight: 40%</div>
                </div>

                <div style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Gemini LLM</div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", margin: "4px 0" }}>{selectedApp.llm_score}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Weight: 60%</div>
                </div>

                <div style={{ border: "1px solid var(--primary)", background: "var(--primary-light)", borderRadius: "var(--radius-lg)", padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--primary)", textTransform: "uppercase", fontWeight: 700 }}>Final Score</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--primary)", margin: "4px 0" }}>{selectedApp.final_score}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--primary)" }}>Rank: #{selectedApp.rank}</div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>Business Summary</h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: "1.6", background: "var(--bg-dark)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  {selectedApp.business_summary || "No business summary provided."}
                </p>
              </div>

              {/* Similarity checks */}
              {selectedApp.similarity_matches && selectedApp.similarity_matches.length > 0 && (
                <div>
                  <h4 style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={13} color="var(--danger)" />
                    Similar Startup Ideas ({selectedApp.similarity_matches.filter(m => m.similarity_score >= 80).length} High matches)
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedApp.similarity_matches.map((match, idx) => {
                      const isHigh = match.similarity_score >= 80;
                      return (
                        <div key={idx} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.76rem",
                          padding: "6px 10px",
                          borderRadius: "4px",
                          background: isHigh ? "#FEF2F2" : "var(--bg-dark)",
                          border: `1px solid ${isHigh ? "#FCA5A5" : "var(--border-color)"}`,
                          color: isHigh ? "#991B1B" : "var(--text-primary)"
                        }}>
                          <span>{match.startup_name}</span>
                          <span style={{ fontWeight: 800 }}>{match.similarity_score}% Similar</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths and Weaknesses */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <h4 style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle size={13} color="#10B981" /> Strengths
                  </h4>
                  <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedApp.evaluation?.strengths?.map((str, idx) => (
                      <li key={idx}>{str}</li>
                    )) || <li>No analysis generated</li>}
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <AlertTriangle size={13} color="#D97706" /> Weaknesses
                  </h4>
                  <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedApp.evaluation?.weaknesses?.map((weak, idx) => (
                      <li key={idx}>{weak}</li>
                    )) || <li>No analysis generated</li>}
                  </ul>
                </div>
              </div>

              {/* Metadata */}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.76rem", color: "var(--text-dim)" }}>
                <div>
                  Team Size: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedApp.team_size} members</span>
                </div>
                <div>
                  Competitors: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedApp.competitors || "None listed"}</span>
                </div>
                {selectedApp.website && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    Website: <a href={selectedApp.website.startsWith("http") ? selectedApp.website : `https://${selectedApp.website}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      {selectedApp.website} <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}

      {/* ─── FIXED SELECTION ACTION BAR ─────────────────────────── */}
      {checkedIds.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--text-primary)",
          color: "white",
          borderRadius: "var(--radius-full)",
          padding: "12px 24px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          gap: "18px",
          zIndex: 999,
          animation: "fadeSlideUp 0.3s ease-out"
        }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
            {checkedIds.length} Selected
          </span>
          
          <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.2)" }} />

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setShowCompareModal(true)}
              disabled={compareStartupsList.length < 2}
              className="btn btn-primary"
              style={{ padding: "6px 14px", height: "30px", fontSize: "0.78rem" }}
              title="Select 2 or 3 startups to compare"
            >
              <BarChart2 size={13} style={{ marginRight: "4px" }} />
              Compare side-by-side
            </button>

            <button
              onClick={() => handleExportToDb(false)}
              disabled={exportingDb}
              className="btn btn-secondary"
              style={{ padding: "6px 14px", height: "30px", fontSize: "0.78rem", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <Database size={13} style={{ marginRight: "4px" }} />
              Import to DB
            </button>

            <button
              onClick={() => handleExportToCampaign(false)}
              disabled={exportingCamp}
              className="btn btn-secondary"
              style={{ padding: "6px 14px", height: "30px", fontSize: "0.78rem", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <Send size={13} style={{ marginRight: "4px" }} />
              Start Outreach
            </button>
          </div>

          <button
            onClick={() => setCheckedIds([])}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", padding: "4px" }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ─── COMPARISON MODAL ─────────────────────────────────────── */}
      {showCompareModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "white",
            borderRadius: "var(--radius-xl)",
            width: "100%",
            maxWidth: "1000px",
            maxHeight: "90vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "var(--shadow-2xl)",
            animation: "fadeSlideUp 0.3s ease-out"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Side-by-Side Startup Comparison
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Comparing {compareStartupsList.length} shortlisted applications.
                </p>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "var(--text-dim)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "24px", overflowY: "auto", display: "grid", gridTemplateColumns: `180px repeat(${compareStartupsList.length}, 1fr)`, gap: "16px" }}>
              
              {/* Row headers */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px", fontWeight: 700, fontSize: "0.82rem", color: "var(--text-muted)", paddingTop: "60px" }}>
                <div style={{ height: "40px" }}>Sector & Stage</div>
                <div style={{ height: "40px" }}>Final Score / Rank</div>
                <div style={{ height: "40px" }}>Rule Score</div>
                <div style={{ height: "40px" }}>Gemini LLM Score</div>
                <div style={{ height: "40px" }}>Revenue / Team</div>
                <div style={{ height: "90px" }}>Recommendation</div>
                <div style={{ height: "120px" }}>Key Strengths</div>
                <div style={{ height: "120px" }}>Key Weaknesses</div>
                <div>Summary Idea</div>
              </div>

              {/* Startup Columns */}
              {compareStartupsList.map((app) => (
                <div key={app._id} style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-lg)",
                  padding: "16px",
                  background: "var(--bg-dark)"
                }}>
                  {/* Name block */}
                  <div style={{ height: "44px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary)" }}>Rank #{app.rank}</span>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={app.startup_name}>
                      {app.startup_name}
                    </h4>
                  </div>

                  {/* Sector / Stage */}
                  <div style={{ height: "40px", fontSize: "0.8rem", color: "var(--text-primary)" }}>
                    <div style={{ fontWeight: 600 }}>{app.sector}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.74rem" }}>{app.stage}</div>
                  </div>

                  {/* Final Score / Rank */}
                  <div style={{ height: "40px" }}>
                    <span style={{ fontSize: "1.15rem", fontWeight: 900, color: "var(--primary)" }}>{app.final_score}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "4px" }}>(Rank {app.rank})</span>
                  </div>

                  {/* Rule Score */}
                  <div style={{ height: "40px", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {app.rule_score} / 100
                  </div>

                  {/* Gemini Score */}
                  <div style={{ height: "40px", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {app.llm_score} / 100
                  </div>

                  {/* Revenue / Team */}
                  <div style={{ height: "40px", fontSize: "0.8rem", color: "var(--text-primary)" }}>
                    <div style={{ fontWeight: 600 }}>{formatCurrency(app.revenue)}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.74rem" }}>{app.team_size} members</div>
                  </div>

                  {/* Recommendation */}
                  <div style={{ height: "90px" }}>
                    {app.evaluation?.recommendation && (
                      <span style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        border: `1px solid ${getRecommendationColor(app.evaluation.recommendation).border}`,
                        background: getRecommendationColor(app.evaluation.recommendation).bg,
                        color: getRecommendationColor(app.evaluation.recommendation).text
                      }}>
                        {app.evaluation.recommendation}
                      </span>
                    )}
                  </div>

                  {/* Strengths */}
                  <div style={{ height: "120px", overflowY: "auto" }}>
                    <ul style={{ paddingLeft: "14px", margin: 0, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {app.evaluation?.strengths?.map((str, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{str}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div style={{ height: "120px", overflowY: "auto" }}>
                    <ul style={{ paddingLeft: "14px", margin: 0, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {app.evaluation?.weaknesses?.map((weak, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{weak}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Summary */}
                  <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", maxHeight: "150px", overflowY: "auto", lineHeight: "1.5" }}>
                    {app.business_summary}
                  </div>

                </div>
              ))}

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border-color)",
              background: "var(--bg-dark)",
              display: "flex",
              justifyContent: "flex-end"
            }}>
              <button className="btn btn-secondary" onClick={() => setShowCompareModal(false)}>
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
