import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Search, MapPin, Globe, Mail, Send, X, ExternalLink, ShieldCheck, User, Trash2 } from "lucide-react";

export default function StartupsDirectory() {
  const [startups, setStartups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  
  // Drawer state
  const [activeDrawerStartup, setActiveDrawerStartup] = useState(null);
  const [addingToCampaign, setAddingToCampaign] = useState(false);

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
    const timer = setTimeout(() => {
      fetchStartups();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSector, selectedStage, selectedCity]);

  const handleAddToCampaign = async (startup) => {
    if (!startup.founders && !startup.startup_name) {
      toast.error("Startup must have a founder name or contact.");
      return;
    }
    
    // Check if we have email info. Since the startups collection stores decrypted cohort entries,
    // let's try to fetch its email from evaluator database or use a placeholder if empty.
    // If it's a cohort startup, we can call the campaigns api directly with this startup name
    setAddingToCampaign(true);
    try {
      // Find the email dynamically. In standard scraped startups, they might have email,
      // for cohort startups they definitely had email. Let's send a request to add lead.
      // We can generate a dummy email founder@name.com if no email exists, or ask for email.
      const defaultEmail = `${startup.founders?.toLowerCase().replace(/\s+/g, "") || "founder"}@${startup.startup_name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
      
      const res = await fetch("/api/outreach/add-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incubator_id: "incubein_cohort",
          incubator_name: startup.startup_name,
          email: defaultEmail
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
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px"
        }}>
          {startups.map((st) => (
            <div
              key={st.id}
              onClick={() => setActiveDrawerStartup(st)}
              style={{
                background: "white",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-lg)",
                padding: "18px",
                cursor: "pointer",
                transition: "all var(--transition-base)",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}
              className="card-hover"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="badge badge-primary" style={{ fontSize: "0.68rem" }}>
                  {st.sector}
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 700 }}>
                  {st.funding_stage}
                </span>
              </div>

              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", margin: "4px 0" }}>
                  {st.startup_name}
                </h3>
                {st.founders && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <User size={12} />
                    <span>{st.founders}</span>
                  </div>
                )}
              </div>

              <div style={{
                borderTop: "1px solid var(--border-color)",
                paddingTop: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.76rem",
                color: "var(--text-dim)"
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <MapPin size={12} /> {st.hq_city}
                </span>
                {st.confidence_score && (
                  <span style={{ fontWeight: 800, color: "var(--primary)" }}>
                    Score: {st.confidence_score}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── SLIDE OVER DRAWER ──────────────────────────────────── */}
      {activeDrawerStartup && (
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
              <span className="badge" style={{ background: "var(--bg-dark)" }}>{activeDrawerStartup.funding_stage}</span>
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
        </div>
      )}

    </div>
  );
}
