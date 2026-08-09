import React, { useState } from "react";
import {
  Globe,
  Search,
  Upload,
  Sparkles,
  CheckCircle,
  Building,
  Mail,
  MapPin,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  Database,
  Loader2,
  X
} from "lucide-react";
import { toast } from "react-toastify";

export default function EnrichmentHub() {
  const [entityType, setEntityType] = useState("incubator"); // "incubator" | "startup"
  const [singleName, setSingleName] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [batchCity, setBatchCity] = useState("");
  const [batchState, setBatchState] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [savingAll, setSavingAll] = useState(false);
  const [savingIds, setSavingIds] = useState(new Set());
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState("");

  const handleSingleEnrich = async (e) => {
    e.preventDefault();
    if (!singleName.trim()) {
      toast.warning("Please enter an entity name.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/enrichment/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_name: singleName,
          entity_type: entityType,
          city: cityInput
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        toast.success(`Enriched data for "${singleName}" successfully!`);
        setResults((prev) => [data.data, ...prev]);
        setSingleName("");
      } else {
        toast.error(data.detail || "Enrichment failed.");
      }
    } catch (err) {
      toast.error("Error connecting to enrichment engine.");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchEnrich = async () => {
    const names = batchInput
      .split("\n")
      .map((n) => (n.strip ? n.strip() : n.trim()))
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      toast.warning("Please enter at least one entity name.");
      return;
    }
    if (names.length > 500) {
      toast.warning("Maximum 500 names per batch. Please split your list.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/enrichment/batch-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_names: names,
          entity_type: entityType,
          city: batchCity,
          state: batchState
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        toast.success(`Batch enriched ${data.count} entities!`);
        setResults((prev) => [...data.results, ...prev]);
        setImportedCount((prev) => prev + (data.errors ? data.errors.length : 0));
        setBatchInput("");
      } else {
        toast.error(data.detail || data.message || "Batch enrichment failed.");
      }
    } catch (err) {
      toast.error("Error performing batch scraping.");
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", entityType);
    formData.append("city", batchCity);
    formData.append("state", batchState);

    setLoading(true);
    try {
      const res = await fetch("/api/enrichment/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        toast.success(`Enriched ${data.count} entities from "${file.name}"!`);
        setResults((prev) => [...data.results, ...prev]);
        setFileName("");
      } else {
        toast.error(data.detail || data.message || "Failed to process Excel file.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error during Excel upload.");
    } finally {
      setLoading(false);
    }
  };

  const saveResult = async (res, idx) => {
    setSavingIds((prev) => new Set(prev).add(idx));
    try {
      const response = await fetch("/api/enrichment/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, results: [res] }),
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        toast.success(data.message);
      } else {
        toast.error(data.detail || data.message || "Failed to save.");
      }
    } catch (err) {
      toast.error("Network error while saving.");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  const saveAllResults = async () => {
    if (results.length === 0) {
      toast.warning("No enriched results to save.");
      return;
    }
    if (!window.confirm(`Save all ${results.length} enriched ${entityType}(s) to the directory?`)) return;

    setSavingAll(true);
    try {
      const response = await fetch("/api/enrichment/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, results }),
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        toast.success(data.message);
      } else {
        toast.error(data.detail || data.message || "Failed to save results.");
      }
    } catch (err) {
      toast.error("Network error while saving results.");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <div style={{ padding: "8px", borderRadius: "10px", background: "linear-gradient(135deg, #0284C7, #2563EB)", color: "white" }}>
            <Globe size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
              🌐 Web Scraping & Data Enrichment Hub
            </h1>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Mass web enrichment from text lists or Excel files, with one-click save into the ecosystem directory.
            </p>
          </div>
        </div>
      </div>

      {/* Entity Type Switcher */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => setEntityType("incubator")}
          className={`btn ${entityType === "incubator" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "0.88rem" }}
        >
          <Building size={16} /> 🏢 Incubator Network Enrichment
        </button>
        <button
          onClick={() => setEntityType("startup")}
          className={`btn ${entityType === "startup" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "0.88rem" }}
        >
          <Sparkles size={16} /> 🚀 Startup Cohort Enrichment
        </button>
      </div>

      {/* Input Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "28px" }}>
        {/* Single Entity Search */}
        <div className="card" style={{ padding: "20px", background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <Search size={18} color="var(--primary)" /> Single Entity Web Lookup
          </h3>
          <form onSubmit={handleSingleEnrich} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                {entityType === "incubator" ? "Incubator / TBI Name:" : "Startup / Company Name:"}
              </label>
              <input
                type="text"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder={entityType === "incubator" ? "e.g. SINE IIT Bombay, NSRCEL IIMB..." : "e.g. Ideaforge Technology, Agnikul..."}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.85rem" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Location / City (Optional):
              </label>
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="e.g. Mumbai, Pune, Nagpur, Bangalore"
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.85rem" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.85rem", marginTop: "4px" }}
            >
              {loading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
              {loading ? "Searching & Extracting..." : "Scrape & Enrich Details"}
            </button>
          </form>
        </div>

        {/* Batch Entity Scraping */}
        <div className="card" style={{ padding: "20px", background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <FileSpreadsheet size={18} color="#8B5CF6" /> Batch Scrape Entity List
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Enter {entityType === "incubator" ? "Incubator" : "Startup"} Names (1 per line, up to 500):
              </label>
              <textarea
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder={`VNR VJIET TBI\nVNIT Nagpur Centre\nMIT WPU Pune Hub`}
                rows={4}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.82rem", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>City (optional)</label>
                <input
                  type="text"
                  value={batchCity}
                  onChange={(e) => setBatchCity(e.target.value)}
                  placeholder="e.g. Pune"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.82rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>State (optional)</label>
                <input
                  type="text"
                  value={batchState}
                  onChange={(e) => setBatchState(e.target.value)}
                  placeholder="e.g. Maharashtra"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.82rem" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                onClick={handleBatchEnrich}
                disabled={loading}
                className="btn btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.85rem" }}
              >
                {loading ? <RefreshCw size={16} className="spin" /> : <Globe size={16} />}
                {loading ? "Batch Scraping..." : "Run Batch Web Scraper"}
              </button>
              <label className={`btn btn-primary ${loading ? "disabled" : ""}`} style={{ cursor: "pointer", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.85rem" }}>
                <Upload size={16} />
                {loading ? "Uploading..." : "Upload Excel (.xlsx/.xls)"}
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelUpload}
                  disabled={loading}
                  style={{ display: "none" }}
                />
              </label>
            </div>
            {fileName && (
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                <FileSpreadsheet size={12} /> {fileName} uploaded — extracting names...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Discovered Results Table */}
      <div className="card" style={{ padding: "20px", background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
              🔍 Discovered & Enriched Entities ({results.length})
            </h3>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Data mined live from DuckDuckGo search queries and web snippet parsing.
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {results.length > 0 && (
              <>
                <button onClick={saveAllResults} disabled={savingAll} className="btn btn-primary" style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  {savingAll ? <Loader2 size={14} className="spin" /> : <Database size={14} />}
                  {savingAll ? "Saving..." : `Save All ${results.length} to Directory`}
                </button>
                <button onClick={() => setResults([])} className="btn btn-secondary" style={{ fontSize: "0.75rem" }}>
                  Clear Results
                </button>
              </>
            )}
          </div>
        </div>

        {results.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <Globe size={40} style={{ opacity: 0.3, marginBottom: "10px" }} />
            <p style={{ margin: 0, fontSize: "0.88rem" }}>No enriched entities yet. Enter entity names or upload an Excel file above to scrape data.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {results.map((res, idx) => (
              <div key={idx} style={{ padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", background: "#F8FAFC" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {res.entity_name}
                    </h4>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      {res.city}, {res.state}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: "#D1FAE5", color: "#065F46" }}>
                    ⭐ Score: {res.confidence_score}%
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.78rem", color: "var(--text-body)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Mail size={14} color="var(--primary)" />
                    <span style={{ fontWeight: 600 }}>{res.email}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Globe size={14} color="#0284C7" />
                    <a href={res.website} target="_blank" rel="noreferrer" style={{ color: "#0284C7", textDecoration: "underline" }}>
                      {res.website}
                    </a>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <MapPin size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span style={{ fontSize: "0.75rem" }}>{res.address}</span>
                  </div>

                  <div style={{ marginTop: "6px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {(res.focus_areas || []).map((fa, i) => (
                      <span key={i} style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px", background: "#E2E8F0", color: "#334155", fontWeight: 600 }}>
                        {fa}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => saveResult(res, idx)}
                    disabled={savingIds.has(idx) || savingAll}
                    className="btn btn-primary"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", padding: "5px 12px" }}
                  >
                    {savingIds.has(idx) ? <Loader2 size={13} className="spin" /> : <Database size={13} />}
                    {savingIds.has(idx) ? "Saving..." : "Save to Directory"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
