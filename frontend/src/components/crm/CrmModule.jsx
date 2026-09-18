import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { Plus, Search, Pencil, Trash2, RefreshCw, Inbox, Filter } from "lucide-react";
import { listModule, createRecord, updateRecord, deleteRecord, getRefs } from "../../lib/crmApi";
import { getModuleConfig } from "../../config/crmConfig";
import { Card, Cell, Modal, Loading, Empty, fmtNum, SyncButton } from "./CrmUi";

export default function CrmModule({ module }) {
  const config = useMemo(() => getModuleConfig(module), [module]);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState({ startups: [], colleges: [] });
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchRefs = useCallback(async () => {
    try {
      setRefs(await getRefs());
    } catch {
      /* refs optional */
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listModule(module, { q, filters });
      setRecords(data.records || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [module, q, filters]);

  useEffect(() => {
    fetchRefs();
  }, [fetchRefs]);

  useEffect(() => {
    setPage(1);
    const t = setTimeout(fetchRecords, 250);
    return () => clearTimeout(t);
  }, [fetchRecords]);

  if (!config) {
    return <Empty title="Unknown module" sub={`No configuration exists for module "${module}".`} />;
  }

  const filterOptions = {};
  for (const key of config.filters || []) {
    const vals = [...new Set(records.map((r) => r[key]).filter((v) => v && v !== "All"))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    filterOptions[key] = vals;
  }

  const totalItems = records.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;
  const pageRecords = records.slice(start, start + pageSize);

  const openCreate = () => {
    const init = { ...(config.defaults || {}) };
    for (const f of config.fields) {
      if (init[f.key] === undefined) init[f.key] = "";
    }
    setEditing(null);
    setForm(init);
    setFormOpen(true);
  };

  const openEdit = (rec) => {
    const init = {};
    for (const f of config.fields) {
      init[f.key] = rec[f.key] ?? "";
    }
    setEditing(rec);
    setForm(init);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) {
        await updateRecord(module, editing.id, payload);
        toast.success(`${config.singular} updated.`);
      } else {
        await createRecord(module, payload);
        toast.success(`${config.singular} created.`);
      }
      setFormOpen(false);
      fetchRecords();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rec) => {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()} record? This cannot be undone.`)) return;
    try {
      await deleteRecord(module, rec.id);
      toast.success(`${config.singular} deleted.`);
      fetchRecords();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const renderField = (f) => {
    const val = form[f.key] ?? "";
    const common = {
      value: val,
      onChange: (e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value })),
      style: { height: 36, padding: "0 10px", width: "100%", border: "1px solid var(--border-color)", borderRadius: 8, fontSize: "0.82rem", background: "white", color: "var(--text-primary)" },
    };
    if (f.type === "textarea") {
      return (
        <textarea
          {...common}
          value={val}
          style={Object.assign(common.style, { height: 80, resize: "vertical", padding: "8px 10px" })}
        />
      );
    }
    if (f.type === "select") {
      return (
        <select {...common}>
          <option value="">— Select —</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === "ref") {
      const items = refs[f.ref] || [];
      return (
        <select {...common}>
          <option value="">— Select —</option>
          {items.map((o) => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
        </select>
      );
    }
    if (f.type === "num-money" || f.type === "money") {
      return <input type="number" step="any" {...common} />;
    }
    if (f.type === "number") {
      return <input type="number" {...common} />;
    }
    if (f.type === "date") {
      return <input type="date" {...common} />;
    }
    return <input type="text" placeholder={f.placeholder || ""} {...common} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div className="filter-bar" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="field-group" style={{ minWidth: 220 }}>
            <span className="field-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><Search size={11} /> Search</span>
            <input
              className="form-input"
              style={{ height: 36, fontSize: "0.82rem" }}
              placeholder={`Search ${config.label.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {(config.filters || []).map((key) => (
            <div className="field-group" key={key} style={{ minWidth: 140 }}>
              <span className="field-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><Filter size={11} /> {key.replace(/_/g, " ")}</span>
              <select
                className="form-select"
                style={{ height: 36, fontSize: "0.82rem" }}
                value={filters[key] || "All"}
                onChange={(e) => setFilters((prev) => ({ ...prev, [key]: e.target.value === "All" ? "" : e.target.value }))}
              >
                <option value="All">All</option>
                {filterOptions[key].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <SyncButton />
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} /> Add {config.singular}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Loading label={`Loading ${config.label}…`} />
      ) : records.length === 0 ? (
        <Card>
          <Empty title={`No ${config.label} found`} sub="Try changing the search or filters, or add a new record." />
        </Card>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                {config.columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th style={{ width: 88, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords.map((rec, idx) => (
                <tr key={rec.id}>
                  <td style={{ color: "var(--text-dim)", fontWeight: 600 }}>{start + idx + 1}</td>
                  {config.columns.map((c) => (
                    <td key={c.key}><Cell rec={rec} col={c} /></td>
                  ))}
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => openEdit(rec)}>
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      title="Delete"
                      style={{ color: "var(--danger)" }}
                      onClick={() => handleDelete(rec)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalItems > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing <strong>{start + 1}</strong> – <strong>{Math.min(start + pageSize, totalItems)}</strong> of <strong>{totalItems}</strong> records
          </div>
          <div className="pagination-controls">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>&laquo; Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, i, arr) => {
                const prevP = arr[i - 1];
                return (
                  <React.Fragment key={p}>
                    {prevP && p - prevP > 1 && <span style={{ color: "var(--text-dim)", padding: "0 4px" }}>…</span>}
                    <button className={`pagination-btn ${page === p ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                  </React.Fragment>
                );
              })}
            <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next &raquo;</button>
          </div>
          <div className="pagination-size-select">
            <span>Per page:</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[10, 15, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn btn-ghost btn-icon" title="Refresh" onClick={fetchRecords}><RefreshCw size={14} /></button>
          </div>
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={`${editing ? "Edit" : "Add"} ${config.singular}`}
        width={720}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {config.fields.map((f) => (
            <div className="form-group" key={f.key}>
              <label>{f.label}</label>
              {renderField(f)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : `Create ${config.singular}`}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export function ModuleTotals({ counts }) {
  if (!counts) return null;
  const items = Object.entries(counts);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map(([k, v]) => (
        <span key={k} className="badge badge-neutral" style={{ textTransform: "none" }}>
          <Inbox size={11} /> {k}: {fmtNum(v)}
        </span>
      ))}
    </div>
  );
}