import React, { useState } from "react";
import { Compass, Sparkles, MapPin, Award, CheckCircle, ArrowRight, Building } from "lucide-react";

const SECTORS = [
  "AI", "ML", "Web3", "FinTech", "HealthTech", "AgriTech", "EdTech", 
  "ClimateTech", "DeepTech", "SaaS", "IoT", "SpaceTech", "DefenceTech", 
  "Manufacturing", "Biotech", "Clean Energy"
];

const STAGES = ["Idea", "Pre-Seed", "Seed", "Series A", "Series B", "Growth"];

const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Karnataka", 
  "Kerala", "Madhya Pradesh", "Maharashtra", "Meghalaya", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal"
];

export default function OpportunityFinder({ onDraftMou }) {
  const [formData, setFormData] = useState({
    startupName: "",
    sector: "AI",
    hqCity: "",
    state: "Maharashtra",
    stage: "Seed"
  });

  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/incubators/find-matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startup_name: formData.startupName,
          sector: formData.sector,
          hq_city: formData.hqCity,
          stage: formData.stage,
          state: formData.state
        })
      });
      const data = await response.json();
      setMatches(data);
      setSubmitted(true);
    } catch (err) {
      console.error("Match finding failed:", err);
      alert("Failed to connect to the backend server.");
    } finally {
      setLoading(false);
    }
  };

  const getMeterColor = (score) => {
    if (score >= 80) return "var(--secondary)"; // Teal
    if (score >= 60) return "var(--accent-amber)"; // Saffron
    return "var(--text-dim)"; // Gray
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      <div className="glass-card" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div className="logo-icon" style={{ background: "var(--primary-glow)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Compass size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Startup Opportunities & Incubator Matcher</h2>
            <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>Calculate matching indices and find the right incubation hub for your startup.</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem" }}>
          <div style={{ gridColumn: "span 2" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-primary)" }}>Startup Name</label>
            <input
              type="text"
              name="startupName"
              className="search-input"
              style={{ width: "100%", padding: "0.75rem", background: "#f8fafc", color: "var(--text-primary)" }}
              placeholder="e.g. MyTech Solutions"
              value={formData.startupName}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-primary)" }}>Focus Vertical / Sector</label>
            <select
              name="sector"
              className="filter-select"
              style={{ width: "100%", padding: "0.75rem", background: "#f8fafc", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
              value={formData.sector}
              onChange={handleChange}
            >
              {SECTORS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-primary)" }}>Current Funding Stage</label>
            <select
              name="stage"
              className="filter-select"
              style={{ width: "100%", padding: "0.75rem", background: "#f8fafc", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
              value={formData.stage}
              onChange={handleChange}
            >
              {STAGES.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-primary)" }}>Headquarters City</label>
            <input
              type="text"
              name="hqCity"
              className="search-input"
              style={{ width: "100%", padding: "0.75rem", background: "#f8fafc", color: "var(--text-primary)" }}
              placeholder="e.g. Mumbai"
              value={formData.hqCity}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-primary)" }}>Headquarters State</label>
            <select
              name="state"
              className="filter-select"
              style={{ width: "100%", padding: "0.75rem", background: "#f8fafc", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
              value={formData.state}
              onChange={handleChange}
            >
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <Sparkles size={16} />
              {loading ? "Calculating Matches..." : "Compute Match Index"}
            </button>
          </div>
        </form>
      </div>

      {submitted && (
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary)", marginBottom: "1.25rem" }}>
            Top Incubator Recommendations for {formData.startupName || "your Startup"}
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {matches.map(({ incubator, match_score, reasons }) => (
              <div key={incubator.id} className="glass-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <span className="card-org-tag tag-government" style={{ background: "rgba(30,58,138,0.06)", color: "var(--primary)", borderColor: "rgba(30,58,138,0.15)", marginBottom: "0.5rem" }}>
                      {incubator.organization_type}
                    </span>
                    <h4 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.25rem 0 0.5rem 0" }}>
                      {incubator.name}
                    </h4>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--text-dim)", fontSize: "0.85rem" }}>
                      <MapPin size={14} />
                      <span>{incubator.city}, {incubator.state}</span>
                    </div>
                  </div>

                  {/* Match Gauge */}
                  <div style={{ textAlign: "right", minWidth: "120px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "0.25rem" }}>MATCH INDEX</div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 900, color: getMeterColor(match_score) }}>
                      {match_score}%
                    </div>
                  </div>
                </div>

                {/* Visual score bar */}
                <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${match_score}%`, height: "100%", background: getMeterColor(match_score), transition: "width 1s ease" }}></div>
                </div>

                {/* Matching bullets */}
                <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <Award size={14} style={{ color: "var(--accent-amber)" }} />
                    <span>WHY IT MATCHES</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {reasons.map((r, i) => (
                      <li key={i} style={{ lineHeight: "1.4" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.split(":")[0]}:</span>
                        {r.split(":")[1] || ""}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Draft MOU Action shortcut */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    Focus Areas: {incubator.focus_areas && incubator.focus_areas.slice(0, 4).join(", ")}
                  </div>
                  <button 
                    className="btn btn-outline"
                    style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                    onClick={() => onDraftMou(incubator.name)}
                  >
                    <span>Draft MOU</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
