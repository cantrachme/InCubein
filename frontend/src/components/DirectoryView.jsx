import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Search, MapPin, Globe, Mail, Phone, ExternalLink, Calendar, Building, HelpCircle, Layers, FileSignature, Send, X } from "lucide-react";

export default function DirectoryView({ filtersData, onDraftMou }) {
  const [incubators, setIncubators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [sortMode, setSortMode] = useState("name");
  
  // Drawer state
  const [activeDrawerInc, setActiveDrawerInc] = useState(null);

  // Call Scheduler Modal states
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingMessage, setMeetingMessage] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [sendingContact, setSendingContact] = useState(false);
  const [contactStatus, setContactStatus] = useState(null);

  // Fetch incubators based on filters
  const fetchIncubators = async () => {
    setLoading(true);
    try {
      let url = "http://127.0.0.1:8000/api/incubators?1=1";
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      if (selectedState) url += `&state=${encodeURIComponent(selectedState)}`;
      if (selectedCity) url += `&city=${encodeURIComponent(selectedCity)}`;
      if (selectedSector) url += `&sector=${encodeURIComponent(selectedSector)}`;
      if (selectedRegion) url += `&region=${encodeURIComponent(selectedRegion)}`;

      const res = await fetch(url);
      const data = await res.json();
      setIncubators(data);
    } catch (e) {
      console.error("Error fetching incubators:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce fetching if query changes
    const timer = setTimeout(() => {
      fetchIncubators();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedState, selectedCity, selectedSector, selectedRegion]);

  // Editing state for updating contact details
  const [isEditing, setIsEditing] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setIsScheduleModalOpen(false);
    setContactStatus(null);
    if (activeDrawerInc) {
      setEditEmail(activeDrawerInc.email || "");
      setEditWebsite(activeDrawerInc.website || "");
      setMeetingSubject(`Inquiry & Meeting Request: ${activeDrawerInc.name}`);
      setMeetingMessage(`Dear Team,\n\nWe are writing to express interest in exploring incubation and collaboration opportunities at ${activeDrawerInc.name}.\n\nCould we arrange a brief call to discuss this further?\n\nBest regards,\n[Startup Representative]`);
      setMeetingDate("");
      setMeetingTime("");
    }
  }, [activeDrawerInc]);

  const handleSaveContactInfo = async (e) => {
    e.preventDefault();
    if (!activeDrawerInc) return;
    setSavingContact(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/incubators/update-contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: activeDrawerInc.id,
          email: editEmail,
          website: editWebsite
        })
      });
      const data = await response.json();
      if (response.ok) {
        const updatedInc = { ...activeDrawerInc, email: editEmail, website: editWebsite };
        setActiveDrawerInc(updatedInc);
        setIncubators(prev => prev.map(inc => inc.id === updatedInc.id ? updatedInc : inc));
        setIsEditing(false);
      } else {
        toast.error("Error saving contact: " + (data.detail || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to the backend server.");
    } finally {
      setSavingContact(false);
    }
  };

  const handleSendContact = async (e) => {
    e.preventDefault();
    if (!activeDrawerInc) return;
    
    const emailToUse = activeDrawerInc.email || editEmail;
    if (!emailToUse) {
      toast.warning("No email address available for this incubator. Please click 'Edit Contact' to add one first.");
      return;
    }
    
    setSendingContact(true);
    setContactStatus(null);
    
    const postData = {
      incubator_name: activeDrawerInc.name,
      recipient_email: emailToUse,
      subject: meetingSubject,
      message: meetingMessage,
      meeting_date: meetingDate || null,
      meeting_time: meetingTime || null
    };
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/contact/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(postData)
      });
      
      const result = await res.json();
      if (res.ok) {
        if (result.status === "mock_success") {
          setContactStatus({
            type: "mock",
            message: `Message Simulated! [DEVELOPER MOCK MODE] Since SMTP is not configured in env variables, the schedule details were successfully saved to backend file log: f:\\WorkForRTMUN\\backend\\scratch\\contact_sent_log.txt`
          });
        } else {
          setContactStatus({
            type: "success",
            message: "Inquiry and call arrangement request successfully sent via SMTP email!"
          });
        }
      } else {
        setContactStatus({
          type: "error",
          message: `Error sending contact request: ${result.detail || "Server error"}`
        });
      }
    } catch (err) {
      console.error(err);
      setContactStatus({
        type: "error",
        message: "Failed to connect to contact email API endpoint."
      });
    } finally {
      setSendingContact(false);
    }
  };

  const getSortedIncubators = () => {
    let list = [...incubators];
    if (sortMode === "region") {
      const regionOrder = { "North": 1, "South": 2, "West": 3, "East": 4, "Central": 5, "Northeast": 6, "Unknown": 7 };
      list.sort((a, b) => {
        const rA = a.region || "Unknown";
        const rB = b.region || "Unknown";
        return (regionOrder[rA] || 99) - (regionOrder[rB] || 99);
      });
    } else if (sortMode === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // default: sorted by name
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  };

  return (
    <div>
      {/* Filtering Bar */}
      <div className="filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {/* Search */}
        <div style={{ position: "relative", minWidth: "200px", flexGrow: 1 }}>
          <Search size={16} style={{ position: "absolute", left: "10px", top: "12px", color: "var(--text-dim)" }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: "2.25rem", width: "100%" }}
            placeholder="Search by name, source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Regions */}
        <select
          className="filter-select"
          value={selectedRegion}
          onChange={(e) => {
            setSelectedRegion(e.target.value);
            setSelectedState("");
            setSelectedCity("");
          }}
        >
          <option value="">All Regions</option>
          <option value="North">North</option>
          <option value="South">South</option>
          <option value="East">East</option>
          <option value="West">West</option>
          <option value="Central">Central</option>
          <option value="Northeast">Northeast</option>
        </select>

        {/* States */}
        <select
          className="filter-select"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
        >
          <option value="">All States</option>
          {filtersData && filtersData.states && filtersData.states.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Cities */}
        <select
          className="filter-select"
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
        >
          <option value="">All Cities</option>
          {filtersData && filtersData.cities && filtersData.cities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Focus Areas */}
        <select
          className="filter-select"
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
        >
          <option value="">All Sectors</option>
          {filtersData && filtersData.focus_areas && filtersData.focus_areas.map(sec => (
            <option key={sec} value={sec}>{sec}</option>
          ))}
        </select>

        {/* Sort Order */}
        <select
          className="filter-select"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
        >
          <option value="name">Sort: Name (A-Z)</option>
          <option value="region">Sort: Region Partition</option>
        </select>

        {/* Clear Filters Button */}
        {(searchQuery || selectedState || selectedCity || selectedSector || selectedRegion || sortMode !== "name") && (
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setSearchQuery("");
              setSelectedState("");
              setSelectedCity("");
              setSelectedSector("");
              setSelectedRegion("");
              setSortMode("name");
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="empty-state">
          <p>Filtering startup incubators...</p>
        </div>
      ) : incubators.length === 0 ? (
        <div className="empty-state">
          <h3>No Incubators Found</h3>
          <p>Adjust your search queries or select different filters.</p>
        </div>
      ) : (
        <div className="directory-grid">
          {getSortedIncubators().map((inc) => (
            <div 
              key={inc.id} 
              className="glass-card directory-card"
              style={{ cursor: "pointer" }}
              onClick={() => setActiveDrawerInc(inc)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ 
                  fontSize: "0.75rem", 
                  padding: "2px 8px", 
                  borderRadius: "4px", 
                  background: "rgba(6, 182, 212, 0.12)", 
                  color: "var(--secondary)", 
                  fontWeight: 600 
                }}>
                  {inc.region || "Unknown"}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Source: {inc.source_url || "Excel"}
                </span>
              </div>
              
              <h2 className="card-title">{inc.name}</h2>
              <p className="card-description">{inc.description}</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", margin: "1rem 0", padding: "0.75rem 0", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)" }}>
                {inc.website && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                    <Globe size={14} style={{ color: "var(--secondary)", flexShrink: 0 }} />
                    <a href={inc.website.startsWith("http") ? inc.website : `https://${inc.website}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--text-primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inc.website}
                    </a>
                  </div>
                )}
                {inc.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                    <Mail size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    <a href={`mailto:${inc.email}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--text-primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inc.email}
                    </a>
                  </div>
                )}
              </div>
              
              <div className="card-meta">
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <MapPin size={12} style={{ color: "var(--primary)" }} />
                  <span>{inc.city ? `${inc.city}, ` : ""}{inc.state}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer Details Overlay */}
      {activeDrawerInc && (
        <div className="drawer-backdrop" onClick={() => setActiveDrawerInc(null)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setActiveDrawerInc(null)}>✕ Close</button>
            
            <div className="drawer-header">
              <h2 style={{ fontSize: "1.75rem", fontWeight: "800", color: "white", marginBottom: "0.5rem" }}>{activeDrawerInc.name}</h2>
              <div style={{ display: "flex", gap: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <MapPin size={14} style={{ color: "var(--primary)" }} />
                  <span>{activeDrawerInc.city ? `${activeDrawerInc.city}, ` : ""}{activeDrawerInc.state}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ 
                    fontSize: "0.75rem", 
                    padding: "2px 8px", 
                    borderRadius: "4px", 
                    background: "rgba(6, 182, 212, 0.12)", 
                    color: "var(--secondary)", 
                    fontWeight: 600 
                  }}>
                    {activeDrawerInc.region || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Draft MOU & Schedule Call */}
            <div className="drawer-section" style={{ borderTop: "none", display: "flex", gap: "0.75rem", paddingBottom: "1.25rem", paddingTop: "0" }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.6rem" }}
                onClick={() => {
                  if (onDraftMou) {
                    onDraftMou(activeDrawerInc.name);
                  }
                }}
              >
                <FileSignature size={16} />
                <span>Draft & Sign MOU</span>
              </button>
              
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.6rem" }}
                onClick={() => setIsScheduleModalOpen(true)}
              >
                <Calendar size={16} />
                <span>Contact / Arrange Call</span>
              </button>
            </div>

            {/* Description */}
            <div className="drawer-section" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.25rem" }}>
              <h3>About</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: "1.6" }}>{activeDrawerInc.description}</p>
            </div>

            {/* Contact Details */}
            <div className="drawer-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0 }}>Contact Info</h3>
                {!isEditing && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} 
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Contact
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveContactInfo} style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "0.25rem", color: "var(--text-dim)" }}>Website URL</label>
                      <input 
                        type="text" 
                        className="search-input" 
                        style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem", background: "#f8fafc", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        placeholder="e.g. https://sine.iitb.ac.in"
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "0.25rem", color: "var(--text-dim)" }}>Email Address</label>
                      <input 
                        type="email" 
                        className="search-input" 
                        style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem", background: "#f8fafc", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="e.g. contact@domain.org"
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button 
                      type="button"
                      className="btn btn-secondary" 
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                      onClick={() => setIsEditing(false)}
                      disabled={savingContact}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="btn btn-primary" 
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                      disabled={savingContact}
                    >
                      {savingContact ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="details-grid">
                  <div>
                    <div className="detail-item-label">Website</div>
                    {activeDrawerInc.website ? (
                      <div className="detail-item-val">
                        <a href={activeDrawerInc.website.startsWith("http") ? activeDrawerInc.website : `https://${activeDrawerInc.website}`} target="_blank" rel="noreferrer" style={{ color: "var(--secondary)", display: "flex", alignItems: "center", gap: "0.25rem", textDecoration: "none" }}>
                          <Globe size={14} />
                          <span>{activeDrawerInc.website}</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ) : (
                      <div className="detail-item-val" style={{ color: "var(--text-dim)", fontStyle: "italic", fontSize: "0.85rem" }}>
                        Not Available
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="detail-item-label">Email</div>
                    {activeDrawerInc.email ? (
                      <div className="detail-item-val">
                        <a href={`mailto:${activeDrawerInc.email}`} style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.25rem", textDecoration: "none" }}>
                          <Mail size={14} />
                          <span>{activeDrawerInc.email}</span>
                        </a>
                      </div>
                    ) : (
                      <div className="detail-item-val" style={{ color: "var(--text-dim)", fontStyle: "italic", fontSize: "0.85rem" }}>
                        Not Available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Focus Sectors */}
            <div className="drawer-section">
              <h3>Focus Sectors</h3>
              <div className="tag-cloud">
                {activeDrawerInc.focus_areas && activeDrawerInc.focus_areas.map(area => (
                  <span key={area} className="tag-pill" style={{ color: "white", borderColor: "rgba(139, 92, 246, 0.4)", background: "rgba(139, 92, 246, 0.05)" }}>
                    {area}
                  </span>
                ))}
                {(!activeDrawerInc.focus_areas || activeDrawerInc.focus_areas.length === 0) && <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Multi-sector incubator</span>}
              </div>
            </div>

            {/* Source Information */}
            <div className="drawer-section">
              <h3>Funding Source</h3>
              <div className="details-grid">
                <div>
                  <div className="detail-item-label">Scheme / Program Source</div>
                  <div className="detail-item-val" style={{ fontWeight: "600", color: "var(--accent-amber)" }}>{activeDrawerInc.source_url || "Excel"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule / Contact Modal */}
      {isScheduleModalOpen && activeDrawerInc && (
        <div className="drawer-backdrop" style={{ zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setIsScheduleModalOpen(false)}>
          <div className="glass-card" style={{ width: "90%", maxWidth: "550px", padding: "2rem", background: "#ffffff", border: "1px solid var(--border-color)", boxShadow: "0 20px 40px rgba(0,0,0,0.1)", zIndex: 10001 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "var(--primary)", fontWeight: 800 }}>
                📅 Contact & Schedule Call
              </h3>
              <button 
                type="button" 
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)" }} 
                onClick={() => setIsScheduleModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSendContact} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)" }}>Recipient Email</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={activeDrawerInc.email || editEmail || ""} 
                  disabled 
                  style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                />
              </div>
              
              <div className="form-group">
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)" }}>Subject</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={meetingSubject} 
                  onChange={(e) => setMeetingSubject(e.target.value)} 
                  required
                />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)" }}>Proposed Date (Optional)</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={meetingDate} 
                    onChange={(e) => setMeetingDate(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)" }}>Proposed Time (Optional)</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={meetingTime} 
                    onChange={(e) => setMeetingTime(e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)" }}>Message Body</label>
                <textarea 
                  className="form-input" 
                  style={{ minHeight: "120px", fontFamily: "inherit" }}
                  value={meetingMessage} 
                  onChange={(e) => setMeetingMessage(e.target.value)} 
                  required
                />
              </div>
              
              {contactStatus && (
                <div style={{ 
                  padding: "0.75rem", 
                  borderRadius: "8px", 
                  fontSize: "0.85rem",
                  lineHeight: "1.4",
                  background: contactStatus.type === "error" ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)",
                  color: contactStatus.type === "error" ? "var(--accent-red)" : "var(--accent-green)",
                  border: `1px solid ${contactStatus.type === "error" ? "rgba(220,38,38,0.2)" : "rgba(22,163,74,0.2)"}`
                }}>
                  {contactStatus.message}
                </div>
              )}
              
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={sendingContact}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                >
                  {sendingContact ? "Sending..." : "Send Request"}
                  <Send size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

