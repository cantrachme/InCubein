import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  ShieldCheck,
  MapPin,
  Building2,
  Layers,
  TrendingUp,
  ArrowUpRight,
  Activity,
  Globe,
  Star,
  PieChart as PieIcon,
  BarChart2,
  Target,
  Bell
} from "lucide-react";

/* ── Skeleton Loaders ────────────────────────────────────────── */
function SkeletonMetrics() {
  return (
    <div className="metrics-grid">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div className="skeleton skeleton-text" style={{ width: "60%", height: 13 }} />
            <div className="skeleton" style={{ width: 36, height: 36 }} />
          </div>
          <div className="skeleton" style={{ height: 38, width: "50%", marginBottom: 10, borderRadius: 8 }} />
          <div className="skeleton skeleton-text" style={{ width: "70%", height: 12 }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="glass-card chart-card">
      <div className="skeleton skeleton-title" style={{ width: "45%", marginBottom: 20 }} />
      {[90, 70, 55, 40, 30, 22, 15].map((w, i) => (
        <div key={i} className="bar-wrapper">
          <div className="skeleton skeleton-text" style={{ width: 90, height: 12 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 8, width: `${w}%`, borderRadius: 99 }} />
          </div>
          <div className="skeleton skeleton-text" style={{ width: 28, height: 12 }} />
        </div>
      ))}
    </div>
  );
}

/* ── Animated KPI Card ───────────────────────────────────────── */
function MetricCard({ title, value, Icon, iconColor = "var(--primary)", trend, trendLabel, footer }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (value === undefined || value === null) return;
    const num = parseFloat(value);
    if (isNaN(num)) { setDisplayed(value); return; }
    const duration = 900;
    const steps = 30;
    const increment = num / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= num) {
        setDisplayed(num % 1 === 0 ? num : num.toFixed(1));
        clearInterval(timer);
      } else {
        setDisplayed(num % 1 === 0 ? Math.floor(current) : current.toFixed(1));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="metric-card animate-in">
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        <div className="metric-icon" style={{ background: `${iconColor}1A`, color: iconColor }}>
          <Icon size={18} />
        </div>
      </div>
      <div className="metric-value">{displayed}</div>
      <div className="metric-footer">
        <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>{footer}</span>
        {trend && (
          <span className="metric-trend up" style={{ marginLeft: "auto", background: "var(--primary-light)", color: "var(--primary)" }}>
            <ArrowUpRight size={11} /> {trend}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Horizontal Bar Chart ────────────────────────────────────── */
function BarChart({ data, valueKey = "count", labelKey, maxVal, fillStyle }) {
  if (!data || data.length === 0) return (
    <div className="empty-state" style={{ padding: "32px 0" }}>
      <p>No data available</p>
    </div>
  );

  return (
    <div className="bar-chart-container">
      {data.map((row, idx) => {
        const pct = ((row[valueKey] / maxVal) * 100).toFixed(1);
        return (
          <div key={row[labelKey] || idx} className="bar-wrapper" style={{ animationDelay: `${idx * 0.06}s` }}>
            <div className="bar-label" title={row[labelKey]}>{row[labelKey]}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${pct}%`,
                  ...fillStyle,
                  transitionDelay: `${idx * 0.04}s`,
                }}
              />
            </div>
            <div className="bar-value">{row[valueKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── SVG Donut Chart ─────────────────────────────────────────── */
function DonutChart({ data }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let accumulatedPercent = 0;
  
  const colors = ["#00B59C", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "24px", marginTop: "1rem", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: "130px", height: "130px", margin: "0 auto" }}>
        <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          {data.map((item, idx) => {
            const pct = (item.count / total) * 100;
            const strokeDash = `${pct} ${100 - pct}`;
            const strokeOffset = 100 - accumulatedPercent + 25; // 25 to start at top
            accumulatedPercent += pct;
            return (
              <circle
                key={idx}
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke={colors[idx % colors.length]}
                strokeWidth="4.2"
                strokeDasharray={strokeDash}
                strokeDashoffset={strokeOffset}
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            );
          })}
        </svg>
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none"
        }}>
          <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>{total}</span>
          <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>Total</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "150px" }}>
        {data.slice(0, 6).map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", fontSize: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: colors[idx % colors.length], flexShrink: 0 }} />
              <span style={{ color: "var(--text-body)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.region}</span>
            </div>
            <span style={{ fontWeight: 700, color: "var(--text-primary)", marginLeft: "auto", paddingLeft: 8 }}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SVG Line Chart ──────────────────────────────────────────── */
function LineChart({ leads = [] }) {
  const { days, sentData, repliesData } = React.useMemo(() => {
    const daysLabel = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const sent = [0, 0, 0, 0, 0, 0, 0];
    const replies = [0, 0, 0, 0, 0, 0, 0];

    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d.toDateString());
    }

    leads.forEach(lead => {
      if (lead.sent_at) {
        const sentDate = new Date(lead.sent_at);
        const idx = weekDates.indexOf(sentDate.toDateString());
        if (idx !== -1) {
          sent[idx]++;
        }
      }
      if (lead.reply_detected_at || ["Replied", "Meeting Scheduled"].includes(lead.status)) {
        const replyTime = lead.reply_detected_at || lead.sent_at;
        if (replyTime) {
          const replyDate = new Date(replyTime);
          const idx = weekDates.indexOf(replyDate.toDateString());
          if (idx !== -1) {
            replies[idx]++;
          }
        }
      }
    });

    return { days: daysLabel, sentData: sent, repliesData: replies };
  }, [leads]);

  const width = 450;
  const height = 180;
  const padding = 25;

  const maxVal = Math.max(...sentData, ...repliesData) || 10;

  const getPoints = (data) => {
    return data.map((val, idx) => {
      const x = padding + (idx * (width - 2 * padding)) / (data.length - 1);
      const y = height - padding - (val * (height - 2 * padding)) / maxVal;
      return `${x},${y}`;
    }).join(" ");
  };

  const sentPoints = getPoints(sentData);
  const repliesPoints = getPoints(repliesData);

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = padding + r * (height - 2 * padding);
          return (
            <line
              key={i}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="var(--border-color)"
              strokeDasharray="2 4"
            />
          );
        })}

        {days.map((day, idx) => {
          const x = padding + (idx * (width - 2 * padding)) / (days.length - 1);
          return (
            <text
              key={idx}
              x={x}
              y={height - 5}
              fill="var(--text-dim)"
              fontSize="9"
              textAnchor="middle"
              fontWeight="600"
            >
              {day}
            </text>
          );
        })}

        <polyline
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={sentPoints}
        />

        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={repliesPoints}
        />

        {sentData.map((val, idx) => {
          const x = padding + (idx * (width - 2 * padding)) / (sentData.length - 1);
          const y = height - padding - (val * (height - 2 * padding)) / maxVal;
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="4.5"
              fill="white"
              stroke="var(--primary)"
              strokeWidth="3"
            />
          );
        })}

        {repliesData.map((val, idx) => {
          const x = padding + (idx * (width - 2 * padding)) / (repliesData.length - 1);
          const y = height - padding - (val * (height - 2 * padding)) / maxVal;
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="4.5"
              fill="white"
              stroke="var(--accent)"
              strokeWidth="3"
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.76rem" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--primary)" }} />
          <span style={{ color: "var(--text-body)", fontWeight: 600 }}>Emails Dispatched</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.76rem" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent)" }} />
          <span style={{ color: "var(--text-body)", fontWeight: 600 }}>Responses Detected</span>
        </div>
      </div>
    </div>
  );
}

/* ── Campaign Conversion Funnel Widget ────────────────────────── */
function FunnelWidget({ leads }) {
  const total = leads.length;
  const sent = leads.filter(l => l.status !== "Draft").length;
  const replied = leads.filter(l => ["Replied", "Meeting Scheduled", "Not Interested", "In Loop", "Interviewed", "Incubated"].includes(l.status)).length;
  const meetings = leads.filter(l => ["Meeting Scheduled", "Interviewed"].includes(l.status)).length;

  const getPct = (val) => {
    if (!sent) return 0;
    return Math.round((val / sent) * 100);
  };

  const stages = [
    { label: "Targeted Leads", val: total, color: "#3B82F6", width: "100%" },
    { label: "Emails Sent", val: sent, color: "var(--primary)", width: `${total ? Math.round((sent/total)*100) : 0}%` },
    { label: "Replies Received", val: replied, color: "#F59E0B", width: `${sent ? Math.round((replied/sent)*100) : 0}%` },
    { label: "Meetings Booked", val: meetings, color: "#10B981", width: `${replied ? Math.round((meetings/replied)*100) : 0}%` }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "1rem" }}>
      {stages.map((stage, idx) => (
        <div key={idx} style={{ animation: `fadeSlideUp 0.35s var(--ease-out) ${idx * 0.05}s both` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px" }}>
            <span>{stage.label}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              {stage.val} <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 500 }}>({idx === 0 ? "100%" : `${getPct(stage.val)}%`})</span>
            </span>
          </div>
          <div style={{ width: "100%", height: "8px", background: "var(--bg-surface)", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ width: stage.width, height: "100%", background: stage.color, borderRadius: "99px", transition: "width 1s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Top Incubators Widget ───────────────────────────────────── */
function TopIncubatorsWidget({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="glass-card chart-card">
      <h3>
        <Star size={16} color="var(--warning)" style={{ marginRight: 4 }} />
        Top Ranked Incubators Leaderboard
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.slice(0, 6).map((inc, idx) => (
          <div
            key={inc.name || idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: "var(--bg-surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              animation: `fadeSlideUp 0.4s var(--ease-out) ${idx * 0.05}s both`,
            }}
          >
            <div style={{
              width: 28, height: 28,
              borderRadius: "50%",
              background: idx === 0 ? "linear-gradient(135deg, #F59E0B, #FCD34D)" : idx === 1 ? "linear-gradient(135deg, #94A3B8, #CBD5E1)" : idx === 2 ? "linear-gradient(135deg, #D97706, #F59E0B)" : "var(--primary-light)",
              color: idx < 3 ? "white" : "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "0.75rem", flexShrink: 0,
            }}>
              {idx + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inc.name}
              </div>
              {inc.city && (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={10} /> {inc.city}{inc.state ? `, ${inc.state}` : ""}
                </div>
              )}
            </div>
            {inc.startups_count !== undefined && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--primary)" }}>{inc.startups_count}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Startups</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Startup Stage Distribution Card ────────────────────────── */
function StartupStagesWidget({ data }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const colors = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899", "#6366F1"];

  return (
    <div className="glass-card chart-card">
      <h3>
        <BarChart2 size={16} style={{ color: "#10B981", marginRight: 4 }} />
        Startup Funding Stage Breakdown
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
        {data.map((item, idx) => {
          const pct = total ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={idx} style={{ animation: `fadeSlideUp 0.35s var(--ease-out) ${idx * 0.05}s both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px" }}>
                <span>{item.funding_stage || "Unspecified"}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {item.count} <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 500 }}>({pct}%)</span>
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "var(--bg-surface)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: colors[idx % colors.length], borderRadius: "99px", transition: "width 1s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Startup Type (Stage Category) Distribution Card ──────── */
const STAGE_CAT_COLORS = {
  "Ideation":       { bar: "#4338CA", bg: "#EEF2FF" },
  "Prototype":      { bar: "#166534", bg: "#F0FDF4" },
  "MVP/Pre-Revenue": { bar: "#9A3412", bg: "#FFF7ED" },
  "Revenue":        { bar: "#991B1B", bg: "#FEF2F2" },
  "Growth/Scaling": { bar: "#86198F", bg: "#FDF4FF" },
  "Seed Stage":     { bar: "#065F46", bg: "#ECFDF5" },
};

function StartupCategoryWidget({ data }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="glass-card chart-card">
      <h3>
        <PieIcon size={16} style={{ color: "#8B5CF6", marginRight: 4 }} />
        Startup Type Distribution
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
        {data.map((item, idx) => {
          const pct = total ? Math.round((item.count / total) * 100) : 0;
          const cat = item.stage_category || "Unspecified";
          const colors = STAGE_CAT_COLORS[cat] || { bar: "#6B7280", bg: "#F3F4F6" };
          return (
            <div key={idx} style={{ animation: `fadeSlideUp 0.35s var(--ease-out) ${idx * 0.05}s both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-body)", marginBottom: "4px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: colors.bar, display: "inline-block" }} />
                  {cat}
                </span>
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {item.count} <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 500 }}>({pct}%)</span>
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "var(--bg-surface)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${colors.bar}, ${colors.bar}aa)`, borderRadius: "99px", transition: "width 1s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Entity Timeline & Interaction History Modal ─────────── */
function TimelineModal({ lead, onClose, onRefresh }) {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [newStage, setNewStage] = useState(lead.status || "Draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/outreach/lead-timeline/${lead.id}`);
        if (res.ok) {
          const data = await res.json();
          setTimelineData(data);
          setNotes(data.lead?.notes || "");
          setNewStage(data.lead?.status || "Draft");
        }
      } catch (e) {
        console.error("Error fetching timeline:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [lead.id]);

  const handleUpdateStageAndNotes = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/outreach/update-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          stage: newStage,
          notes: notes
        })
      });
      if (res.ok) {
        toast.success("Collaboration stage & notes updated!");
        if (onRefresh) onRefresh();
      } else {
        toast.error("Failed to update status.");
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: "20px"
    }}>
      <div style={{
        background: "white", width: "100%", maxWidth: "620px", maxHeight: "90vh",
        borderRadius: "var(--radius-xl)", border: "1px solid var(--border-color)",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", display: "flex", flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* Modal Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
              📋 Interaction History Log & Progress
            </h3>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
              {lead.incubator_name} ({lead.email})
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Quick Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", background: "var(--bg-surface)", padding: "12px", borderRadius: "var(--radius-md)" }}>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Times Contacted</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary)" }}>{lead.contact_count || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Current Stage</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#10B981", marginTop: "4px" }}>{newStage}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Entity Type</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
                {lead.incubator_id === "incubein_cohort" ? "Startup" : "Incubator"}
              </div>
            </div>
          </div>

          {/* Timeline Events */}
          <div>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Chronological Activity Log
            </h4>
            {loading ? (
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Loading activity timeline...</p>
            ) : timelineData?.timeline?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderLeft: "2px solid var(--border-color)", paddingLeft: "16px", marginLeft: "8px" }}>
                {timelineData.timeline.map((item, idx) => (
                  <div key={idx} style={{ position: "relative", marginBottom: "14px" }}>
                    <div style={{
                      position: "absolute", left: "-23px", top: "2px", width: "14px", height: "14px",
                      borderRadius: "50%",
                      background: item.type === "collaboration" ? "#10B981" : item.type === "meeting" ? "#8B5CF6" : item.type === "reply" ? "#F59E0B" : "var(--primary)",
                      border: "2px solid white", boxShadow: "0 0 0 2px rgba(0,0,0,0.05)"
                    }} />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.title}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 500 }}>{item.timestamp}</div>
                    </div>

                    {item.type === "reply" && (
                      <div style={{ display: "flex", gap: "6px", margin: "6px 0", flexWrap: "wrap" }}>
                        {item.intent && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
                            🎯 Intent: {item.intent}
                          </span>
                        )}
                        {item.score !== undefined && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: "#E0E7FF", color: "#3730A3", border: "1px solid #C7D2FE" }}>
                            ⭐ Interest Score: {item.score}/100
                          </span>
                        )}
                        {item.sentiment && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: "#D1FAE5", color: "#065F46", border: "1px solid #A7F3D0" }}>
                            😊 Sentiment: {item.sentiment}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{
                      fontSize: "0.8rem", color: "var(--text-body)", background: item.type === "reply" ? "#F8FAFC" : "var(--bg-surface)",
                      padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", marginTop: "4px",
                      lineHeight: 1.5, whiteSpace: "pre-wrap"
                    }}>
                      {item.clean_text || item.details}
                    </div>

                    {item.quoted_history && (
                      <details style={{ marginTop: "6px" }}>
                        <summary style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                          📄 Show original quoted thread
                        </summary>
                        <div style={{
                          fontSize: "0.72rem", color: "var(--text-muted)", background: "#F1F5F9",
                          padding: "8px 10px", borderRadius: "6px", marginTop: "4px", fontStyle: "italic",
                          whiteSpace: "pre-wrap", borderLeft: "3px solid #CBD5E1", maxHeight: "150px", overflowY: "auto"
                        }}>
                          {item.quoted_history}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>No activity recorded yet.</p>
            )}
          </div>

          {/* Update Stage & Notes Section */}
          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Update Progress Stage & Information Notes
            </h4>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Advance Collaboration Stage:
              </label>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.85rem" }}
              >
                <option value="Draft">Draft / Discovered</option>
                <option value="Sent">Outreach Sent</option>
                <option value="Follow-up Sent">Follow-up Sent</option>
                <option value="Replied">Replied & Interacted</option>
                <option value="Meeting Scheduled">Meeting Scheduled</option>
                <option value="MOUs">MOU Signed & Executed</option>
                <option value="Incubated">Active Incubation (Startup)</option>
                <option value="TBI Partnership">TBI Partnership (Incubator)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Collected Information & Notes:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter information received, mail records, pitch deck links, meeting outcomes, or MOU terms..."
                rows={3}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.82rem", resize: "vertical" }}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "10px", background: "var(--bg-surface)" }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
            Close
          </button>
          <button onClick={handleUpdateStageAndNotes} disabled={saving} className="btn btn-primary" style={{ fontSize: "0.8rem" }}>
            {saving ? "Saving..." : "Save Progress Updates"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Collaboration Lifecycle & Progress Pipeline Widget ────── */
function CollaborationLifecycleWidget({ collaborationData, onSelectLead }) {
  const [stageFilter, setStageFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  if (!collaborationData) return null;
  const { pipeline_stages = [], total_contacts_dispatched = 0, leads = [] } = collaborationData;

  useEffect(() => {
    setCurrentPage(1);
  }, [stageFilter]);

  const stageColors = {
    "Ranked & Evaluated": "#64748B",
    "Outreach Dispatched": "#3B82F6",
    "Interactions & Replies": "#8B5CF6",
    "Meetings Booked": "#F59E0B",
    "MOUs Signed": "#10B981",
    "Active Incubation": "#059669",
    "TBI Partnerships": "#0284C7"
  };

  const isStageActive = (stgStage) => {
    if (stageFilter === stgStage) return true;
    if (stgStage === "Outreach Dispatched" && ["Outreach Dispatched", "Outreach Sent", "Sent"].includes(stageFilter)) return true;
    if (stgStage === "Interactions & Replies" && ["Interactions & Replies", "Replied", "Interacted"].includes(stageFilter)) return true;
    if (stgStage === "Meetings Booked" && ["Meetings Booked", "Meeting Scheduled", "Scheduled"].includes(stageFilter)) return true;
    if (stgStage === "MOUs Signed" && ["MOUs Signed", "MOU Signed", "MOUs", "MOU"].includes(stageFilter)) return true;
    if (stgStage === "Active Incubation" && ["Active Incubation", "Incubated", "Incubation"].includes(stageFilter)) return true;
    if (stgStage === "TBI Partnerships" && ["TBI Partnerships", "TBI Partnership", "Partnership"].includes(stageFilter)) return true;
    return false;
  };

  const filteredLeads = leads.filter(l => {
    if (stageFilter === "All") return true;
    if (stageFilter === "Ranked & Evaluated") return true;
    if (stageFilter === "Outreach Dispatched" || stageFilter === "Outreach Sent" || stageFilter === "Sent") {
      return ["Sent", "Follow-up Sent"].includes(l.status);
    }
    if (stageFilter === "Interactions & Replies" || stageFilter === "Replied" || stageFilter === "Interacted") {
      return ["Replied", "In Loop", "Interviewed"].includes(l.status);
    }
    if (stageFilter === "Meetings Booked" || stageFilter === "Meeting Scheduled" || stageFilter === "Scheduled") {
      return ["Meeting Scheduled"].includes(l.status);
    }
    if (stageFilter === "MOUs Signed" || stageFilter === "MOU Signed" || stageFilter === "MOUs" || stageFilter === "MOU") {
      return ["MOUs", "MOU Signed", "MOU"].includes(l.status);
    }
    if (stageFilter === "Active Incubation" || stageFilter === "Incubated" || stageFilter === "Incubation") {
      return ["Incubated"].includes(l.status);
    }
    if (stageFilter === "TBI Partnerships" || stageFilter === "TBI Partnership" || stageFilter === "Partnership") {
      return ["TBI Partnership"].includes(l.status);
    }
    return l.status === stageFilter;
  });

  const totalLeads = filteredLeads.length;
  const isAllPage = pageSize === "All";
  const effectivePageSize = isAllPage ? totalLeads : Number(pageSize);
  const totalPages = isAllPage || totalLeads === 0 ? 1 : Math.ceil(totalLeads / effectivePageSize);
  const startIndex = isAllPage ? 0 : (currentPage - 1) * effectivePageSize;
  const endIndex = isAllPage ? totalLeads : Math.min(startIndex + effectivePageSize, totalLeads);
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          🤝 Collaboration & Incubation Progress Tracker
        </h3>
        <span style={{ fontSize: "0.78rem", background: "#EFF6FF", color: "#2563EB", padding: "4px 10px", borderRadius: "12px", fontWeight: 700, border: "1px solid #BFDBFE" }}>
          {total_contacts_dispatched} Total Contact Outreach Interactions Dispatched
        </span>
      </div>

      {/* Stage Funnel Visual Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        {pipeline_stages.map((stg, i) => {
          const active = isStageActive(stg.stage);
          return (
            <div
              key={i}
              onClick={() => setStageFilter(active ? "All" : stg.stage)}
              style={{
                background: "white",
                padding: "12px 14px",
                borderRadius: "var(--radius-lg)",
                border: `1px solid ${active ? stageColors[stg.stage] || "var(--primary)" : "var(--border-color)"}`,
                boxShadow: active ? "0 4px 12px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{stg.stage}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: stageColors[stg.stage] || "var(--primary)", marginTop: "4px" }}>
                {stg.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leads Table */}
      <div className="glass-card" style={{ padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Entity Collaboration Progress ({totalLeads})
          </h4>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 600 }}>Filter:</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="pagination-size-select"
              style={{ fontSize: "0.78rem", padding: "4px 8px" }}
            >
              <option value="All">All Stages</option>
              <option value="Ranked & Evaluated">Ranked & Evaluated</option>
              <option value="Outreach Dispatched">Outreach Dispatched</option>
              <option value="Interactions & Replies">Interactions & Replies</option>
              <option value="Meetings Booked">Meetings Booked</option>
              <option value="MOUs Signed">MOUs Signed</option>
              <option value="Active Incubation">Active Incubation</option>
              <option value="TBI Partnerships">TBI Partnerships</option>
            </select>
          </div>
        </div>

        {totalLeads === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", textAlign: "center", padding: "20px 0" }}>
            No entity collaborations found in this stage.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", color: "var(--text-muted)", fontWeight: 700 }}>
                    <th style={{ padding: "8px 10px" }}>Entity Name</th>
                    <th style={{ padding: "8px 10px" }}>Email / Contact</th>
                    <th style={{ padding: "8px 10px", textAlign: "center" }}>Times Contacted</th>
                    <th style={{ padding: "8px 10px" }}>Current Stage</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "10px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {lead.incubator_name}
                        <span style={{ display: "block", fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 500 }}>
                          {lead.incubator_id === "incubein_cohort" ? "Startup" : "Incubator Hub"}
                        </span>
                      </td>
                      <td style={{ padding: "10px", color: "var(--text-muted)" }}>{lead.email}</td>
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "var(--primary)" }}>
                        {lead.contact_count || 0}
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 700,
                          background: lead.status === "Incubated" ? "#D1FAE5" : lead.status === "MOUs" ? "#FEF3C7" : lead.status === "Meeting Scheduled" ? "#E0E7FF" : "var(--bg-surface)",
                          color: lead.status === "Incubated" ? "#065F46" : lead.status === "MOUs" ? "#92400E" : lead.status === "Meeting Scheduled" ? "#3730A3" : "var(--text-body)",
                          border: "1px solid var(--border-color)"
                        }}>
                          {lead.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="btn btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <FileText size={12} /> Timeline Log
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalLeads > (isAllPage ? 999999 : pageSize) && (
              <div className="pagination-container" style={{ marginTop: "14px" }}>
                <div className="pagination-info">
                  Showing <strong>{startIndex + 1} – {endIndex}</strong> of <strong>{totalLeads}</strong> entities
                </div>
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    « Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                    .map((page, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const hasGap = prevPage && page - prevPage > 1;
                      return (
                        <React.Fragment key={page}>
                          {hasGap && <span style={{ color: "var(--text-dim)", padding: "0 4px" }}>...</span>}
                          <button
                            className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  <button
                    className="pagination-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    Next »
                  </button>
                </div>
                <div className="pagination-size-select">
                  <span>Per page:</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(e.target.value === "All" ? "All" : Number(e.target.value)); setCurrentPage(1); }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value="All">All</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main Dashboard Component ────────────────────────────────── */
export default function AnalyticsDashboard({ analyticsData, loading }) {
  const [viewMode, setViewMode] = useState("incubators"); // "incubators" | "startups" (Ecosystem Overview & Collaboration Pipeline moved out / on hold)
  const [recentActivity, setRecentActivity] = useState(null);

  const fetchRecentActivity = async () => {
    try {
      const res = await fetch("/api/outreach/activity-feed?limit=1", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setRecentActivity((json && json.total) || (Array.isArray(json) ? json.length : null));
      }
    } catch (e) {
      console.error("Error fetching recent activity:", e);
    }
  };

  useEffect(() => {
    fetchRecentActivity();
  }, []);

  if (loading) {
    return (
      <div>
        <SkeletonMetrics />
        <div className="dashboard-grid">
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  if (!analyticsData || !analyticsData.totals) {
    return (
      <div className="empty-state">
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "var(--bg-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          border: "1px solid var(--border-color)",
        }}>
          <Activity size={28} color="var(--text-dim)" />
        </div>
        <h3>No Data Found</h3>
        <p>Run the scraping pipeline to collect and analyze startup ecosystem data.</p>
      </div>
    );
  }

  const {
    totals,
    state_distribution,
    region_distribution,
    org_type_distribution,
    top_hubs,
    sector_distribution,
    top_incubators,
    startup_analytics
  } = analyticsData;

  const maxStateVal  = state_distribution?.length  > 0 ? state_distribution[0].count  : 1;
  const maxRegionVal = region_distribution?.length > 0 ? region_distribution[0].count : 1;
  const maxSectorVal = sector_distribution?.length > 0 ? sector_distribution[0].count : 1;

  // Startup analytics metrics
  const startupSectors = startup_analytics?.sector_distribution || [];
  const maxStartupSectorVal = startupSectors.length > 0 ? startupSectors[0].count : 1;

  const startupCities = startup_analytics?.city_distribution || [];
  const maxStartupCityVal = startupCities.length > 0 ? startupCities[0].count : 1;

  const startupStages = startup_analytics?.stage_distribution || [];
  const startupCategories = startup_analytics?.stage_category_distribution || [];
  const totalStartupsCount = totals.startups || (startup_analytics?.total_startups || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* View Mode Navigation Tabs */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "white",
        padding: "10px 14px",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-color)",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={`btn ${viewMode === "incubators" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setViewMode("incubators")}
            style={{ fontSize: "0.82rem", padding: "6px 14px" }}
          >
            🏢 Incubator Analysis
          </button>
          <button
            className={`btn ${viewMode === "startups" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setViewMode("startups")}
            style={{ fontSize: "0.82rem", padding: "6px 14px" }}
          >
            🚀 Startup Analysis
          </button>
        </div>

        <button
          className="btn btn-secondary"
          onClick={fetchRecentActivity}
          style={{ fontSize: "0.78rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
          title="Click for the detailed activity timeline in VIEW → Timeline. Detailed per-entity logs live there."
        >
          <Bell size={13} style={{ color: "var(--warning)" }} />
          Recent Activity: {recentActivity === null ? "…" : recentActivity}
          <span style={{ fontSize: "0.64rem", color: "var(--text-dim)" }}>(timeline →)</span>
        </button>
      </div>

      {/* KPI Metrics Row */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {viewMode === "incubators" ? (
          <>
            <MetricCard title="Total Incubators" value={totals.incubators} Icon={ShieldCheck} iconColor="var(--primary)" footer="Active innovation hubs" />
            <MetricCard title="States Covered" value={totals.states} Icon={MapPin} iconColor="var(--info)" footer="Unique Indian states" />
            <MetricCard title="Cities Covered" value={totals.cities} Icon={Building2} iconColor="var(--warning)" footer="Active urban hubs" />
            <MetricCard title="Sectors Supported" value={totals.sectors} Icon={Layers} iconColor="var(--accent)" footer="Technology verticals" />
          </>
        ) : (
          <>
            <MetricCard title="Total Startups" value={totalStartupsCount} Icon={Target} iconColor="#10B981" footer="Tracked & cohort startups" />
            <MetricCard title="Avg Evaluation Readiness" value={totals.avg_confidence_score || 0} Icon={Star} iconColor="#8B5CF6" footer="Readiness score / 100" />
            <MetricCard title="Incubator Associated" value={totals.incubated_startups || 0} Icon={ShieldCheck} iconColor="#3B82F6" footer="Cohort startups" />
          </>
        )}
      </div>

      {/* ─── INCUBATOR ANALYSIS VIEW ──────────────────────────── */}
      {viewMode === "incubators" && (
        <div className="dashboard-grid">
          {/* Sector Distribution */}
          <div className="glass-card chart-card">
            <h3>
              <TrendingUp size={16} style={{ color: "var(--info)" }} />
              Top Incubator Sectors
            </h3>
            <BarChart
              data={sector_distribution?.slice(0, 8)}
              labelKey="sector"
              maxVal={maxSectorVal}
              fillStyle={{ background: "linear-gradient(90deg, #3B82F6, #60A5FA)" }}
            />
          </div>

          {/* Organization Type Distribution */}
          <div className="glass-card chart-card">
            <h3>
              <Building2 size={16} style={{ color: "var(--primary)" }} />
              Incubator Organization Types
            </h3>
            <BarChart
              data={org_type_distribution}
              labelKey="organization_type"
              valueKey="count"
              maxVal={org_type_distribution?.length > 0 ? org_type_distribution[0].count : 1}
              fillStyle={{ background: "linear-gradient(90deg, #10B981, #34D399)" }}
            />
          </div>

          {/* Regional Distribution */}
          <div className="glass-card chart-card">
            <h3>
              <Globe size={16} style={{ color: "var(--accent)" }} />
              Regional Distribution
            </h3>
            <BarChart
              data={region_distribution}
              labelKey="region"
              maxVal={maxRegionVal}
              fillStyle={{ background: "linear-gradient(90deg, var(--primary), #34D399)" }}
            />
          </div>

          {/* State Distribution */}
          <div className="glass-card chart-card">
            <h3>
              <MapPin size={16} style={{ color: "var(--warning)" }} />
              Incubator Density by State
            </h3>
            <BarChart
              data={state_distribution?.slice(0, 8)}
              labelKey="state"
              maxVal={maxStateVal}
              fillStyle={{ background: "linear-gradient(90deg, #F59E0B, #FCD34D)" }}
            />
          </div>

          {/* Top Incubators Leaderboard */}
          {top_incubators && top_incubators.length > 0 && (
            <TopIncubatorsWidget data={top_incubators} />
          )}
        </div>
      )}

      {/* ─── STARTUPS DEEP DIVE VIEW ───────────────────────────── */}
      {viewMode === "startups" && (
        <div style={{ marginTop: viewMode === "startups" ? "0" : "10px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              🚀 Detailed Startup Analysis
            </h3>
            <span style={{ fontSize: "0.75rem", background: "var(--primary-light)", color: "var(--primary)", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
              {totalStartupsCount} Startups
            </span>
          </div>

          <div className="dashboard-grid">
            
            {/* Startup Sector Breakdown */}
            <div className="glass-card chart-card">
              <h3>
                <Layers size={16} style={{ color: "#3B82F6" }} />
                Startup Verticals & Sectors
              </h3>
              <BarChart
                data={startupSectors.slice(0, 8)}
                labelKey="sector"
                maxVal={maxStartupSectorVal || 1}
                fillStyle={{ background: "linear-gradient(90deg, #3B82F6, #60A5FA)" }}
              />
            </div>

            {/* Startup Funding Stages */}
            <StartupStagesWidget data={startupStages} />

            {/* Startup Type (Stage Category) Distribution */}
            <StartupCategoryWidget data={startupCategories} />

            {/* Startup HQ Cities */}
            <div className="glass-card chart-card">
              <h3>
                <Building2 size={16} style={{ color: "#F59E0B" }} />
                Top Startup Cities / Hubs
              </h3>
              <BarChart
                data={startupCities}
                labelKey="hq_city"
                maxVal={maxStartupCityVal || 1}
                fillStyle={{ background: "linear-gradient(90deg, #F59E0B, #FCD34D)" }}
              />
            </div>

            {/* Evaluation & Cohort Score Breakdown */}
            <div className="glass-card chart-card">
              <h3>
                <Target size={16} style={{ color: "#8B5CF6" }} />
                Startup Evaluation & Readiness
              </h3>
              <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)", padding: "12px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600 }}>Avg Evaluation Readiness</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)" }}>{totals.avg_confidence_score || 0} / 100</div>
                  </div>
                  <Star size={32} color="var(--primary)" />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)", padding: "12px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600 }}>Incubator Associated</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#3B82F6" }}>{totals.incubated_startups || 0} Startups</div>
                  </div>
                  <ShieldCheck size={32} color="#3B82F6" />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Detailed per-entity activity lives in VIEW → Timeline (interactive, clickable). */}
    </div>
  );
}
