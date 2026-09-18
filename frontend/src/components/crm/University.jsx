import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { RefreshCw, GraduationCap, School, Users, Lightbulb, ArrowUpRight, FileCheck2, Building2 } from "lucide-react";
import { getUniversity } from "../../lib/crmApi";
import { Card, Stat, StagePill, Loading, Empty, SyncButton, fmtNum } from "./CrmUi";

function MiniTable({ cols, rows, rowKey }) {
  if (!rows || rows.length === 0) return <Empty title="Nothing here" />;
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[rowKey] ?? r.id}>
              {cols.map((c) => <td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function University() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getUniversity());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Loading the university network…" />;
  if (!data) return <Empty title="No university data" />;

  const t = data.totals || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 0 }}>
        <Stat label="Colleges Engaged" value={fmtNum(t.colleges)} icon={<School size={16} />} tone="primary" />
        <Stat label="MoUs Signed" value={fmtNum(t.mou_signed)} icon={<FileCheck2 size={16} />} tone="success" />
        <Stat label="Students Reached" value={fmtNum(t.students_reached)} icon={<Users size={16} />} tone="info" />
        <Stat label="Ideas Generated" value={fmtNum(t.ideas_generated)} icon={<Lightbulb size={16} />} tone="warning" />
        <Stat label="Student Referrals" value={fmtNum(t.referrals)} icon={<ArrowUpRight size={16} />} tone="accent" />
        <Stat label="Student Pipeline" value={fmtNum(t.student_pipeline)} icon={<GraduationCap size={16} />} tone="purple" />
        <Stat label="Startups Created" value={fmtNum(t.startups_created)} icon={<Building2 size={16} />} tone="danger" />
      </div>

      <Card title="Partner Colleges" subtitle="Institutional engagement across the RTMNU ecosystem" action={<span className="badge badge-primary"><School size={11} /> {data.colleges?.length || 0} colleges</span>}>
        <MiniTable
          rowKey="id"
          cols={[
            { key: "code", label: "Code" },
            { key: "name", label: "College", render: (r) => <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{r.name}</span> },
            { key: "district", label: "District" },
            { key: "college_type", label: "Type" },
            { key: "students_reached", label: "Students", render: (r) => fmtNum(r.students_reached) },
            { key: "ideas_generated", label: "Ideas", render: (r) => fmtNum(r.ideas_generated) },
            { key: "referrals_count", label: "Referrals", render: (r) => fmtNum(r.referrals_count) },
            { key: "mou", label: "MoU", render: (r) => (
              <span className={`badge ${r.mou === "Signed" || r.mou === "Active" ? "badge-success" : r.mou === "Draft" ? "badge-warning" : "badge-neutral"}`}>{r.mou || "—"}</span>
            ) },
            { key: "status", label: "Status" },
          ]}
          rows={data.colleges || []}
        />
      </Card>

      <Card title="Student Pipeline" subtitle="Ideas captured from partner colleges and their progress" action={<span className="badge badge-primary"><GraduationCap size={11} /> {data.students?.length || 0} students</span>}>
        <MiniTable
          rowKey="id"
          cols={[
            { key: "code", label: "Code" },
            { key: "student_name", label: "Student", render: (r) => <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{r.student_name}</span> },
            { key: "college_name", label: "College" },
            { key: "course", label: "Course" },
            { key: "idea", label: "Idea", render: (r) => <span style={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.idea || "—"}</span> },
            { key: "sector", label: "Sector" },
            { key: "stage", label: "Stage", render: (r) => <StagePill value={r.stage} /> },
            { key: "referral", label: "Referred", render: (r) => (
              <span className={`badge ${r.referral === "Yes" ? "badge-success" : "badge-neutral"}`}>{r.referral || "No"}</span>
            ) },
            { key: "startup_created", label: "Startup", render: (r) => (
              <span className={`badge ${r.startup_created === "Yes" ? "badge-primary" : "badge-neutral"}`}>{r.startup_created || "No"}</span>
            ) },
          ]}
          rows={data.students || []}
        />
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
        <SyncButton />
        <button className="btn btn-secondary btn-icon" onClick={load} title="Refresh university data"><RefreshCw size={14} /></button>
      </div>
    </div>
  );
}