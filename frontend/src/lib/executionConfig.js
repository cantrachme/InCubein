// Shared taxonomy + CSV helpers for the Execution section.

export const OWNERS = [
  "Incubation Manager",
  "CEO",
  "Manager Innovation",
  "Technical Assistant",
  "Program Coordinator",
  "Mentor",
];

export const STEP_STATUSES = ["Not Started", "In Progress", "Completed", "Delayed", "Blocked", "Achieved"];

export const MILESTONE_STATUSES = ["Not Started", "In Progress", "Completed", "Achieved", "Delayed", "Blocked", "Cancelled"];

export const RISK_STATUSES = ["Open", "Monitoring", "Mitigating", "Closed"];

export const PRIORITIES = ["P1 Critical", "P2 High", "P3 Medium", "P4 Low"];

export function p1toP4(value) {
  const v = String(value || "").trim();
  if (/P1/i.test(v)) return "P1 Critical";
  if (/P2/i.test(v)) return "P2 High";
  if (/P4/i.test(v)) return "P4 Low";
  if (/P3/i.test(v)) return "P3 Medium";
  if (/^crit/i.test(v)) return "P1 Critical";
  if (/^high/i.test(v)) return "P2 High";
  if (/^low/i.test(v)) return "P4 Low";
  if (/^medi/i.test(v) || /^moderate/i.test(v)) return "P3 Medium";
  return v || "";
}

export const MILESTONE_TYPES = [
  "MVP",
  "IP Filing",
  "First Revenue",
  "Product-Market Fit",
  "Grant Received",
  "Rs 1 Lakh Revenue",
  "Pilot Signed",
  "Funding Milestone",
  "Other",
];

export const PLAN_SOURCES = ["Mentor Meeting", "Quarterly Review", "Startup Audit", "Review", "Incubation Manager", "CEO Office"];

export const PLAN_STATUSES = ["Active", "Completed", "On Hold", "Cancelled"];

export const STATUS_STYLE = {
  "Not Started": { bg: "#F3F4F6", color: "#6b7280" },
  "In Progress": { bg: "#DBEAFE", color: "#2563eb" },
  Completed: { bg: "#DCFCE7", color: "#16a34a" },
  Achieved: { bg: "#DCFCE7", color: "#047857" },
  Delayed: { bg: "#FFEDD5", color: "#ea580c" },
  Blocked: { bg: "#FEE2E2", color: "#dc2626" },
  Cancelled: { bg: "#F3F4F6", color: "#9ca3af" },
  Open: { bg: "#FEF3C7", color: "#d97706" },
  Monitoring: { bg: "#DBEAFE", color: "#2563eb" },
  Mitigating: { bg: "#EDE9FE", color: "#7c3aed" },
  Closed: { bg: "#DCFCE7", color: "#16a34a" },
};

export const PRIORITY_STYLE = {
  "P1 Critical": { bg: "#FEE2E2", color: "#b91c1c" },
  "P2 High": { bg: "#FFEDD5", color: "#c2410c" },
  "P3 Medium": { bg: "#FEF3C7", color: "#92400e" },
  "P4 Low": { bg: "#DCFCE7", color: "#065f46" },
};

export const RAG_STYLE = {
  RED: { bg: "#FEE2E2", color: "#b91c1c" },
  AMBER: { bg: "#FEF3C7", color: "#92400e" },
  GREEN: { bg: "#DCFCE7", color: "#065f46" },
};

// ── CSV helpers ────────────────────────────────────────────────

export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => c.label).join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(filename, rows, columns) {
  const blob = new Blob(["\uFEFF" + toCsv(rows, columns)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTemplate(filename, columns) {
  downloadCsv(filename, [{ ...columns.reduce((acc, c) => ({ ...acc, [c.key]: c.sample !== undefined ? c.sample : "" }), {}) }], columns);
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const text = String(reader.result || "").replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        resolve([]);
        return;
      }
      const header = splitLine(lines[0]).map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const vals = splitLine(line);
        const obj = {};
        header.forEach((h, i) => {
          obj[h] = vals[i] !== undefined ? vals[i].trim() : "";
        });
        return obj;
      });
      resolve(rows);
    };
    reader.readAsText(file);
  });
}

function splitLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}