import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { RotateCcw, Download, Upload, FileDown, PlusCircle } from "lucide-react";

const selectStyle = { height: 36, fontSize: "0.78rem", width: "100%" };
const groupStyle = { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };

export default function ControlCard({
  search = "",
  onSearch,
  startup,
  onStartup,
  startups = [],
  status,
  onStatus,
  statuses = [],
  owner,
  onOwner,
  owners = [],
  priority,
  onPriority,
  priorities = [],
  total,
  shown,
  onReset,
  onExport,
  onTemplate,
  onBulkUpload,
  onAddField,
}) {
  const fileRef = useRef(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const hasFilters = Boolean(search || startup || status || owner || priority);

  const handleFile = async (file) => {
    if (!file || !onBulkUpload) return;
    setBulkBusy(true);
    try {
      await onBulkUpload(file);
    } catch (e) {
      toast.error(e.message || "Bulk upload failed.");
    } finally {
      setBulkBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="filter-bar" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, flex: "1 1 100%", maxWidth: 960 }}>
        <div style={groupStyle}>
          <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-dim)" }}>Search</label>
          <input
            className="form-input"
            style={{ ...selectStyle, paddingLeft: 30 }}
            placeholder="Search startup, item, milestone…"
            value={search}
            onChange={(e) => onSearch && onSearch(e.target.value)}
          />
        </div>
        {onStartup && startups.length > 0 && (
          <div style={groupStyle}>
            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-dim)" }}>Startup</label>
            <select className="form-input" style={selectStyle} value={startup || ""} onChange={(e) => onStartup(e.target.value)}>
              <option value="">All startups</option>
              {startups.map((s) => (
                <option key={s.id} value={s.id}>{s.code ? `${s.code} – ` : ""}{s.name}</option>
              ))}
            </select>
          </div>
        )}
        {onStatus && statuses.length > 0 && (
          <div style={groupStyle}>
            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-dim)" }}>Status</label>
            <select className="form-input" style={selectStyle} value={status || ""} onChange={(e) => onStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {onOwner && owners.length > 0 && (
          <div style={groupStyle}>
            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-dim)" }}>Owner / Responsible</label>
            <select className="form-input" style={selectStyle} value={owner || ""} onChange={(e) => onOwner(e.target.value)}>
              <option value="">All owners</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
        {onPriority && priorities.length > 0 && (
          <div style={groupStyle}>
            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-dim)" }}>Priority</label>
            <select className="form-input" style={selectStyle} value={priority || ""} onChange={(e) => onPriority(e.target.value)}>
              <option value="">All priorities</option>
              {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
        {total !== undefined && (
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", paddingBottom: 8, whiteSpace: "nowrap" }}>
            {shown} of {total}
          </span>
        )}
        {onReset && (
          <button className="btn btn-outline" style={{ height: 36 }} onClick={onReset} disabled={!hasFilters}>
            <RotateCcw size={13} /> Reset
          </button>
        )}
        {onExport && (
          <button className="btn btn-secondary" style={{ height: 36 }} onClick={onExport} title="Export current filtered rows to CSV">
            <Download size={13} /> Export CSV
          </button>
        )}
        {onTemplate && onBulkUpload && (
          <>
            <button className="btn btn-outline" style={{ height: 36 }} onClick={onTemplate} title="Download CSV template">
              <FileDown size={13} /> Template
            </button>
            <button className="btn btn-ghost" style={{ height: 36 }} onClick={() => fileRef.current && fileRef.current.click()} disabled={bulkBusy}>
              <Upload size={13} /> {bulkBusy ? "Uploading…" : "Bulk Upload"}
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
          </>
        )}
        {onAddField && (
          <button className="btn btn-primary" style={{ height: 36, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={onAddField}>
            <PlusCircle size={13} /> Add Custom Field
          </button>
        )}
      </div>
    </div>
  );
}