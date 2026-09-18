import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { CheckCircle2, XCircle, ListTodo, Flag, ShieldAlert, RefreshCw, CalendarClock, Sparkles } from "lucide-react";
import { listModule } from "../lib/crmApi";
import { Pagination, Loading, Empty } from "./crm/CrmUi";
import ControlCard from "./execution/ControlCard";
import { STEP_STATUSES, MILESTONE_STATUSES, RISK_STATUSES, PRIORITIES, STATUS_STYLE, PRIORITY_STYLE, RAG_STYLE, p1toP4, downloadCsv, downloadTemplate, parseCsvFile } from "../lib/executionConfig";

const STEP_STYLE = STATUS_STYLE;
const RISK_STATUS_STYLE = {
  Open: { color: "#d97706", bg: "#FEF3C7" },
  Monitoring: { color: "#2563eb", bg: "#DBEAFE" },
  Mitigating: { color: "#7c3aed", bg: "#EDE9FE" },
  Closed: { color: "#16a34a", bg: "#DCFCE7" },
};

export default function ActionTracker() {
  const [plans, setPlans] = useState([]);
  const [startups, setStartups] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [ownerF, setOwnerF] = useState("");
  const [priorityF, setPriorityF] = useState("");

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const [pl, st] = await Promise.all([
        fetch("/api/crm/action-plans", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
        listModule("startups", {}),
      ]);
      setPlans(pl);
      setStartups(st.records || []);
    } catch (e) {
      setPlansError(e.message);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const startupMap = useMemo(() => {
    const m = {};
    for (const s of startups) m[s.id] = s;
    return m;
  }, [startups]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/crm/action-plans/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to load the action plan.");
      }
      const data = await res.json();
      setDetail(data);
      setDetailLoading(false);
    } catch (e) {
      setDetailError(e.message);
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setPage(1);
    if (selectedPlan) loadDetail(selectedPlan);
  }, [selectedPlan, loadDetail]);

  const patch = async (entity, id, body, successMsg) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/crm/${entity}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(successMsg || "Updated.");
        await loadDetail(selectedPlan);
      } else {
        toast.error(data.detail || `Failed to update ${entity}.`);
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingId(null);
    }
  };

  const setStepStatus = (s, status, reason) =>
    patch("actions", s.id, { status, change_reason: reason || `Marked ${status} in Tracker` }, `Step marked ${status}.`);

  const toggleStep = (s) => {
    if (s.status === "Completed") return setStepStatus(s, "In Progress", "Re-opened from Tracker");
    return setStepStatus(s, "Completed", "Checked off in Tracker");
  };

  const blockStep = (s) => {
    if (s.status === "Blocked") return setStepStatus(s, "In Progress", "Unblocked from Tracker");
    return setStepStatus(s, "Blocked", "Blocked in Tracker");
  };

  const setMilestoneStatus = (m, status) =>
    patch("milestones", m.id, { status, change_reason: `Milestone ${status} in Tracker` }, `Milestone ${status}. Promoted to the Milestones tab.`);

  const setRiskStatus = (r, status) =>
    patch("risks", r.id, { status, change_reason: `Risk ${status} in Tracker` }, `Risk ${status}. Pushed to the Risk Register tab.`);

  const steps = (detail && detail.steps) || [];
  const milestones = (detail && detail.milestones) || [];
  const risks = (detail && detail.risks) || [];
  const plan = detail && detail.plan;

  const ragOf = (item) => {
    if (item && item.rag) return String(item.rag).toUpperCase();
    const status = item.status || "Not Started";
    const today = new Date().toISOString().slice(0, 10);
    if (["Delayed", "Blocked"].includes(status)) return "RED";
    if (["Completed", "Achieved"].includes(status)) return "GREEN";
    if (item.deadline && item.deadline < today) return "RED";
    if (status === "In Progress") return "AMBER";
    return "GREEN";
  };

  const stepOwners = [...new Set(steps.map((s) => s.owner).filter(Boolean))];
  const filteredSteps = steps.filter((s) => {
    const needle = q.trim().toLowerCase();
    if (needle && !(String(s.title || s.action || "").toLowerCase().includes(needle))) return false;
    if (statusF && s.status !== statusF) return false;
    if (ownerF && s.owner !== ownerF) return false;
    if (priorityF && p1toP4(s.priority) !== priorityF) return false;
    return true;
  });

  const exportSteps = () =>
    downloadCsv(`steps-${plan ? plan.id : "plan"}.csv`, filteredSteps, [
      { key: "id", label: "Step ID" },
      { key: "title", label: "Action" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "owner", label: "Owner" },
      { key: "deadline", label: "Deadline" },
      { key: "kpi", label: "KPI" },
      { key: "target", label: "Target" },
      { key: "completed_date", label: "Completed" },
      { key: "rag", label: "RAG" },
    ]);

  const downloadStepTemplate = () =>
    downloadTemplate("action-steps-template.csv", [
      { key: "item_type", label: "item_type" },
      { key: "title", label: "action" },
      { key: "status", label: "status" },
      { key: "priority", label: "priority" },
      { key: "owner", label: "owner" },
      { key: "deadline", label: "deadline" },
      { key: "kpi", label: "kpi" },
      { key: "baseline", label: "baseline" },
      { key: "target", label: "target" },
    ]);

  const handleBulkUpload = async (file) => {
    if (!file || !selectedPlan) return;
    try {
      const rows = await parseCsvFile(file);
      if (!rows.length) {
        toast.warn("The CSV is empty or unreadable.");
        return;
      }
      const res = await fetch(`/api/crm/action-plans/${selectedPlan}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Imported ${data.created && data.created.actions} actions, ${data.created && data.created.milestones} milestones, ${data.created && data.created.risks} risks.`);
        await loadDetail(selectedPlan);
      } else {
        toast.error(data.detail || "Import failed.");
      }
    } catch {
      toast.error("Network error during import.");
    }
  };

  const start = (page - 1) * pageSize;
  const pageSteps = filteredSteps.slice(start, start + pageSize);
  const completedSteps = steps.filter((s) => s.status === "Completed").length;
  const completedMs = milestones.filter((m) => ["Completed", "Achieved"].includes(m.status)).length;
  const openRisks = risks.filter((r) => r.status !== "Closed").length;

  if (plansLoading) return <Loading label="Loading action plans…" />;
  if (plansError) {
    return (
      <div className="empty-state" style={{ maxWidth: 520, margin: "16px auto" }}>
        <h3 style={{ color: "var(--danger)" }}>Couldn't load action plans</h3>
        <p style={{ fontSize: "0.82rem" }}>{plansError}</p>
        <button className="btn btn-primary" onClick={loadPlans} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const summaryStats = [
    { label: "Plan Status", value: plan ? plan.status || "Active" : "—", tone: "var(--text-primary)" },
    { label: "Progress", value: plan ? `${plan.progress_pct || 0}%` : "—", tone: "var(--primary)" },
    { label: "Steps Done", value: steps.length ? `${completedSteps}/${steps.length}` : "0", tone: completedSteps >= steps.length && steps.length ? "var(--success)" : "var(--text-primary)" },
    { label: "Milestones", value: `${completedMs}/${milestones.length}`, tone: "var(--warning)" },
    { label: "Open Risks", value: openRisks, tone: openRisks > 0 ? "var(--danger)" : "var(--success)" },
  ];

  const sectionTitle = (icon, text, count) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
      {icon}
      <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-primary)" }}>{text}</span>
      <span className="badge badge-neutral">{count}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
        Execute the 90-day plan: update task statuses, use Check/Cross markers, and let milestone & risk changes sync to their tabs automatically.
      </p>

      {/* Plan selector */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", border: "1px solid var(--border-color)", borderRadius: 12, padding: 14, background: "white" }}>
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarClock size={15} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-primary)" }}>Select a 90-Day Action Plan to track</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-dim)" }}>Action Plan *</label>
          <select className="form-input" style={{ height: 38, fontSize: "0.8rem" }} value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
            <option value="">— Choose a plan —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} {p.startup_name ? `· ${p.startup_name}` : ""} ({p.status || "Active"})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-dim)" }}>Startup (from directory)</label>
          <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-dark)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {plan ? (plan.startup_name || (startupMap[plan.startup_id] && startupMap[plan.startup_id].name) || `Startup #${plan.startup_id}`) : "Will show once a plan is selected"}
          </div>
        </div>
      </div>

      {!selectedPlan ? (
        <Empty title="No plan selected" sub="Pick an action plan above to start tracking tasks, milestones and risks." />
      ) : detailLoading ? (
        <Loading label="Loading tracker…" />
      ) : detailError ? (
        <div className="empty-state" style={{ maxWidth: 520, margin: "16px auto" }}>
          <h3 style={{ color: "var(--danger)" }}>Couldn't load this plan</h3>
          <p style={{ fontSize: "0.82rem" }}>{detailError}</p>
          <button className="btn btn-primary" onClick={() => loadDetail(selectedPlan)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {summaryStats.map((s) => (
              <div key={s.label} className="metric-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="metric-title">{s.label}</span>
                <span className="metric-value" style={{ fontSize: plan && s.label === "Plan Status" ? "1.05rem" : "1.5rem", color: s.tone }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Sync banner */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "var(--primary-light)", border: "1px solid rgba(99,102,241,0.25)", fontSize: "0.76rem", color: "var(--primary)", flexWrap: "wrap" }}>
            <Sparkles size={14} />
            <span>
              Auto-sync on: checking off a milestone promotes it to the <strong>Milestones</strong> tab; risk status changes push to the <strong>Risk Register</strong> tab — no manual re-entry needed.
            </span>
          </div>

          {/* Steps */}
          <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, background: "white", padding: 14 }}>
            {sectionTitle(<ListTodo size={15} style={{ color: "var(--primary)" }} />, "90-Day Action Tracker — Steps & Markers", steps.length)}
            <ControlCard
              search={q}
              onSearch={(v) => { setQ(v); setPage(1); }}
              status={statusF}
              onStatus={(v) => { setStatusF(v); setPage(1); }}
              statuses={STEP_STATUSES}
              owner={ownerF}
              onOwner={(v) => { setOwnerF(v); setPage(1); }}
              owners={stepOwners}
              priority={priorityF}
              onPriority={(v) => { setPriorityF(v); setPage(1); }}
              priorities={PRIORITIES}
              total={steps.length}
              shown={filteredSteps.length}
              onReset={() => { setQ(""); setStatusF(""); setOwnerF(""); setPriorityF(""); setPage(1); }}
              onExport={exportSteps}
              onTemplate={downloadStepTemplate}
              onBulkUpload={handleBulkUpload}
            />
            {steps.length === 0 ? (
              <Empty title="No tasks yet" sub="Add tasks from the 90-Day Action Plan creation form, or in the plan detail view." />
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pageSteps.map((s) => {
                    const st = STEP_STYLE[s.status] || STEP_STYLE["Not Started"];
                    const rag = ragOf(s);
                    const rg = RAG_STYLE[rag];
                    const pp = s.priority ? PRIORITY_STYLE[p1toP4(s.priority)] : null;
                    return (
                      <div key={s.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", border: "1px solid var(--border-color)", borderRadius: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            title={s.status === "Completed" ? "Undo check" : "Check off (mark completed)"}
                            onClick={() => toggleStep(s)}
                            disabled={savingId === s.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9,
                              border: "1px solid var(--border-color)", cursor: "pointer",
                              background: s.status === "Completed" ? "#DCFCE7" : "white",
                              color: s.status === "Completed" ? "#16a34a" : "#9ca3af",
                              transition: "all .15s ease",
                            }}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            title={s.status === "Blocked" ? "Unblock" : "Mark blocked"}
                            onClick={() => blockStep(s)}
                            disabled={savingId === s.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9,
                              border: "1px solid var(--border-color)", cursor: "pointer",
                              background: s.status === "Blocked" ? "#FEE2E2" : "white",
                              color: s.status === "Blocked" ? "#dc2626" : "#d1d5db",
                              transition: "all .15s ease",
                            }}
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{s.title || s.action || "—"}</span>
                            {pp && <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: pp.bg, color: pp.color }}>{p1toP4(s.priority)}</span>}
                            <span title={`RAG: ${rag}`} style={{ fontSize: "0.62rem", fontWeight: 800, padding: "1px 8px", borderRadius: 99, background: rg.bg, color: rg.color }}>{rag.toUpperCase()}</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 3, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            <span>Owner: {s.owner || "—"}</span>
                            {s.kpi && <span>KPI: {s.kpi}{s.target ? ` / ${s.target}` : ""}</span>}
                            {s.deadline && <span>Deadline: {s.deadline}</span>}
                            {s.completed_date && <span>Completed: {s.completed_date}</span>}
                          </div>
                          {plan && plan.custom_fields && plan.custom_fields.length > 0 && (
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3, fontSize: "0.68rem", color: "var(--text-dim)" }}>
                              {plan.custom_fields.map((f) => (
                                <span key={f.label}>{f.label}: <strong>{s.custom_values ? (s.custom_values[f.label] ?? s[f.label] ?? "—") : (s[f.label] ?? "—")}</strong></span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span className={`badge`} style={{ background: st.bg, color: st.color, padding: "4px 10px", borderRadius: 99, fontSize: "0.68rem", fontWeight: 700 }}>{s.status || "Not Started"}</span>
                          <select
                            className="form-input"
                            style={{ width: "auto", height: 32, fontSize: "0.75rem" }}
                            value={s.status || "Not Started"}
                            onChange={(e) => setStepStatus(s, e.target.value)}
                            disabled={savingId === s.id}
                          >
                            {STEP_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Pagination page={page} pageSize={pageSize} total={filteredSteps.length} onPage={setPage} onPageSize={setPageSize} sizes={[5, 8, 12, 20, 40]} />
              </>
            )}
          </div>

          {/* Milestones */}
          <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, background: "white", padding: 14 }}>
            {sectionTitle(<Flag size={15} style={{ color: "var(--warning)" }} />, "Milestones (auto-promotes on completion)", milestones.length)}
            {milestones.length === 0 ? (
              <Empty title="No milestones" sub="Add milestones in the plan creation form or the plan detail view." />
            ) : (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                {milestones.map((m) => {
                  const done = ["Completed", "Achieved"].includes(m.status);
                  const rag = ragOf(m);
                  const rg = RAG_STYLE[rag];
                  const pp = m.priority ? PRIORITY_STYLE[p1toP4(m.priority)] : null;
                  return (
                    <div key={m.id} style={{ padding: "12px", border: "1px solid var(--border-color)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 8, background: done ? "#F0FDF4" : "white" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>{m.milestone || m.title || "—"}</span>
                        {m.milestone_type && <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "#EEF2FF", color: "#4F46E5" }}>{m.milestone_type}</span>}
                        {pp && <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: pp.bg, color: pp.color }}>{p1toP4(m.priority)}</span>}
                        <span title={`RAG: ${rag}`} style={{ fontSize: "0.62rem", fontWeight: 800, padding: "1px 8px", borderRadius: 99, background: rg.bg, color: rg.color }}>{rag.toUpperCase()}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {m.target_date && <span>Target: {m.target_date}</span>}
                        {m.actual_date && <span>Actual: {m.actual_date}</span>}
                        {m.target_metric && <span>Metric: {m.target_metric}</span>}
                        {m.owner && <span>Owner: {m.owner}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
                        {done && <CheckCircle2 size={15} style={{ color: "#16a34a", flexShrink: 0 }} />}
                        <select
                          className="form-input"
                          style={{ flex: 1, height: 32, fontSize: "0.75rem" }}
                          value={m.status || "Not Started"}
                          onChange={(e) => setMilestoneStatus(m, e.target.value)}
                          disabled={savingId === m.id}
                        >
                          {MILESTONE_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Risks */}
          <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, background: "white", padding: 14 }}>
            {sectionTitle(<ShieldAlert size={15} style={{ color: "var(--danger)" }} />, "Risks (status syncs to Risk Register)", risks.length)}
            {risks.length === 0 ? (
              <Empty title="No risks logged" sub="Add risks in the plan creation form or the plan detail view." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {risks.map((r) => {
                  const st = RISK_STATUS_STYLE[r.status] || RISK_STATUS_STYLE.Open;
                  const pp = r.priority ? PRIORITY_STYLE[p1toP4(r.priority)] : null;
                  return (
                    <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: 10 }}>
                      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>{r.risk || r.title || "—"}</span>
                          {pp && <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: pp.bg, color: pp.color }}>{p1toP4(r.priority)}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {r.category && <span>Category: {r.category}</span>}
                          {r.risk_level && <span>Level: {r.risk_level}</span>}
                          {(r.probability || r.impact) && <span>Score: {Number(r.risk_score) || (Number(r.probability) || 0) * (Number(r.impact) || 0)}</span>}
                          {r.owner && <span>Owner: {r.owner}</span>}
                        </div>
                        {r.mitigation && <div style={{ marginTop: 3, fontSize: "0.7rem", color: "var(--text-muted)" }}>Mitigation: {r.mitigation}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span className="badge" style={{ background: st.bg, color: st.color, padding: "4px 10px", borderRadius: 99, fontSize: "0.68rem", fontWeight: 700 }}>{r.status || "Open"}</span>
                        <select
                          className="form-input"
                          style={{ width: "auto", height: 32, fontSize: "0.75rem" }}
                          value={r.status || "Open"}
                          onChange={(e) => setRiskStatus(r, e.target.value)}
                          disabled={savingId === r.id}
                        >
                          {RISK_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}