import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Search, MapPin, Globe, Mail, Phone, ExternalLink, Calendar, Building, HelpCircle, Layers, FileSignature, Send, X, Trash2, Upload } from "lucide-react";

export default function DirectoryView({ filtersData, onDraftMou }) {
  const [incubators, setIncubators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [sortMode, setSortMode] = useState("name");
  const [uploading, setUploading] = useState(false);

  const handleUploadExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", "incubator");

    setUploading(true);
    try {
      const res = await fetch("/api/directory/upload", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (res.ok && result.status === "success") {
        toast.success(result.message);
        fetchIncubators();
      } else {
        toast.error(result.detail || result.message || "Failed to import Excel file.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error during file upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleClearDirectory = async () => {
    if (!window.confirm("Are you sure you want to clear the entire Incubators Directory? This is irreversible.")) return;
    try {
      const res = await fetch("/api/incubators/clear", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIncubators([]);
      } else {
        toast.error("Failed to clear directory.");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };

  
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
  const [addingLeadId, setAddingLeadId] = useState(null);

  const handleAddToCampaign = async (inc) => {
    setAddingLeadId(inc.id);
    try {
      const res = await fetch("/api/outreach/add-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incubator_id: inc.id.toString(),
          incubator_name: inc.name,
          email: inc.email || ""
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Successfully added ${inc.name} to campaign leads!`);
      } else {
        toast.error(data.detail || "Failed to add lead to campaigns.");
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setAddingLeadId(null);
    }
  };

  const fetchIncubators = async () => {
    setLoading(true);
    try {
      let url = "/api/incubators?1=1";
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
      const response = await fetch("/api/incubators/update-contact", {
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
      const res = await fetch("/api/contact/send", {
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

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedState, selectedCity, selectedSector, selectedRegion, sortMode]);

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

  const sortedIncubators = getSortedIncubators();
  const totalItems = sortedIncubators.length;
  const isAll = pageSize === "All";
  const limit = isAll ? totalItems : (pageSize || 12);
  const totalPages = isAll || totalItems === 0 ? 1 : Math.ceil(totalItems / limit);
  const startIndex = isAll ? 0 : (currentPage - 1) * limit;
  const endIndex = isAll ? totalItems : Math.min(startIndex + limit, totalItems);
  const paginatedIncubators = sortedIncubators.slice(startIndex, endIndex);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
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
            Incubators Directory
          </h2>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
            Discover and search academic, government, and private TBIs.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <label className={`btn btn-secondary ${uploading ? "disabled" : ""}`} style={{ cursor: "pointer", margin: 0 }}>
            <Upload size={14} style={{ marginRight: "6px" }} />
            {uploading ? "Importing..." : "Upload Excel"}
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleUploadExcel}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
          {incubators.length > 0 && (
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

      {/* Filtering Bar */}
      <div className="filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>

        {/* Search Input */}
        <div style={{ flex: "1 1 200px", minWidth: 200, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search incubators by name, head, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>

        {/* State Filter */}
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          style={{ height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "0 12px", fontSize: "0.85rem", background: "white" }}
        >
          <option value="">All States</option>
          {filtersData?.states?.map(st => <option key={st} value={st}>{st}</option>)}
        </select>

        {/* City Filter */}
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          style={{ height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "0 12px", fontSize: "0.85rem", background: "white" }}
        >
          <option value="">All Cities</option>
          {filtersData?.cities?.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Sector Filter */}
        <select
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
          style={{ height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "0 12px", fontSize: "0.85rem", background: "white" }}
        >
          <option value="">All Focus Sectors</option>
          {filtersData?.focus_areas?.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Region Filter */}
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          style={{ height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "0 12px", fontSize: "0.85rem", background: "white" }}
        >
          <option value="">All Regions</option>
          {filtersData?.regions?.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Sorting mode */}
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          style={{ height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "0 12px", fontSize: "0.85rem", background: "white" }}
        >
          <option value="name">Sort by Name (A-Z)</option>
          <option value="region">Sort by Region</option>
        </select>

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
              setCurrentPage(1);
            }}
          >
            Reset Filters
          </button>
        )}
      </div>      

      {/* Result count */}
      {!loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 500 }}>
            Showing <strong>{totalItems > 0 ? startIndex + 1 : 0} – {endIndex}</strong> of <strong style={{ color: "var(--text-primary)" }}>{totalItems}</strong> incubators
            {(searchQuery || selectedState || selectedCity || selectedSector || selectedRegion) && " (filtered)"}
          </span>
        </div>
      )}

      {/* Main Grid View */}
      {loading ? (
        <div className="directory-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ background: "white", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", padding: 22 }}>
              <div className="skeleton skeleton-text" style={{ width: "30%", marginBottom: 14 }} />
              <div className="skeleton skeleton-title" style={{ width: "80%", marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: "100%" }} />
              <div className="skeleton skeleton-text" style={{ width: "90%", marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <div className="skeleton" style={{ flex: 1, height: 34, borderRadius: 8 }} />
                <div className="skeleton" style={{ flex: 1, height: 34, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      ) : sortedIncubators.length === 0 ? (
        <div className="empty-state">
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid var(--border-color)" }}>
            <Building size={24} color="var(--text-dim)" />
          </div>
          <h3>No Incubators Found</h3>
          <p>Adjust your search queries or select different filters.</p>
        </div>
      ) : (
        <div className="directory-grid">
          {paginatedIncubators.map((inc, idx) => {
            const orgType = (inc.source_url || "").toLowerCase().includes("gov") ? "government" : 
                           (inc.source_url || "").toLowerCase().includes("corp") ? "corporate" : "academic";
            return (
            <div
              key={inc.id}
              className={`directory-card type-${orgType}`}
              style={{ cursor: "pointer", animation: `fadeSlideUp 0.35s var(--ease-out) ${idx * 0.03}s both` }}
              onClick={() => setActiveDrawerInc(inc)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%", minHeight: "60px", padding: "10px" }}>
                <h2 className="card-title" style={{ margin: 0, flex: 1, fontSize: "1.1rem" }}>{inc.name}</h2>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    className="btn btn-primary btn-icon"
                    style={{ padding: 0, fontSize: "1rem", background: "var(--primary-light)", color: "var(--primary)", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={(e) => { e.stopPropagation(); handleAddToCampaign(inc); }}
                    disabled={addingLeadId === inc.id}
                    title="Add to Campaign"
                  >
                    {addingLeadId === inc.id ? "..." : "+"}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "5px 16px", fontSize: "0.85rem" }}
                    onClick={(e) => { e.stopPropagation(); setActiveDrawerInc(inc); }}
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ─── Pagination Controls ─────────────────────────────── */}
      {!loading && totalItems > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing <strong>{startIndex + 1}</strong> – <strong>{endIndex}</strong> of <strong>{totalItems}</strong> incubators
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

      {/* Drawer Details Overlay */}
      {activeDrawerInc && createPortal(
        <div className="drawer-backdrop" onClick={() => setActiveDrawerInc(null)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span className="badge badge-primary">{activeDrawerInc.region || "India"}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{activeDrawerInc.source_url || "Excel DB"}</span>
                </div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.2 }}>{activeDrawerInc.name}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <MapPin size={13} color="var(--primary)" />
                  {activeDrawerInc.city ? `${activeDrawerInc.city}, ` : ""}{activeDrawerInc.state}
                </div>
              </div>
              <button className="drawer-close" onClick={() => setActiveDrawerInc(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="drawer-body">


              {/* About */}
              <div className="drawer-section" style={{ borderTop: "none", paddingTop: 0 }}>
                <h3>About</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-body)", lineHeight: 1.65 }}>{activeDrawerInc.description || "No description available."}</p>
              </div>

              {/* Contact Details */}
              <div className="drawer-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ margin: 0 }}>Contact Info</h3>
                  {!isEditing && (
                    <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.75rem" }} onClick={() => setIsEditing(true)}>
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <form onSubmit={handleSaveContactInfo} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="form-group">
                        <label>Website URL</label>
                        <input type="text" className="form-input" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://example.org" />
                      </div>
                      <div className="form-group">
                        <label>Email Address</label>
                        <input type="email" className="form-input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="contact@domain.org" />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={savingContact}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={savingContact}>{savingContact ? "Saving..." : "Save Changes"}</button>
                    </div>
                  </form>
                ) : (
                  <div className="details-grid">
                    <div>
                      <div className="detail-item-label">Website</div>
                      {activeDrawerInc.website ? (
                        <div className="detail-item-val">
                          <a href={activeDrawerInc.website.startsWith("http") ? activeDrawerInc.website : `https://${activeDrawerInc.website}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: 5, textDecoration: "none", fontSize: "0.85rem" }}>
                            <Globe size={13} />{activeDrawerInc.website.replace(/https?:\/\//, "")}<ExternalLink size={11} />
                          </a>
                        </div>
                      ) : <div className="detail-item-val" style={{ color: "var(--text-dim)", fontStyle: "italic" }}>Not Available</div>}
                    </div>
                    <div>
                      <div className="detail-item-label">Email</div>
                      {activeDrawerInc.email ? (
                        <div className="detail-item-val">
                          <a href={`mailto:${activeDrawerInc.email}`} style={{ color: "var(--text-body)", display: "flex", alignItems: "center", gap: 5, textDecoration: "none", fontSize: "0.85rem" }}>
                            <Mail size={13} />{activeDrawerInc.email}
                          </a>
                        </div>
                      ) : <div className="detail-item-val" style={{ color: "var(--text-dim)", fontStyle: "italic" }}>Not Available</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Focus Sectors */}
              <div className="drawer-section">
                <h3>Focus Sectors</h3>
                <div className="tag-cloud">
                  {activeDrawerInc.focus_areas?.map(area => (
                    <span key={area} className="tag-pill">{area}</span>
                  ))}
                  {(!activeDrawerInc.focus_areas || activeDrawerInc.focus_areas.length === 0) && (
                    <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Multi-sector incubator</span>
                  )}
                </div>
              </div>

              {/* Source */}
              <div className="drawer-section">
                <h3>Data Source</h3>
                <div className="detail-item-val">
                  <span className="badge badge-warning">{activeDrawerInc.source_url || "Excel DB"}</span>
                </div>
              </div>
            </div>{/* end drawer-body */}
          </div>
        </div>,
        document.body
      )}

      {/* Schedule / Contact Modal */}
      {isScheduleModalOpen && activeDrawerInc && (
        <div className="modal-backdrop" style={{ zIndex: 10000 }} onClick={() => setIsScheduleModalOpen(false)}>
          <div className="modal-card" style={{ zIndex: 10001, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "1px solid var(--border-color)", paddingBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)", fontWeight: 800 }}>
                  Contact & Schedule Call
                </h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 3 }}>{activeDrawerInc.name}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsScheduleModalOpen(false)}>
                <X size={18} />
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
        </div>,
        document.body
      )}
    </div>
  );
}

