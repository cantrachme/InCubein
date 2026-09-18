import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Search, MapPin, Globe, Mail, Send, X, ExternalLink, ShieldCheck, User, Trash2, Upload } from "lucide-react";

const STAGE_COLORS = {
  "Ideation":       { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  "Prototype":      { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  "MVP/Pre-Revenue": { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA" },
  "Revenue":        { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  "Growth/Scaling": { bg: "#FDF4FF", text: "#86198F", border: "#F0ABFC" },
  "Seed Stage":     { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
};

export default function StartupsDirectory({ onDataChanged }) {
  const [startups, setStartups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  
  // Drawer state
  const [activeDrawerStartup, setActiveDrawerStartup] = useState(null);
  const [addingToCampaign, setAddingToCampaign] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", "startup");

    setUploading(true);
    try {
      const res = await fetch("/api/directory/upload", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (res.ok && result.status === "success") {
        toast.success(result.message);
        fetchStartups();
        onDataChanged?.();
      } else {
        toast.error(result.detail || result.message || "Failed to import spreadsheet.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error during file upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleClearDirectory = async () => {
    if (!window.confirm("Are you sure you want to clear the entire Startups Directory? This is irreversible.")) return;
    try {
      const res = await fetch("/api/startups/clear", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setStartups([]);
      } else {
        toast.error("Failed to clear directory.");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };


  const fetchStartups = async () => {
    setLoading(true);
    try {
      let url = "/api/startups?1=1";
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      if (selectedSector) url += `&sector=${encodeURIComponent(selectedSector)}`;
      if (selectedStage) url += `&funding_stage=${encodeURIComponent(selectedStage)}`;
      if (selectedCity) url += `&hq_city=${encodeURIComponent(selectedCity)}`;
      if (selectedCategory) url += `&stage_category=${encodeURIComponent(selectedCategory)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStartups(data);
      } else {
        toast.error("Failed to load startups.");
      }
    } catch (e) {
      console.error("Error fetching startups:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    const timer = setTimeout(() => {
      fetchStartups();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSector, selectedStage, selectedCity, selectedCategory]);

  const handleAddToCampaign = async (startup) => {
    if (!startup.founders && !startup.startup_name) {
      toast.error("Startup must have a founder name or contact.");
      return;
    }
    
    setAddingToCampaign(true);
    try {
      const res = await fetch("/api/outreach/add-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incubator_id: "incubein_cohort",
          incubator_name: startup.startup_name,
          email: startup.contact_email || startup.email || ""
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Successfully added ${startup.startup_name} to campaign leads!`);
      } else {
        toast.error(data.detail || "Failed to add lead to campaigns.");
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setAddingToCampaign(false);
    }
  };

  // Get filter lists
  const sectors = ["All", ...new Set(startups.map(s => s.sector).filter(Boolean))];
  const stages = ["All", ...new Set(startups.map(s => s.funding_stage).filter(Boolean))];
  const cities = ["All", ...new Set(startups.map(s => s.hq_city).filter(Boolean))];
  const categories = ["All", "Ideation", "Prototype", "MVP/Pre-Revenue", "Revenue", "Growth/Scaling", "Seed Stage"];

  const totalItems = startups.length;
  const isAll = pageSize === "All";
  const limit = isAll ? totalItems : (pageSize || 12);
  const totalPages = isAll || totalItems === 0 ? 1 : Math.ceil(totalItems / limit);
  const startIndex = isAll ? 0 : (currentPage - 1) * limit;
  const endIndex = isAll ? totalItems : Math.min(startIndex + limit, totalItems);
  const paginatedStartups = startups.slice(startIndex, endIndex);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "1rem" }}>
      
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div style={{
        background: "white",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-xl)",
        padding: "20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Startups Directory
          </h2>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
            Browse, search, and manage evaluated and ecosystem startups.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <label className={`btn btn-secondary ${uploading ? "disabled" : ""}`} style={{ cursor: "pointer", margin: 0 }}>
            <Upload size={14} style={{ marginRight: "6px" }} />
            {uploading ? "Importing..." : "Upload CSV / Excel"}
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleUploadFile}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
          {startups.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={handleClearDirectory}
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={14} style={{ marginRight: "6px" }} />
              Reset Directory
            </button>
          )}
        </div>
      </div>

      {/* ─── Control Header ─────────────────────────────────────── */}
      <div style={{
        background: "white",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-xl)",
        padding: "16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "12px",
        alignItems: "center"
      }}>
        {/* Search */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Search Startups</span>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search by name, sector..."
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
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value === "All" ? "" : e.target.value)}
            style={{ height: "36px", fontSize: "0.82rem", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "white" }}
          >
            {sectors.map(sec => <option key={sec} value={sec}>{sec}</option>)}
          </select>
        </div>

        {/* Stage Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Stage</span>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value === "All" ? "" : e.target.value)}
            style={{ height: "36px", fontSize: "0.82rem", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "white" }}
          >
            {stages.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {/* City Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>HQ City</span>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value === "All" ? "" : e.target.value)}
            style={{ height: "36px", fontSize: "0.82rem", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "white" }}
          >
            {cities.map(ct => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>

        {/* Stage Category Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Startup Type</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value === "All" ? "" : e.target.value)}
            style={{ height: "36px", fontSize: "0.82rem", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "white" }}
          >
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading startups...</div>
      ) : startups.length === 0 ? (
        <div style={{
          background: "white",
          border: "1px dashed var(--border-color)",
          borderRadius: "var(--radius-xl)",
          padding: "40px",
          textAlign: "center"
        }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>No Startups Found</h4>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "6px 0" }}>
            Add startups to database via the Cohort Evaluator to populate the list.
          </p>
        </div>
      ) : (
        /* ─── Grid View ──────────────────────────────────────────── */
        (() => {
          const top3Ids = [...startups]
            .filter(s => s.confidence_score !== undefined && s.confidence_score !== null)
            .sort((a, b) => parseFloat(b.confidence_score) - parseFloat(a.confidence_score))
            .slice(0, 3)
            .map(s => s.id);

          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  Showing <strong>{totalItems > 0 ? startIndex + 1 : 0} – {endIndex}</strong> of <strong style={{ color: "var(--text-primary)" }}>{totalItems}</strong> startups
                </span>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px"
              }}>
                {paginatedStartups.map((st) => {
                  const isTop3 = top3Ids.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => setActiveDrawerStartup(st)}
                      style={{
                        background: isTop3 ? "rgba(16, 185, 129, 0.05)" : "white",
                        border: "1px solid var(--border-color)",
                        boxShadow: isTop3 ? "inset 3px 0 0 0 #10b981" : "none",
                        borderRadius: "var(--radius-lg)",
                        padding: "12px",
                        cursor: "pointer",
                        transition: "all var(--transition-base)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                      }}
                      className="card-hover"
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "4px" }}>
                        <span className="badge badge-primary" style={{ fontSize: "0.68rem" }}>
                          {st.sector}
                        </span>
                        {st.stage_category && STAGE_COLORS[st.stage_category] && (
                          <span style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "10px",
                            background: STAGE_COLORS[st.stage_category].bg,
                            color: STAGE_COLORS[st.stage_category].text,
                            border: `1px solid ${STAGE_COLORS[st.stage_category].border}`,
                          }}>
                            {st.stage_category}
                          </span>
                        )}
                        {st.funding_stage && !st.stage_category && (
                          <span className="badge badge-secondary" style={{ fontSize: "0.68rem" }}>
                            {st.funding_stage}
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)" }}>
                        {st.startup_name}
                      </div>

                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", flex: 1 }}>
                        {st.description || "No description provided."}
                      </div>

                      {st.founders && (
                        <div style={{ fontSize: "0.76rem", color: "var(--text-body)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <User size={12} color="var(--primary)" />
                          <span>{st.founders}</span>
                        </div>
                      )}

                      <div style={{
                        borderTop: "1px solid var(--border-color)",
                        paddingTop: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.76rem",
                        color: "var(--text-dim)",
                        marginTop: "auto"
                      }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                          <MapPin size={12} /> {st.hq_city}
                        </span>
                        {st.confidence_score && (
                          <span style={{ fontWeight: 800, color: isTop3 ? "#137333" : "var(--primary)" }}>
                            Score: {st.confidence_score}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: "4px", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-primary btn-icon"
                          style={{ padding: "6px", fontSize: "0.8rem", background: "var(--primary-light)", color: "var(--primary)", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onClick={(e) => { e.stopPropagation(); handleAddToCampaign(st); }}
                          disabled={addingToCampaign}
                          title="Add to Campaign"
                        >
                          {addingToCampaign ? "..." : "+"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      )}

      {/* ─── Pagination Controls ─────────────────────────────── */}
      {!loading && totalItems > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing <strong>{startIndex + 1}</strong> – <strong>{endIndex}</strong> of <strong>{totalItems}</strong> startups
          </div>
          
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={currentPage <= 1 || isAll}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              &laquo; Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, i, arr) => {
                const prevP = arr[i - 1];
                const showEllipsis = prevP && p - prevP > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span style={{ color: "var(--text-dim)", padding: "0 4px" }}>...</span>}
                    <button
                      className={`pagination-btn ${currentPage === p ? "active" : ""}`}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              className="pagination-btn"
              disabled={currentPage >= totalPages || isAll}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              Next &raquo;
            </button>
          </div>

          <div className="pagination-size-select">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === "All" ? "All" : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value="All">All</option>
            </select>
          </div>
        </div>
      )}

      {/* ─── SLIDE OVER DRAWER ──────────────────────────────────── */}
      {activeDrawerStartup && createPortal(
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(2px)",
          zIndex: 1000,
          display: "flex",
          justifyContent: "flex-end"
        }} onClick={() => setActiveDrawerStartup(null)}>
          
          <div style={{
            background: "white",
            width: "100%",
            maxWidth: "400px",
            height: "100%",
            boxShadow: "-10px 0 25px -5px rgba(0,0,0,0.1)",
            padding: "30px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            animation: "slideInRight 0.3s ease-out",
            overflowY: "auto"
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
                  Startup Profile
                </span>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                  {activeDrawerStartup.startup_name}
                </h3>
              </div>
              <button
                onClick={() => setActiveDrawerStartup(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <span className="badge badge-primary">{activeDrawerStartup.sector}</span>
              {activeDrawerStartup.stage_category && STAGE_COLORS[activeDrawerStartup.stage_category] && (
                <span style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: STAGE_COLORS[activeDrawerStartup.stage_category].bg,
                  color: STAGE_COLORS[activeDrawerStartup.stage_category].text,
                  border: `1px solid ${STAGE_COLORS[activeDrawerStartup.stage_category].border}`,
                }}>
                  {activeDrawerStartup.stage_category}
                </span>
              )}
              {!activeDrawerStartup.stage_category && (
                <span className="badge" style={{ background: "var(--bg-dark)" }}>{activeDrawerStartup.funding_stage}</span>
              )}
              {activeDrawerStartup.status && (
                <span style={{ fontSize: "0.72rem", background: "var(--primary-light)", padding: "4px 8px", borderRadius: "4px", color: "var(--primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                  <ShieldCheck size={12} /> {activeDrawerStartup.status}
                </span>
              )}
            </div>

            {/* Attributes List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", padding: "16px 0" }}>
              {activeDrawerStartup.founders && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Founder / Representative</span>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>{activeDrawerStartup.founders}</div>
                </div>
              )}

              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>HQ City</span>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={14} color="var(--primary)" /> {activeDrawerStartup.hq_city}
                </div>
              </div>

              {activeDrawerStartup.confidence_score && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Evaluation Score</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>{activeDrawerStartup.confidence_score}</div>
                </div>
              )}

              {activeDrawerStartup.incubated_at && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Date Registered / Incubated</span>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", marginTop: "2px" }}>{activeDrawerStartup.incubated_at}</div>
                </div>
              )}

              {activeDrawerStartup.source_url && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Source</span>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", marginTop: "2px" }}>{activeDrawerStartup.source_url}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "auto" }}>
              {activeDrawerStartup.website && (
                <a
                  href={activeDrawerStartup.website.startsWith("http") ? activeDrawerStartup.website : `https://${activeDrawerStartup.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ justifyContent: "center" }}
                >
                  <Globe size={14} style={{ marginRight: "6px" }} />
                  Visit Website
                  <ExternalLink size={10} style={{ marginLeft: "4px" }} />
                </a>
              )}

              <button
                className="btn btn-primary"
                onClick={() => handleAddToCampaign(activeDrawerStartup)}
                disabled={addingToCampaign}
                style={{ justifyContent: "center" }}
              >
                <Send size={14} style={{ marginRight: "6px" }} />
                {addingToCampaign ? "Adding Lead..." : "Draft Collaboration sequence"}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
