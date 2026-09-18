import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Flag,
  RotateCcw,
  Search,
  ShieldAlert,
  History,
  Gauge,
  CalendarRange,
  X,
  Loader2,
  UserPlus,
  UserMinus,
  PlusCircle,
  MinusCircle,
  Target,
} from "lucide-react";
import { toast } from "react-toastify";
import { Loading, fetchJson, DataError, Pagination } from "./crm/CrmUi";
import ControlCard from "./execution/ControlCard";
import { downloadCsv } from "../lib/executionConfig";

const STATUS_COLORS = {
  Active: "#22c55e",
  "On Hold": "#f59e0b",
  Completed: "#3b82f6",
  Cancelled: "#6b7280",
};

const STEP_STATUSES = ["Not Started", "In Progress", "Completed", "Delayed", "Blocked", "Achieved"];
const MILESTONE_STATUSES = ["Not Started", "In Progress", "Completed", "Achieved", "Delayed", "Blocked", "Cancelled"];
const PRIORITIES = ["P1 Critical", "P2 High", "P3 Medium", "P4 Low"];
const MILESTONE_TYPES = ["MVP", "IP Filing", "First Revenue", "Product-Market Fit", "Grant Received", "Rs 1 Lakh Revenue", "Pilot Signed", "Funding Milestone", "Other"];
const PLAN_SOURCES = ["Mentor Meeting", "Quarterly Review", "Startup Audit", "Review", "Incubation Manager", "CEO Office"];
const CUSTOM_FIELD_TYPES = ["text", "number", "date", "select", "checkbox"];

const PRIORITY_STYLE = {
  "P1 Critical": { bg: "#FEE2E2", color: "#b91c1c" },
  "P2 High": { bg: "#FFEDD5", color: "#c2410c" },
  "P3 Medium": { bg: "#FEF3C7", color: "#92400e" },
  "P4 Low": { bg: "#DCFCE7", color: "#065f46" },
};

const p1toP4 = (p) =>
  p === "High" ? "P2 High" : p === "Low" ? "P4 Low" : p === "P1 Critical" || p === "P2 High" || p === "P3 Medium" || p === "P4 Low" ? p : "P3 Medium";

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--border-color)",
  fontSize: "0.8rem",
  background: "white",
  color: "var(--text-primary)",
};

const labelStyle = {
  fontSize: "0.68rem",
  fontWeight: 700,
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: "4px",
  display: "block",
};

export default function ActionPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [startupOptions, setStartupOptions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [startupSearch, setStartupSearch] = useState("");

  // Tracker control center
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [tracker, setTracker] = useState({});
  // Risk-from-overdue-action
  const [riskFor, setRiskFor] = useState(null);
  const [riskForm, setRiskForm] = useState({});
  const [riskSaving, setRiskSaving] = useState(false);
  // Reason recorded on every history-sensitive update within a plan detail
  const [reason, setReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [plansError, setPlansError] = useState(null);
  const [tick, setTick] = useState(0);
  // Responsive, searchable & paginated plan list
  const [planSearch, setPlanSearch] = useState("");
  const [planStartup, setPlanStartup] = useState("");
  const [planStatus, setPlanStatus] = useState("");
  const [planOwner, setPlanOwner] = useState("");
  const [planPriority, setPlanPriority] = useState("");
  const [plansPage, setPlansPage] = useState(1);
  const [plansPageSize, setPlansPageSize] = useState(9);
  // Dynamic creation form rows (steps / milestones / risks)
  const [formSteps, setFormSteps] = useState([]);
  const [formMilestones, setFormMilestones] = useState([]);
  const [formRisks, setFormRisks] = useState([]);
  // Quick "Add Startup" to the registry from inside the form
  const [addingStartup, setAddingStartup] = useState(false);
  const [newStartupName, setNewStartupName] = useState("");
  // Source, P1–P4 priority & custom-field definitions for the plan
  const [formSource, setFormSource] = useState("");
  const [formPriority, setFormPriority] = useState("P3 Medium");
  const [formCustomFields, setFormCustomFields] = useState([]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setPlansError(null);
    try {
      setPlans(await fetchJson("/api/crm/action-plans"));
    } catch (e) {
      setPlansError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans, tick]);

  const loadRefs = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/refs", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStartupOptions(data.startups || []);
      }
    } catch {
      /* refs optional */
    }
  }, []);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  const openDetail = async (id) => {
    setDetail(null);
    setReason("");
    try {
      const res = await fetch(`/api/crm/action-plans/${id}`, { cache: "no-store" });
      if (res.ok) setDetail(await res.json());
      else toast.error("Failed to load plan detail.");
    } catch {
      toast.error("Failed to load plan detail.");
    }
  };

  const openCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    const plus90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    setEditing(null);
    setStartupSearch("");
    setFormSteps([]);
    setFormMilestones([]);
    setFormRisks([]);
    setFormSource("");
    setFormPriority("P3 Medium");
    setFormCustomFields([]);
    setForm({
      title: "",
      startup_id: "",
      objective: "",
      owner: "",
      status: "Active",
      priority: "P3 Medium",
      start_date: today,
      end_date: plus90,
      description: "",
      key_goals: "",
      dependencies: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setStartupSearch("");
    setFormSteps([]);
    setFormMilestones([]);
    setFormRisks([]);
    setFormSource(p.source || "");
    setFormPriority(p.priority ? p1toP4(p.priority) : "P3 Medium");
    setFormCustomFields(Array.isArray(p.custom_fields) && p.custom_fields.length ? p.custom_fields.map((f, i) => ({ ...f, id: i })) : []);
    setForm({
      title: p.title || "",
      startup_id: p.startup_id ?? "",
      objective: p.objective || "",
      owner: p.owner || "",
      status: p.status || "Active",
      priority: p.priority ? p1toP4(p.priority) : "P3 Medium",
      start_date: p.start_date || "",
      end_date: p.end_date || "",
      description: p.description || "",
      key_goals: Array.isArray(p.key_goals) ? p.key_goals.join("\n") : (p.key_goals || ""),
      dependencies: Array.isArray(p.dependencies) ? p.dependencies.join("\n") : (p.dependencies || ""),
      notes: p.notes || "",
    });
    setModalOpen(true);
  };

  /* ── Startup Selector: Select / Add / Remove ── */
  const addStartupFromModal = async () => {
    const name = newStartupName.trim();
    if (!name) {
      toast.error("Enter a startup name first.");
      return;
    }
    setAddingStartup(true);
    try {
      const res = await fetch("/api/crm/startups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, status: "Active", record_status: "Active", crm_owner: "Incubation Manager", stage: "Ideation" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${name} added to the Startup Directory & selected for this plan.`);
        setForm({ ...form, startup_id: data.id });
        setNewStartupName("");
        await loadRefs();
      } else {
        toast.error(data.detail || "Failed to add startup.");
      }
    } catch {
      toast.error("Network error while adding startup.");
    } finally {
      setAddingStartup(false);
    }
  };

  const removeStartupFromModal = () => {
    setForm({ ...form, startup_id: "" });
    toast.success("Startup removed from this plan (the registry record is untouched).");
  };

  /* ── Dynamic Action Fields / Milestone Builder / Risk Register (creation form) ── */
  const addStepRow = () => {
    const row = { title: "", kpi: "", baseline: "", target: "", deadline: "", priority: "P3 Medium", owner: form.owner || "Incubation Manager", status: "Not Started" };
    setFormSteps((rows) => [...rows, { ...row, id: Date.now() + rows.length }]);
  };
  const addMilestoneRow = () => {
    const row = { milestone: "", milestone_type: "MVP", target_date: "", target_metric: "", priority: "P3 Medium", status: "Not Started" };
    setFormMilestones((rows) => [...rows, { ...row, id: Date.now() + rows.length }]);
  };
  const addRiskRow = () => {
    const row = { risk: "", category: "Execution", severity: "Medium", probability: 50, impact: "Medium", mitigation: "", due_date: "", owner: form.owner || "Incubation Manager", priority: "P3 Medium", status: "Open" };
    setFormRisks((rows) => [...rows, { ...row, id: Date.now() + rows.length }]);
  };
  const addCustomFieldRow = () => {
    setFormCustomFields((rows) => [...rows, { label: "", type: "text", options: "", id: Date.now() + rows.length }]);
  };

  const submitPlan = async () => {
    if (!form.title.trim()) {
      toast.error("Plan title is required.");
      return;
    }
    setSaving(true);
    const goals = (form.key_goals || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const deps = (form.dependencies || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const payload = { ...form, key_goals: goals, dependencies: deps, source: formSource, priority: formPriority };
    const fields = formCustomFields
      .filter((f) => f.label && f.label.trim())
      .map((f) => ({
        label: f.label.trim(),
        type: f.type,
        options: f.type === "select" ? (f.options || "").split(",").map((o) => o.trim()).filter(Boolean) : [],
      }));
    if (fields.length) payload.custom_fields = fields;
    if (!editing) {
      payload.steps = formSteps.filter((s) => s.title && s.title.trim());
      payload.milestones = formMilestones.filter((m) => (m.milestone || m.title) && (m.milestone || "").trim());
      payload.risks = formRisks.filter((r) => r.risk && r.risk.trim());
    }
    try {
      const res = await fetch(
        `/api/crm/action-plans${editing ? `/${editing.id}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(editing ? "Action plan updated (history recorded)." : data.message);
        setModalOpen(false);
        await loadPlans();
      } else {
        toast.error(data.detail || "Failed to save plan.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (p) => {
    if (!window.confirm(`Delete plan "${p.title}"? Its steps, milestones & risks will be unlinked.`)) return;
    try {
      const res = await fetch(`/api/crm/action-plans/${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        await loadPlans();
      } else {
        toast.error(data.detail || "Failed to delete plan.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const addStep = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      startup_id: detail.plan.startup_id ?? "",
      plan_id: detail.plan.id,
      title: fd.get("title") || "",
      deadline: fd.get("deadline") || "",
      status: fd.get("status") || "Not Started",
    };
    if (!payload.title.trim()) return;
    try {
      const res = await fetch("/api/crm/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Step added.");
        e.target.reset();
        await openDetail(detail.plan.id);
      } else {
        toast.error(data.detail || "Failed to add step.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const addMilestone = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      startup_id: detail.plan.startup_id ?? "",
      plan_id: detail.plan.id,
      title: fd.get("title") || "",
      target_date: fd.get("target_date") || "",
    };
    if (!payload.title.trim()) return;
    try {
      const res = await fetch("/api/crm/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Milestone added.");
        e.target.reset();
        await openDetail(detail.plan.id);
      } else {
        toast.error(data.detail || "Failed to add milestone.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const evaluateStep = async (step, status) => {
    try {
      const res = await fetch(`/api/crm/actions/${step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, change_reason: reason || `Marked ${status}` }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Step marked ${status}.`);
        await openDetail(detail.plan.id);
      } else {
        toast.error(data.detail || "Failed to update step.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const updateMilestoneStatus = async (m, status) => {
    try {
      const res = await fetch(`/api/crm/milestones/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, change_reason: reason || `Milestone ${status}` }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Milestone ${status}.`);
        await openDetail(detail.plan.id);
      } else {
        toast.error(data.detail || "Failed to update milestone.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const quickToggleStatus = async (status) => {
    try {
      const res = await fetch(`/api/crm/action-plans/${detail.plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason || `Status set to ${status}` }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        await openDetail(detail.plan.id);
      } else {
        toast.error(data.detail || "Failed to update plan.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  /* ── 90-Day Action Tracker: progress, revised dates, reason/history ── */
  const openTracker = () => {
    const p = detail.plan;
    setTracker({
      status: p.status || "Active",
      start_date: p.start_date || "",
      end_date: p.end_date || "",
      progress_pct: p.progress_pct || 0,
      reason: "",
    });
    setTrackerOpen(true);
  };

  const saveTracker = async () => {
    try {
      const res = await fetch(`/api/crm/action-plans/${detail.plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: tracker.status,
          start_date: tracker.start_date,
          end_date: tracker.end_date,
          progress_pct: tracker.progress_pct,
          reason: tracker.reason || "Tracker control-center update",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Tracker updated (revision recorded in history).");
        setTrackerOpen(false);
        await openDetail(detail.plan.id);
      } else {
        toast.error(data.detail || "Failed to update tracker.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  /* ── Auto-generate milestones from the plan's 90-day window ── */
  const addDays = (iso, days) => {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const generateMilestones = async () => {
    const p = detail.plan;
    if (!p.start_date || !p.end_date) {
      toast.warning("Plan needs start & end dates first.");
      return;
    }
    const existingTitles = new Set((detail.milestones || []).map((m) => m.title));
    const toCreate = [
      { title: `${p.title} — Kickoff`, target_date: p.start_date },
      { title: `${p.title} — Mid-cycle review`, target_date: addDays(p.start_date, 45) },
      { title: `${p.title} — Completion & handover`, target_date: p.end_date },
    ].filter((m) => !existingTitles.has(m.title));
    if (toCreate.length === 0) {
      toast.info("Milestones for this plan's window already exist.");
      return;
    }
    let created = 0;
    for (const m of toCreate) {
      const res = await fetch("/api/crm/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m, startup_id: p.startup_id ?? "", plan_id: p.id, status: "Not Started" }),
      });
      if (res.ok) created++;
    }
    toast.success(`Generated ${created}/${toCreate.length} milestones from plan dates.`);
    await openDetail(p.id);
  };

  /* ── Create Risk from an overdue action ── */
  const openRiskFor = (step, plan) => {
    const today = new Date().toISOString().slice(0, 10);
    setRiskForm({
      startup_id: plan.startup_id ?? "",
      plan_id: plan.id,
      action_id: step.id,
      related_action_id: step.id,
      risk: `Overdue: ${step.title}`,
      category: "Execution",
      severity: step.deadline && step.deadline < today ? "High" : "Medium",
      status: "Open",
      due_date: step.deadline || "",
      owner: plan.owner || "",
      mitigation: "",
      probability: 50,
      impact: "Medium",
      notes: `Created from overdue action "${step.title}" (deadline ${step.deadline || "—"}).`,
    });
    setRiskFor(step);
  };

  const saveRisk = async () => {
    if (!riskForm.risk.trim()) {
      toast.error("Risk title is required.");
      return;
    }
    setRiskSaving(true);
    try {
      const res = await fetch("/api/crm/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(riskForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Risk added to Risk Register & linked to this action.");
        setRiskFor(null);
        await openDetail(detail.plan.id);
      } else {
        toast.error(data.detail || "Failed to create risk.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setRiskSaving(false);
    }
  };

  if (loading && plans.length === 0 && !plansError) return <Loading label="Loading action plans…" />;

  if (plansError && plans.length === 0) return <DataError message={plansError} onRetry={() => setTick((t) => t + 1)} />;

  if (detail) {
    const p = detail.plan;
    const today = new Date().toISOString().slice(0, 10);
    const history = p.history || [];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
          <button
            onClick={() => setDetail(null)}
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px",
              border: "1px solid var(--border-color)", borderRadius: "8px",
              background: "white", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700,
            }}
          >
            <ArrowLeft size={15} /> Back to plans
          </button>
          <h3 style={{ margin: 0, fontSize: "1.02rem", color: "var(--text-primary)" }}>{p.title}</h3>
          <select
            value={p.status}
            onChange={(e) => quickToggleStatus(e.target.value)}
            style={{ ...inputStyle, width: "auto", fontWeight: 700, color: STATUS_COLORS[p.status] || "#333" }}
          >
            {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
            <button onClick={() => setReasonOpen(!reasonOpen)} title="Record a reason for the next change (kept in history)" style={iconBtn}>
              <History size={15} />
            </button>
            <button onClick={openTracker} title="90-Day Action Tracker control center" style={{ ...iconBtn, color: "var(--primary)" }}>
              <Gauge size={15} />
            </button>
            <button onClick={() => openEdit(p)} title="Edit plan" style={iconBtn}>
              <Pencil size={15} />
            </button>
          </div>
        </div>

        {reasonOpen && (
          <div style={{ marginBottom: "14px", padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <History size={13} style={{ color: "#92400E" }} />
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#92400E" }}>Reason for next change (stored in history — never silently overwritten)</span>
              <button onClick={() => setReasonOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#92400E" }}><X size={14} /></button>
            </div>
            <input style={{ ...inputStyle, background: "white" }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Founder pivoted to B2B model, so timeline revised…" />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", marginBottom: "14px" }}>
          <InfoCard title="Startup" value={p.startup_name || "—"} sub={`Source: ${p.source || "—"} · Priority: ${p.priority ? p1toP4(p.priority) : "—"}`} />
          <InfoCard title="Objective" value={p.objective || "—"} />
          <InfoCard title="Owner" value={p.owner || "—"} />
          <InfoCard title="Timeline" value={`${p.start_date || "—"} → ${p.end_date || "—"}`} sub={p.status} />
          <div style={{ ...cardBox }}>
            <div style={sectionTitleSmall}>Progress</div>
            <div style={{ marginTop: "4px" }}>
              <div style={{ background: "var(--bg-dark)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                <div style={{ height: "8px", background: "var(--primary)", width: `${Math.max(0, Math.min(100, Number(p.progress_pct) || 0))}%` }} />
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {p.completed_steps}/{p.total_steps} steps · {p.progress_pct}% · {p.overdue_steps} overdue
              </span>
            </div>
          </div>
        </div>

        {p.description && (
          <div style={{ marginBottom: "14px", padding: "12px 14px", background: "var(--bg-surface)", borderRadius: "10px", border: "1px solid var(--border-color)", fontSize: "0.82rem", color: "var(--text-body)" }}>
            {p.description}
          </div>
        )}

        <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "1fr", marginTop: "4px" }}>
          <div>
            <h4 style={{ ...sectionTitle }}>
              <ListChecks size={15} /> Steps ({detail.steps.length})
            </h4>
            <form onSubmit={addStep} style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
              <input name="title" placeholder="New action step…" style={{ ...inputStyle, flex: "1 1 220px" }} />
              <input name="deadline" type="date" style={{ ...inputStyle, width: "150px" }} />
              <select name="status" defaultValue="Not Started" style={{ ...inputStyle, width: "130px" }}>
                {STEP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="submit" style={{ ...primaryBtn }}>
                <Plus size={14} /> Add
              </button>
            </form>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {detail.steps.length === 0 && <EmptyPill text="No steps yet for this plan." />}
              {detail.steps.map((s) => {
                const overdue = s.status !== "Completed" && s.deadline && s.deadline < today;
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: overdue ? "#FEF2F2" : "var(--bg-white, white)", border: `1px solid ${overdue ? "#FECACA" : "var(--border-color)"}`, borderRadius: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 600, flex: "1", minWidth: "180px" }}>{s.title}</span>
                    {s.priority && (() => { const ps = PRIORITY_STYLE[p1toP4(s.priority)] || { bg: "#FEF3C7", color: "#92400e" }; return (
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: ps.bg, color: ps.color }}>{p1toP4(s.priority)}</span>
                    ); })()}
                    {s.kpi && <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{s.kpi}{s.target ? ` / ${s.target}` : ""}</span>}
                    {overdue && (
                      <span style={{ fontSize: "0.66rem", color: "#ef4444", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertTriangle size={12} /> Overdue
                      </span>
                    )}
                    {s.deadline && <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{s.deadline}</span>}
                    <div style={{ display: "flex", gap: "4px" }}>
                      {STEP_STATUSES.map((st) => {
                        const active = (s.status || "Not Started") === st;
                        return (
                          <button
                            key={st}
                            onClick={() => evaluateStep(s, st)}
                            style={{
                              padding: "5px 9px", borderRadius: "6px", fontSize: "0.66rem", fontWeight: 700,
                              border: `1px solid ${active ? "var(--primary)" : "var(--border-color)"}`,
                              background: active ? "var(--primary)" : "white",
                              color: active ? "white" : "var(--text-muted)", cursor: "pointer",
                            }}
                          >
                            {st === "Completed" && active ? <CheckCircle2 size={12} /> : st}
                          </button>
                        );
                      })}
                    </div>
                    {overdue && (
                      <button onClick={() => openRiskFor(s, p)} title="Create Risk Register entry from this overdue action" style={{ ...iconBtn, color: "var(--danger)", borderColor: "#FECACA" }}>
                        <ShieldAlert size={14} /> <span style={{ fontSize: "0.66rem", fontWeight: 700, marginLeft: 4 }}>Create Risk</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ ...sectionTitle }}>
                <Flag size={15} /> Milestones ({detail.milestones.length})
              </h4>
              <button onClick={generateMilestones} title="Auto-generate kickoff / mid-cycle / completion milestones from the plan's 90-day window" style={{ ...ghostBtn, padding: "6px 10px", fontSize: "0.7rem" }}>
                <CalendarRange size={12} /> Auto-generate from plan dates
              </button>
            </div>
            <form onSubmit={addMilestone} style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
              <input name="title" placeholder="New milestone…" style={{ ...inputStyle, flex: "1 1 220px" }} />
              <input name="target_date" type="date" style={{ ...inputStyle, width: "150px" }} />
              <button type="submit" style={{ ...primaryBtn }}>
                <Plus size={14} /> Add
              </button>
            </form>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {detail.milestones.length === 0 && <EmptyPill text="No milestones for this plan. Use auto-generate or add manually." />}
              {detail.milestones.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 600, flex: "1" }}>{m.title}</span>
                  {m.target_date && <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{m.target_date}</span>}
                  <select
                    value={m.status || "Not Started"}
                    onChange={(e) => updateMilestoneStatus(m, e.target.value)}
                    style={{ ...inputStyle, width: "120px", padding: "5px", fontSize: "0.7rem" }}
                  >
                    {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ ...sectionTitle }}>
              <ShieldAlert size={15} /> Risks ({detail.risks.length})
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {detail.risks.length === 0 && <EmptyPill text="No risks linked to this plan yet. Create one from an overdue action above." />}
              {detail.risks.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "10px" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 600, flex: "1" }}>{r.risk}</span>
                  <span style={{ fontSize: "0.66rem", fontWeight: 700, padding: "2px 9px", borderRadius: "10px", background: r.severity === "Critical" ? "#FEE2E2" : r.severity === "High" ? "#FEF3C7" : "#D1FAE5", color: r.severity === "Critical" ? "#B91C1C" : r.severity === "High" ? "#92400E" : "#065F46" }}>
                    {r.severity || "Medium"}
                  </span>
                  <span className={`badge ${r.status === "Closed" ? "badge-neutral" : "badge-warning"}`}>{r.status || "Open"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: "14px", padding: "14px", background: "var(--bg-white, white)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
            <h4 style={{ ...sectionTitle }}><History size={15} /> Revision History ({history.length})</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {history.slice().reverse().map((h, i) => (
                <div key={i} style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "8px", borderBottom: "1px dashed var(--border-color)", padding: "6px 0" }}>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{String(h.updated_at || "").slice(0, 16)}</span>
                  <span style={{ color: "var(--text-body)" }}>{h.reason || "No reason recorded."}</span>
                  <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-dim)" }}>{Object.keys(h.changes || {}).join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trackerOpen && (
          <div style={modalOverlay} onClick={() => setTrackerOpen(false)}>
            <div style={modalBox} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 14px", fontSize: "0.95rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <Gauge size={16} /> 90-Day Action Tracker — {p.title}
              </h3>
              <div style={{ display: "grid", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={tracker.status} onChange={(e) => setTracker({ ...tracker, status: e.target.value })}>
                    {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Revised start date</label>
                    <input type="date" style={inputStyle} value={tracker.start_date} onChange={(e) => setTracker({ ...tracker, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Revised end date</label>
                    <input type="date" style={inputStyle} value={tracker.end_date} onChange={(e) => setTracker({ ...tracker, end_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Progress %  ({tracker.progress_pct}%)</label>
                  <input type="range" min="0" max="100" step="5" style={{ width: "100%" }} value={tracker.progress_pct} onChange={(e) => setTracker({ ...tracker, progress_pct: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={labelStyle}>Reason for this change (recorded in history — no silent overwrite) *</label>
                  <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={tracker.reason} onChange={(e) => setTracker({ ...tracker, reason: e.target.value })} placeholder="e.g. Delayed pilot due to founder availability…" />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button onClick={() => setTrackerOpen(false)} style={{ ...ghostBtn }}>Cancel</button>
                <button onClick={saveTracker} style={{ ...primaryBtn }}>Save tracker update</button>
              </div>
            </div>
          </div>
        )}

        {riskFor && (
          <div style={modalOverlay} onClick={() => setRiskFor(null)}>
            <div style={modalBox} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 14px", fontSize: "0.95rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={16} style={{ color: "var(--danger)" }} /> Create Risk from Overdue Action
              </h3>
              <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                Linked to plan #{p.id} · action #{riskFor.id} "{riskFor.title}"
              </div>
              <div style={{ display: "grid", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Risk title *</label>
                  <input style={inputStyle} value={riskForm.risk} onChange={(e) => setRiskForm({ ...riskForm, risk: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <input style={inputStyle} value={riskForm.category} onChange={(e) => setRiskForm({ ...riskForm, category: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Severity</label>
                    <select style={inputStyle} value={riskForm.severity} onChange={(e) => setRiskForm({ ...riskForm, severity: e.target.value })}>
                      <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Probability %</label>
                    <input type="number" min="0" max="100" style={inputStyle} value={riskForm.probability} onChange={(e) => setRiskForm({ ...riskForm, probability: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Impact</label>
                    <select style={inputStyle} value={riskForm.impact} onChange={(e) => setRiskForm({ ...riskForm, impact: e.target.value })}>
                      <option>High</option><option>Medium</option><option>Low</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Due date</label>
                    <input type="date" style={inputStyle} value={riskForm.due_date} onChange={(e) => setRiskForm({ ...riskForm, due_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Mitigation</label>
                  <textarea style={{ ...inputStyle, minHeight: "55px", resize: "vertical" }} value={riskForm.mitigation} onChange={(e) => setRiskForm({ ...riskForm, mitigation: e.target.value })} placeholder="Planned mitigating action…" />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button onClick={() => setRiskFor(null)} style={{ ...ghostBtn }}>Cancel</button>
                <button onClick={saveRisk} disabled={riskSaving} style={{ ...primaryBtn, background: "var(--danger)" }}>
                  {riskSaving ? <Loader2 size={14} className="spin" /> : <ShieldAlert size={14} />} {riskSaving ? "Creating…" : "Create Risk"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const filteredStartups = (startupOptions || []).filter((s) => {
    const needle = startupSearch.trim().toLowerCase();
    if (!needle) return true;
    return String(s.name || "").toLowerCase().includes(needle);
  });

  const filteredPlans = (plans || []).filter((p) => {
    const needle = planSearch.trim().toLowerCase();
    if (needle && !(
      String(p.title || "").toLowerCase().includes(needle) ||
      String(p.startup_name || "").toLowerCase().includes(needle) ||
      String(p.owner || "").toLowerCase().includes(needle) ||
      String(p.source || "").toLowerCase().includes(needle)
    )) return false;
    if (planStartup && String(p.startup_id) !== String(planStartup)) return false;
    if (planStatus && p.status !== planStatus) return false;
    if (planOwner && p.owner !== planOwner) return false;
    if (planPriority && p1toP4(p.priority) !== planPriority) return false;
    return true;
  });
  const plansTotal = filteredPlans.length;
  const plansStart = (plansPage - 1) * plansPageSize;
  const paginatedPlans = filteredPlans.slice(plansStart, plansStart + plansPageSize);
  const planOwners = [...new Set((plans || []).map((p) => p.owner).filter(Boolean))];

  const exportPlans = () => {
    downloadCsv("action-plans.csv", filteredPlans, [
      { key: "id", label: "Plan ID" },
      { key: "startup_name", label: "Startup" },
      { key: "title", label: "Plan Title" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "owner", label: "Owner" },
      { key: "progress_pct", label: "Progress %" },
      { key: "total_steps", label: "Steps" },
      { key: "overdue_steps", label: "Overdue" },
      { key: "end_date", label: "End Date" },
    ]);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", gap: 10, flexWrap: "wrap" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
          Master Action Plan Cards — Google-forms-style builder: pick a startup (add/remove inline), define steps, KPI targets, milestones & risks, plus custom fields.
        </p>
        <button onClick={openCreate} style={{ ...primaryBtn }}>
          <Plus size={15} /> Create Plan
        </button>
      </div>

      <ControlCard
        search={planSearch}
        onSearch={(v) => { setPlanSearch(v); setPlansPage(1); }}
        startup={planStartup}
        onStartup={(v) => { setPlanStartup(v); setPlansPage(1); }}
        startups={startupOptions}
        status={planStatus}
        onStatus={(v) => { setPlanStatus(v); setPlansPage(1); }}
        statuses={Object.keys(STATUS_COLORS)}
        owner={planOwner}
        onOwner={(v) => { setPlanOwner(v); setPlansPage(1); }}
        owners={planOwners}
        priority={planPriority}
        onPriority={(v) => { setPlanPriority(v); setPlansPage(1); }}
        priorities={PRIORITIES}
        total={plans.length}
        shown={plansTotal}
        onReset={() => { setPlanSearch(""); setPlanStartup(""); setPlanStatus(""); setPlanOwner(""); setPlanPriority(""); setPlansPage(1); }}
        onExport={exportPlans}
      />

      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", marginTop: 14 }}>
        {plans.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center", background: "var(--bg-dark)", borderRadius: "12px", border: "1px solid var(--border-color)", color: "var(--text-dim)", fontSize: "0.84rem" }}>
            No action plans yet. Create the first 90-day plan for a startup.
          </div>
        )}
        {plans.length > 0 && paginatedPlans.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: "30px", textAlign: "center", background: "var(--bg-dark)", borderRadius: "12px", border: "1px dashed var(--border-color)", color: "var(--text-dim)", fontSize: "0.84rem" }}>
            No plans match "{planSearch}". Try a different search.
          </div>
        )}
        {paginatedPlans.map((p) => (
          <div
            key={p.id}
            style={{ border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px", background: "var(--bg-white, white)", cursor: "pointer", transition: "box-shadow 0.2s ease" }}
            onClick={() => openDetail(p.id)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>{p.title}</span>
              <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", color: "white", background: STATUS_COLORS[p.status] || "#6b7280" }}>{p.status}</span>
              {p.priority && (() => { const ps = PRIORITY_STYLE[p1toP4(p.priority)] || { bg: "#FEF3C7", color: "#92400e" }; return (
                <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: ps.bg, color: ps.color }}>{p1toP4(p.priority)}</span>
              ); })()}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "10px" }}>
              {p.startup_name} · {p.owner || "No owner"}{p.source ? ` · ${p.source}` : ""}
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <div style={{ flex: "1", background: "var(--bg-dark)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                <div style={{ height: "7px", background: "var(--primary)", width: `${Math.max(0, Math.min(100, Number(p.progress_pct) || 0))}%` }} />
              </div>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--primary)" }}>{p.progress_pct}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>
                {p.completed_steps}/{p.total_steps} steps · {p.overdue_steps} overdue · {p.end_date || "—"}
              </span>
              <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(p)} title="Edit" style={iconBtn}><Pencil size={13} /></button>
                <button onClick={() => deletePlan(p)} title="Delete" style={{ ...iconBtn, color: "var(--danger)" }}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination
        page={plansPage}
        pageSize={plansPageSize}
        total={plansTotal}
        onPage={setPlansPage}
        onPageSize={setPlansPageSize}
        sizes={[6, 9, 15, 24, 48]}
      />

      {modalOpen && (
        <div style={modalOverlay} onClick={() => setModalOpen(false)}>
          <div style={{ ...modalBox, maxWidth: "780px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px", fontSize: "0.95rem", color: "var(--text-primary)" }}>
              {editing ? "Edit Action Plan" : "New 90-Day Action Plan"}
            </h3>
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Market Fit & Pilot Sprint" />
              </div>
              <div>
                <label style={labelStyle}>Startup (from the Startup Directory — select, add or remove) *</label>
                <div style={{ position: "relative", marginBottom: "6px" }}>
                  <input
                    style={{ ...inputStyle, paddingLeft: "30px" }}
                    placeholder="Search startups…"
                    value={startupSearch}
                    onChange={(e) => setStartupSearch(e.target.value)}
                  />
                  <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
                </div>
                <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                    {filteredStartups.length === 0 && (
                      <div style={{ padding: "10px", fontSize: "0.74rem", color: "var(--text-dim)" }}>No startup matches the search. Add a new startup below, or create one in the Startups tab first.</div>
                    )}
                    {filteredStartups.map((s) => {
                      const selected = Number(form.startup_id) === Number(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setForm({ ...form, startup_id: s.id })}
                          style={{
                            display: "flex", width: "100%", textAlign: "left", padding: "8px 10px", cursor: "pointer",
                            border: "none", borderBottom: "1px solid var(--border-color)",
                            background: selected ? "var(--primary-light)" : "white",
                            fontSize: "0.78rem", fontWeight: selected ? 800 : 600,
                            color: selected ? "var(--primary)" : "var(--text-primary)",
                          }}
                        >
                          <span style={{ flex: 1 }}>{s.name}</span>
                          {selected && <CheckCircle2 size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: "8px", padding: "8px", borderTop: "1px solid var(--border-color)", background: "var(--bg-dark)", flexWrap: "wrap" }}>
                    <input
                      style={{ ...inputStyle, flex: "1 1 180px", background: "white" }}
                      placeholder="Startup not in the directory? Add it…"
                      value={newStartupName}
                      onChange={(e) => setNewStartupName(e.target.value)}
                    />
                    <button
                      type="button"
                      style={{ ...ghostBtn, color: "var(--primary)", display: "flex", alignItems: "center", gap: 5 }}
                      disabled={addingStartup || !newStartupName.trim()}
                      onClick={addStartupFromModal}
                    >
                      {addingStartup ? <Loader2 size={13} className="spin" /> : <UserPlus size={13} />} {addingStartup ? "Adding…" : "Add Startup"}
                    </button>
                  </div>
                  {form.startup_id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderTop: "1px solid var(--border-color)", background: "#ECFDF5" }}>
                      <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                      <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#065F46", flex: 1 }}>
                        {(() => { const s = startupOptions.find((o) => Number(o.id) === Number(form.startup_id)); return s ? s.name : `Startup #${form.startup_id}`; })()}
                      </span>
                      <button type="button" onClick={removeStartupFromModal} title="Remove startup from this plan" style={{ ...iconBtn, color: "var(--danger)", padding: "5px 9px", display: "flex", alignItems: "center", gap: 5 }}>
                        <UserMinus size={13} /> <span style={{ fontSize: "0.68rem", fontWeight: 700 }}>Remove</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-color)", background: "#FFFBEB", fontSize: "0.74rem", color: "#92400E" }}>
                      No startup selected yet — pick one from the list or add a new startup.
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Objective</label>
                <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Scope & context for the 90 days…" />
              </div>
              <div>
                <label style={labelStyle}>Key goals (one per line)</label>
                <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={form.key_goals} onChange={(e) => setForm({ ...form, key_goals: e.target.value })} placeholder={"Grow active pilots ×3\nMonthly recurring revenue ≥ ₹1L"} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Start date</label>
                  <input type="date" style={inputStyle} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>End date</label>
                  <input type="date" style={inputStyle} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Owner</label>
                  <input style={inputStyle} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="e.g. Incubation Manager" />
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select style={inputStyle} value={formPriority} onChange={(e) => setFormPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Source</label>
                  <select style={inputStyle} value={formSource} onChange={(e) => setFormSource(e.target.value)}>
                    <option value="">— Select source —</option>
                    {PLAN_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Dependencies (one per line)</label>
                <textarea style={{ ...inputStyle, minHeight: "44px", resize: "vertical" }} value={form.dependencies} onChange={(e) => setForm({ ...form, dependencies: e.target.value })} placeholder="Feasibility report…" />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: "44px", resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            {/* ── Dynamic Action Fields ── */}
            <div style={{ marginTop: "14px", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", background: "var(--bg-surface, #F8FAFC)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <ListChecks size={14} style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--text-primary)" }}>Action Fields — tasks with owners & deadlines</span>
                <button type="button" style={{ marginLeft: "auto", ...ghostBtn, padding: "5px 10px", fontSize: "0.7rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 5 }} onClick={addStepRow}>
                  <PlusCircle size={13} /> Add task
                </button>
              </div>
              {editing ? (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", padding: "4px 0 6px" }}>Tasks on an existing plan are managed in the 90-Day Action Tracker.</div>
              ) : formSteps.length === 0 ? (
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", padding: "4px 0 6px" }}>No tasks yet — add the first action for this plan.</div>
              ) : null}
              <div style={{ display: "grid", gap: "8px" }}>
                {formSteps.map((row, i) => (
                  <div key={row.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "6px", alignItems: "center", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "white" }}>
                    <input style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Task title…" value={row.title} onChange={(e) => setFormSteps((rows) => rows.map((r, idx) => idx === i ? { ...r, title: e.target.value } : r))} />
                    <input style={inputStyle} placeholder="KPI" value={row.kpi} onChange={(e) => setFormSteps((rows) => rows.map((r, idx) => idx === i ? { ...r, kpi: e.target.value } : r))} />
                    <input style={inputStyle} placeholder="Baseline" type="number" value={row.baseline} onChange={(e) => setFormSteps((rows) => rows.map((r, idx) => idx === i ? { ...r, baseline: e.target.value } : r))} />
                    <input style={inputStyle} placeholder="Target" type="number" value={row.target} onChange={(e) => setFormSteps((rows) => rows.map((r, idx) => idx === i ? { ...r, target: e.target.value } : r))} />
                    <input style={inputStyle} placeholder="Owner" value={row.owner} onChange={(e) => setFormSteps((rows) => rows.map((r, idx) => idx === i ? { ...r, owner: e.target.value } : r))} />
                    <input type="date" style={inputStyle} value={row.deadline} onChange={(e) => setFormSteps((rows) => rows.map((r, idx) => idx === i ? { ...r, deadline: e.target.value } : r))} />
                    <select style={inputStyle} value={row.priority} onChange={(e) => setFormSteps((rows) => rows.map((r, idx) => idx === i ? { ...r, priority: e.target.value } : r))}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select style={inputStyle} value={row.status} onChange={(e) => setFormSteps((rows) => rows.map((r, idx) => idx === i ? { ...r, status: e.target.value } : r))}>
                      {STEP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="button" onClick={() => setFormSteps((rows) => rows.filter((_, idx) => idx !== i))} style={{ ...iconBtn, color: "var(--danger)", justifySelf: "start" }}><MinusCircle size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Milestone Builder ── */}
            <div style={{ marginTop: "12px", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", background: "var(--bg-surface, #F8FAFC)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <Flag size={14} style={{ color: "var(--warning)" }} />
                <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--text-primary)" }}>Milestone Builder — dates & target metrics</span>
                <button type="button" style={{ marginLeft: "auto", ...ghostBtn, padding: "5px 10px", fontSize: "0.7rem", color: "var(--warning)", display: "flex", alignItems: "center", gap: 5 }} onClick={addMilestoneRow}>
                  <PlusCircle size={13} /> Add milestone
                </button>
              </div>
              {editing ? (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", padding: "4px 0 6px" }}>Milestones on an existing plan are managed in the detail view / Tracker (auto-syncs to the Milestones tab).</div>
              ) : formMilestones.length === 0 ? (
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", padding: "4px 0 6px" }}>No milestones yet — flags you check off in the Tracker also appear on the Milestones tab.</div>
              ) : null}
              <div style={{ display: "grid", gap: "8px" }}>
                {formMilestones.map((row, i) => (
                  <div key={row.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "6px", alignItems: "center", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "white" }}>
                    <input style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Milestone title…" value={row.milestone} onChange={(e) => setFormMilestones((rows) => rows.map((r, idx) => idx === i ? { ...r, milestone: e.target.value } : r))} />
                    <select style={inputStyle} value={row.milestone_type} onChange={(e) => setFormMilestones((rows) => rows.map((r, idx) => idx === i ? { ...r, milestone_type: e.target.value } : r))}>
                      {MILESTONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="date" style={inputStyle} value={row.target_date} onChange={(e) => setFormMilestones((rows) => rows.map((r, idx) => idx === i ? { ...r, target_date: e.target.value } : r))} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, gridColumn: "1 / -1" }}>
                      <Target size={12} style={{ color: "var(--text-dim)" }} />
                      <input style={inputStyle} placeholder="Target metric (e.g. 10 pilots)" value={row.target_metric} onChange={(e) => setFormMilestones((rows) => rows.map((r, idx) => idx === i ? { ...r, target_metric: e.target.value } : r))} />
                    </div>
                    <select style={inputStyle} value={row.priority} onChange={(e) => setFormMilestones((rows) => rows.map((r, idx) => idx === i ? { ...r, priority: e.target.value } : r))}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select style={inputStyle} value={row.status} onChange={(e) => setFormMilestones((rows) => rows.map((r, idx) => idx === i ? { ...r, status: e.target.value } : r))}>
                      {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="button" onClick={() => setFormMilestones((rows) => rows.filter((_, idx) => idx !== i))} style={{ ...iconBtn, color: "var(--danger)", justifySelf: "start" }}><MinusCircle size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Risk Register Form ── */}
            <div style={{ marginTop: "12px", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", background: "var(--bg-surface, #F8FAFC)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <ShieldAlert size={14} style={{ color: "var(--danger)" }} />
                <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--text-primary)" }}>Risk Register — severity & mitigation</span>
                <button type="button" style={{ marginLeft: "auto", ...ghostBtn, padding: "5px 10px", fontSize: "0.7rem", color: "var(--danger)", display: "flex", alignItems: "center", gap: 5 }} onClick={addRiskRow}>
                  <PlusCircle size={13} /> Add risk
                </button>
              </div>
              {editing ? (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", padding: "4px 0 6px" }}>Risks on an existing plan are managed in the detail view / Tracker (auto-syncs to the Risk Register tab).</div>
              ) : formRisks.length === 0 ? (
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", padding: "4px 0 6px" }}>No risks logged yet — status changes in the Tracker keep the Risk Register tab in sync.</div>
              ) : null}
              <div style={{ display: "grid", gap: "8px" }}>
                {formRisks.map((row, i) => (
                  <div key={row.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "6px", alignItems: "center", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "white" }}>
                    <input style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Risk title…" value={row.risk} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, risk: e.target.value } : r))} />
                    <input style={inputStyle} placeholder="Category (e.g. Market)" value={row.category} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, category: e.target.value } : r))} />
                    <select style={inputStyle} value={row.severity} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, severity: e.target.value } : r))}>
                      <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                    </select>
                    <select style={inputStyle} value={row.impact} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, impact: e.target.value } : r))}>
                      <option>High</option><option>Medium</option><option>Low</option>
                    </select>
                    <input style={inputStyle}
                      placeholder="Probability %" type="number" min="0" max="100" value={row.probability} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, probability: e.target.value } : r))} />
                    <input type="date" style={inputStyle} value={row.due_date} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, due_date: e.target.value } : r))} />
                    <textarea style={{ ...inputStyle, minHeight: "38px", gridColumn: "1 / -1", resize: "vertical" }} placeholder="Mitigation plan…" value={row.mitigation} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, mitigation: e.target.value } : r))} />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <select style={inputStyle} value={row.priority} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, priority: e.target.value } : r))}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input style={inputStyle} placeholder="Owner" value={row.owner} onChange={(e) => setFormRisks((rows) => rows.map((r, idx) => idx === i ? { ...r, owner: e.target.value } : r))} />
                      <button type="button" onClick={() => setFormRisks((rows) => rows.filter((_, idx) => idx !== i))} style={{ ...iconBtn, color: "var(--danger)", flexShrink: 0 }}><MinusCircle size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Custom Field Injector ── */}
            <div style={{ marginTop: "12px", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", background: "var(--bg-surface, #F8FAFC)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <Target size={14} style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--text-primary)" }}>Custom Field Injector — global metadata</span>
                <button type="button" style={{ marginLeft: "auto", ...ghostBtn, padding: "5px 10px", fontSize: "0.7rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 5 }} onClick={addCustomFieldRow}>
                  <PlusCircle size={13} /> Add Field
                </button>
              </div>
              {formCustomFields.length === 0 ? (
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", padding: "4px 0 6px" }}>Optional — add custom attributes (Text, Number, Date, Dropdown, Checkbox) that appear on tracker items.</div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {formCustomFields.map((row, i) => (
                    <div key={row.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "6px", alignItems: "center", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "white" }}>
                      <input style={inputStyle} placeholder="Field label (e.g. Funding Source)" value={row.label} onChange={(e) => setFormCustomFields((rows) => rows.map((r, idx) => idx === i ? { ...r, label: e.target.value } : r))} />
                      <select style={inputStyle} value={row.type} onChange={(e) => setFormCustomFields((rows) => rows.map((r, idx) => idx === i ? { ...r, type: e.target.value } : r))}>
                        {CUSTOM_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {row.type === "select" && (
                        <input style={inputStyle} placeholder="Options comma-separated" value={row.options} onChange={(e) => setFormCustomFields((rows) => rows.map((r, idx) => idx === i ? { ...r, options: e.target.value } : r))} />
                      )}
                      <button type="button" onClick={() => setFormCustomFields((rows) => rows.filter((_, idx) => idx !== i))} style={{ ...iconBtn, color: "var(--danger)", justifySelf: "start" }}><MinusCircle size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button onClick={() => setModalOpen(false)} style={{ ...ghostBtn }}>Cancel</button>
              <button onClick={submitPlan} disabled={saving} style={{ ...primaryBtn }}>
                <RotateCcw size={14} style={{ transform: "rotate(0deg)" }} /> {saving ? "Saving…" : editing ? "Save changes" : "Create plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, value, sub }) {
  return (
    <div style={{ ...cardBox }}>
      <div style={sectionTitleSmall}>{title}</div>
      <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px", wordBreak: "break-word" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

const cardBox = {
  background: "var(--bg-white, white)", border: "1px solid var(--border-color)",
  borderRadius: "10px", padding: "12px 14px",
};

const sectionTitleSmall = {
  fontSize: "0.64rem", fontWeight: 800, textTransform: "uppercase",
  color: "var(--text-dim)", letterSpacing: "0.4px",
};

const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center", padding: "6px",
  border: "1px solid var(--border-color)", borderRadius: "7px", background: "white", cursor: "pointer",
};

const primaryBtn = {
  display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px",
  border: "none", background: "var(--primary)", color: "white", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
};

const ghostBtn = {
  padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border-color)",
  background: "white", color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
};

const sectionTitle = {
  fontSize: "0.8rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 10px",
  display: "flex", alignItems: "center", gap: "6px",
};

const modalOverlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
};

const modalBox = {
  background: "white", borderRadius: "14px", padding: "20px", maxWidth: "600px",
  width: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
};

function EmptyPill({ text }) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--bg-dark)", borderRadius: "10px", border: "1px dashed var(--border-color)", color: "var(--text-dim)", fontSize: "0.78rem", textAlign: "center" }}>
      {text}
    </div>
  );
}