import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { 
  Mail, 
  MessageSquare, 
  Brain, 
  Calendar, 
  Sparkles, 
  Send, 
  RefreshCcw, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  Play, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  PenTool,
  Trash2,
  Upload,
  Download
} from "lucide-react";

// Academic Collaboration Template
const getAcademicMouText = (data) => `STRATEGIC INSTITUTIONAL COLLABORATION MOU

This Memorandum of Understanding (hereinafter referred to as the "MoU") is entered into on this ${data.date} ("Effective Date"), by and between:

PARTY A:
${data.incubatorName || "[Select Party A Incubator]"}
Located at: ${data.incubatorCity || "City"}, ${data.incubatorState || "State"}, India
Represented by: ${data.incubatorRep || "[Incubator Representative Name]"}
(hereinafter referred to as the "First Party", which expression shall include its successors-in-interest and permitted assigns);

AND

PARTY B:
${data.partyBName || "[Partner Institution Name]"}
Contact Email: ${data.partyBEmail || "[Contact Email]"}
Represented by: ${data.partyBRep || "[Representative Name]"}
(hereinafter referred to as the "Second Party", which expression shall include its successors-in-interest and permitted assigns).

WHEREAS:
A. The First Party is an innovation hub and incubator committed to commercializing breakthrough scientific and technology startup models.
B. The Second Party is a premier research/academic institution aiming to provide its students and faculty with avenues for incubation and commercial innovation.
C. Both Parties intend to cooperate in co-developing research and innovation programs in the fields of: ${data.targetSectors || "Emerging Technologies"}.

NOW, THEREFORE, THE PARTIES AGREE AS FOLLOWS:

1. AREAS OF STRATEGIC COOPERATION
1.1 Joint Projects: The Parties agree to co-develop joint research proposals, exchange scientific literature, and co-sponsor technical hackathons and incubator pitch days.
1.2 Shared Resources: Subject to availability, both Parties will provide access to scientific research labs, testing equipment, and library resources to scholars and startups of either party.
1.3 Incubation Pipeline: The Second Party will refer student entrepreneurs and faculty spin-offs to the First Party for commercial incubation support.

2. INTELLECTUAL PROPERTY & RESEARCH PUBLICATIONS
2.1 Pre-existing IP: Intellectual property owned by either party prior to the Effective Date shall remain the sole property of that respective party.
2.2 Collaborative IP: Any intellectual property generated jointly during the collaborative projects under this MoU shall be owned jointly. Sharing of patents and licensing terms will be negotiated separately.
2.3 Publications: Co-authored scientific papers resulting from joint research may be published by mutual consent, acknowledging both institutions.

3. FINANCIAL ARRANGEMENTS
3.1 Project-Specific: This MoU does not constitute any direct financial commitment. Individual collaborative projects or research grants shall have separate financial agreements negotiated and signed by authorized officials.

4. DURATION AND AMENDMENT
4.1 Term: This MoU is valid for a period of ${data.duration || "3 Years"} and may be extended by mutual written agreement.
4.2 Termination: Either Party may terminate this MoU with sixty (60) days prior written notice. Active projects or students currently undertaking internships shall not be affected by such termination.

5. DISPUTE RESOLUTION
5.1 Mediation: Any differences or disputes arising from the interpretation of this MoU shall be settled amicably through direct consultations between the heads of both institutions.

IN WITNESS WHEREOF, the Parties hereto have signed and executed this Memorandum of Understanding on the date and year first written above.`;

export default function OutreachAutomation({ preselectedIncubatorName, refreshTrigger }) {
  const [leads, setLeads] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [incubators, setIncubators] = useState([]);
  const [externalEvents, setExternalEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  
  // Active workflow node (for flowchart animation highlight)
  // 1: Send, 2: Reply, 3: AI intent, 4: Score, 5: Calendar
  const [activeWorkflowNode, setActiveWorkflowNode] = useState(0);
  
  // Terminal logs state
  const [terminalLogs, setTerminalLogs] = useState([
    { time: new Date().toLocaleTimeString(), src: "SYSTEM", msg: "Outreach & auto-scheduling engine initialized." }
  ]);
  
  // Info detail modal
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState(null);

  // MOU Form states
  const [showMouForm, setShowMouForm] = useState(false);
  const [selectedIncId, setSelectedIncId] = useState("");
  const [partyBName, setPartyBName] = useState("");
  const [partyBEmail, setPartyBEmail] = useState("");
  const [partyBRep, setPartyBRep] = useState("");
  const [mouDate, setMouDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("3 Years");
  const [targetSectors, setTargetSectors] = useState("DeepTech, AI/ML, SaaS");
  const [incubatorRep, setIncubatorRep] = useState("Director, Nagpur Incubator Hub");
  const [signatureData, setSignatureData] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [sendingMou, setSendingMou] = useState(false);
  const [mouSendStatus, setMouSendStatus] = useState(null);

  // Incubator Search & Filter states
  const [incSearchQuery, setIncSearchQuery] = useState("");
  const [incSelectedRegion, setIncSelectedRegion] = useState("");
  const [incSelectedState, setIncSelectedState] = useState("");
  const [incSelectedCity, setIncSelectedCity] = useState("");
  const [incSelectedSector, setIncSelectedSector] = useState("");

  // Directory Lead Finder states (with 5 items per page)
  const [dirSearchQuery, setDirSearchQuery] = useState("");
  const [dirSelectedState, setDirSelectedState] = useState("");
  const [dirSelectedRegion, setDirSelectedRegion] = useState("");
  const [dirSelectedSector, setDirSelectedSector] = useState("");
  const [dirMinStars, setDirMinStars] = useState(0);
  const [dirCurrentPage, setDirCurrentPage] = useState(1);
  const [leadsCurrentPage, setLeadsCurrentPage] = useState(1);
  const [addingLeadId, setAddingLeadId] = useState(null);

  // Sync Interval state
  const [syncInterval, setSyncInterval] = useState(30);

  // OAuth states
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [oauthAuthorized, setOauthAuthorized] = useState(false);

  // Meeting scheduling states
  const [selectedLeadForMeeting, setSelectedLeadForMeeting] = useState(null);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("11:00 AM");
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);

  // Campaign leads filter states
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadSelectedStatus, setLeadSelectedStatus] = useState("");
  const [leadNotesInput, setLeadNotesInput] = useState("");

  // Unique filter lists extracted dynamically
  const regionsList = ["North", "South", "East", "West", "Central", "Northeast"];
  const statesList = Array.from(new Set(incubators.map(i => i.state).filter(Boolean))).sort();
  const citiesList = Array.from(new Set(incubators.map(i => i.city).filter(Boolean))).sort();
  
  // Parse comma-separated focus areas to build unique sector list
  const sectorsList = Array.from(new Set(
    incubators.flatMap(i => {
      if (!i.focus_areas) return [];
      if (Array.isArray(i.focus_areas)) return i.focus_areas;
      if (typeof i.focus_areas === "string") return i.focus_areas.split(",").map(s => s.trim());
      return [];
    }).filter(Boolean)
  )).sort();

  // Helper to convert confidence score (0.0 to 1.0) to star rating (1 to 5)
  const getStarsCount = (score) => {
    return Math.max(1, Math.min(5, Math.ceil((score || 1.0) * 5)));
  };

  // Filtered Incubators List
  const filteredIncubators = incubators.filter(inc => {
    if (incSearchQuery && 
        !inc.name.toLowerCase().includes(incSearchQuery.toLowerCase()) && 
        !(inc.description || "").toLowerCase().includes(incSearchQuery.toLowerCase())) {
      return false;
    }
    if (incSelectedRegion && inc.region !== incSelectedRegion) {
      return false;
    }
    if (incSelectedState && inc.state !== incSelectedState) {
      return false;
    }
    if (incSelectedCity && inc.city !== incSelectedCity) {
      return false;
    }
    if (incSelectedSector) {
      const sectors = Array.isArray(inc.focus_areas)
        ? inc.focus_areas
        : (typeof inc.focus_areas === "string" ? inc.focus_areas.split(",").map(s => s.trim()) : []);
      if (!sectors.some(s => s.toLowerCase().includes(incSelectedSector.toLowerCase()))) {
        return false;
      }
    }
    return true;
  });

  // Filtered Directory Incubators List for Campaign Lead Finder
  const filteredDirIncubators = incubators.filter(inc => {
    if (dirSearchQuery && 
        !inc.name.toLowerCase().includes(dirSearchQuery.toLowerCase()) && 
        !(inc.description || "").toLowerCase().includes(dirSearchQuery.toLowerCase())) {
      return false;
    }
    if (dirSelectedRegion && inc.region !== dirSelectedRegion) {
      return false;
    }
    if (dirSelectedState && inc.state !== dirSelectedState) {
      return false;
    }
    if (dirSelectedSector) {
      const sectors = Array.isArray(inc.focus_areas)
        ? inc.focus_areas
        : (typeof inc.focus_areas === "string" ? inc.focus_areas.split(",").map(s => s.trim()) : []);
      if (!sectors.some(s => s.toLowerCase().includes(dirSelectedSector.toLowerCase()))) {
        return false;
      }
    }
    if (dirMinStars > 0 && getStarsCount(inc.confidence_score) < dirMinStars) {
      return false;
    }
    return true;
  });

  // Pagination calculations for Directory Incubators
  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredDirIncubators.length / itemsPerPage) || 1;
  const paginatedDirIncubators = filteredDirIncubators.slice(
    (dirCurrentPage - 1) * itemsPerPage,
    dirCurrentPage * itemsPerPage
  );

  // Reset page to 1 when filters change
  useEffect(() => {
    setDirCurrentPage(1);
  }, [dirSearchQuery, dirSelectedState, dirSelectedRegion, dirSelectedSector, dirMinStars]);

  // Filter campaign leads
  const filteredLeads = leads.filter(lead => {
    if (leadSearchQuery && 
        !lead.incubator_name.toLowerCase().includes(leadSearchQuery.toLowerCase()) && 
        !lead.email.toLowerCase().includes(leadSearchQuery.toLowerCase())) {
      return false;
    }
    if (leadSelectedStatus && lead.status !== leadSelectedStatus) {
      return false;
    }
    return true;
  });

  // Reset page to 1 when filters change
  useEffect(() => {
    setLeadsCurrentPage(1);
  }, [leadSearchQuery, leadSelectedStatus]);

  // Pagination calculations for Targeted Campaigns (5 per page)
  const leadsItemsPerPage = 5;
  const totalLeadsPages = Math.ceil(filteredLeads.length / leadsItemsPerPage) || 1;
  const paginatedLeads = filteredLeads.slice(
    (leadsCurrentPage - 1) * leadsItemsPerPage,
    leadsCurrentPage * leadsItemsPerPage
  );

  // Sync details modal notes input
  useEffect(() => {
    if (selectedLeadForDetail) {
      setLeadNotesInput(selectedLeadForDetail.notes || "");
    } else {
      setLeadNotesInput("");
    }
  }, [selectedLeadForDetail]);

  // Signature drawing canvas ref
  const canvasRef = useRef(null);
  // Terminal scroll reference
  const terminalEndRef = useRef(null);

  const addLog = (src, msg) => {
    setTerminalLogs(prev => [
      ...prev,
      { time: new Date().toLocaleTimeString(), src, msg }
    ]);
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  // Fetch campaign data
  const fetchData = async () => {
    setLoading(true);
    try {
      const leadsRes = await fetch("http://127.0.0.1:8000/api/outreach/leads");
      const leadsData = await leadsRes.json();
      setLeads(leadsData);
      
      const meetingsRes = await fetch("http://127.0.0.1:8000/api/outreach/meetings");
      const meetingsData = await meetingsRes.json();
      setMeetings(meetingsData);

      const incsRes = await fetch("http://127.0.0.1:8000/api/incubators");
      const incsData = await incsRes.json();
      setIncubators(incsData);

      // Fetch external events using the Google Calendar API key
      try {
        const calendarRes = await fetch("http://127.0.0.1:8000/api/outreach/calendar-events");
        const calendarData = await calendarRes.json();
        setExternalEvents(calendarData.events || []);
      } catch (calErr) {
        console.error("Error fetching calendar events:", calErr);
      }

      // Fetch auto-scan interval config
      try {
        const configRes = await fetch("http://127.0.0.1:8000/api/outreach/config");
        const configData = await configRes.json();
        if (configData && typeof configData.sync_interval === "number") {
          setSyncInterval(configData.sync_interval);
        }
      } catch (configErr) {
        console.error("Error fetching sync config:", configErr);
      }

      // Fetch OAuth configuration & authorization status
      try {
        const oauthRes = await fetch("http://127.0.0.1:8000/api/outreach/oauth-status");
        const oauthData = await oauthRes.json();
        if (oauthData) {
          setOauthConfigured(oauthData.is_configured);
          setOauthAuthorized(oauthData.is_authorized);
        }
      } catch (oauthErr) {
        console.error("Error fetching OAuth status:", oauthErr);
      }
    } catch (e) {
      console.error(e);
      addLog("ERROR", "Failed to connect to the backend API.");
    } finally {
      setLoading(false);
    }
  };

  const handleIntervalChange = async (newVal) => {
    setSyncInterval(newVal);
    addLog("SYSTEM", `Changing auto scan interval to ${newVal === 0 ? "Disabled (Manual Check Only)" : `${newVal} seconds`}...`);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_interval: newVal })
      });
      if (res.ok) {
        addLog("SYSTEM", `Auto scan interval successfully updated to ${newVal === 0 ? "Disabled" : `${newVal} seconds`}.`);
      } else {
        addLog("ERROR", "Failed to persist scan interval setting on backend.");
      }
    } catch (err) {
      addLog("ERROR", "Failed to connect to backend configuration API.");
    }
  };

  const handleAddLead = async (inc) => {
    setAddingLeadId(inc.id);
    const leadEmail = inc.email || `contact@${inc.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.org`;
    addLog("OUTREACH", `Adding ${inc.name} (${leadEmail}) to outreach campaign...`);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/add-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incubator_id: inc.id,
          incubator_name: inc.name,
          email: leadEmail
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        if (data.status === "exists") {
          addLog("SYSTEM", `${inc.name} is already a lead in this campaign.`);
          toast.warning(`${inc.name} is already a lead in this campaign.`);
        } else {
          addLog("OUTREACH", `Successfully added ${inc.name} to campaigns as Draft.`);
          await fetchData();
        }
      } else {
        addLog("ERROR", `Failed to add lead: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      addLog("ERROR", "Connection to backend add-lead API failed.");
    } finally {
      setAddingLeadId(null);
    }
  };

  const handleAuthorizeCalendar = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/authorize");
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.open(data.authorization_url, "_blank");
      } else {
        toast.error(data.detail || "Failed to generate authorization URL.");
      }
    } catch (err) {
      toast.error("Failed to connect to backend authorization service.");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle refresh trigger from global app refresh button (triggers check replies)
  useEffect(() => {
    if (refreshTrigger > 0) {
      handleCheckReplies();
    }
  }, [refreshTrigger]);

  // Frontend silent polling based on syncInterval setting
  useEffect(() => {
    if (syncInterval > 0) {
      const intervalId = setInterval(async () => {
        try {
          const leadsRes = await fetch("http://127.0.0.1:8000/api/outreach/leads");
          if (leadsRes.ok) {
            const leadsData = await leadsRes.json();
            setLeads(leadsData);
          }
          const meetingsRes = await fetch("http://127.0.0.1:8000/api/outreach/meetings");
          if (meetingsRes.ok) {
            const meetingsData = await meetingsRes.json();
            setMeetings(meetingsData);
          }
        } catch (e) {
          console.error("Silent polling sync failed", e);
        }
      }, syncInterval * 1000);
      return () => clearInterval(intervalId);
    }
  }, [syncInterval]);

  // Preselect incubator if routed from Finder
  useEffect(() => {
    if (incubators.length > 0 && preselectedIncubatorName) {
      const matched = incubators.find(inc => 
        inc.name.toLowerCase().includes(preselectedIncubatorName.toLowerCase())
      );
      if (matched) {
        setSelectedIncId(matched.id);
        setShowMouForm(true);
        addLog("SYSTEM", `Preselected incubator from directory: ${matched.name}`);
      }
    }
  }, [incubators, preselectedIncubatorName]);

  // Set representative when incubator selection changes
  useEffect(() => {
    if (selectedIncId && incubators.length > 0) {
      const inc = incubators.find(i => i.id === selectedIncId);
      if (inc) {
        setIncubatorRep(inc.founder_or_head || "Director");
      }
    }
  }, [selectedIncId, incubators]);

  const handleReset = async () => {
    setResetting(true);
    setActiveWorkflowNode(0);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/reset", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog("SYSTEM", "Campaign simulation data successfully reset.");
        await fetchData();
      } else {
        addLog("ERROR", `Reset failed: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      addLog("ERROR", "Failed to connect to backend reset route.");
    } finally {
      setResetting(false);
    }
  };

  const handleUpdateMeetingStatus = async (meetingId, newStatus) => {
    addLog("CALENDAR", `Updating meeting status to '${newStatus}' for meeting ID: ${meetingId}...`);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/meetings/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_id: meetingId, status: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        addLog("CALENDAR", `Meeting status successfully updated to '${newStatus}'!`);
        await fetchData();
      } else {
        addLog("ERROR", `Failed to update meeting status: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      addLog("ERROR", "Failed to connect to backend meetings status API.");
    }
  };

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    addLog("SYSTEM", `Updating campaign lead status to '${newStatus}'...`);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/leads/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, status: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        addLog("SYSTEM", `Campaign lead status updated to '${newStatus}'.`);
        await fetchData();
        if (selectedLeadForDetail && selectedLeadForDetail.id === leadId) {
          setSelectedLeadForDetail(prev => ({ ...prev, status: newStatus }));
        }
      } else {
        addLog("ERROR", `Failed to update status: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      addLog("ERROR", "Failed to connect to backend update-status API.");
    }
  };

  const handleUpdateLeadNotes = async (leadId, notesText) => {
    addLog("SYSTEM", `Saving CRM notes for campaign lead...`);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/leads/update-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, notes: notesText })
      });
      const data = await res.json();
      if (res.ok) {
        addLog("SYSTEM", `CRM notes saved successfully.`);
        await fetchData();
        if (selectedLeadForDetail && selectedLeadForDetail.id === leadId) {
          setSelectedLeadForDetail(prev => ({ ...prev, notes: notesText }));
        }
        toast.success("Notes saved successfully!");
      } else {
        addLog("ERROR", `Failed to save notes: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      addLog("ERROR", "Failed to connect to backend update-notes API.");
    }
  };

  const handleExportLeadsToCsv = () => {
    addLog("SYSTEM", "Compiling campaign leads dataset to CSV...");
    if (leads.length === 0) {
      toast.warning("No leads available to export.");
      return;
    }
    
    const headers = ["ID", "Incubator ID", "Incubator Name", "Email", "Status", "Sent At", "Lead Score", "Intent", "Meeting Link", "Meeting Scheduled At", "Notes"];
    const csvRows = [headers.join(",")];
    
    leads.forEach(lead => {
      const values = [
        lead.id,
        lead.incubator_id || "",
        `"${(lead.incubator_name || "").replace(/"/g, '""')}"`,
        lead.email || "",
        lead.status || "",
        lead.sent_at || "",
        lead.lead_score || 0,
        lead.intent_classification || "N/A",
        lead.meeting_link || "",
        lead.meeting_scheduled_at || "",
        `"${(lead.notes || "").replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(","));
    });
    
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `outreach_campaign_leads_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog("SYSTEM", "Campaign CSV export downloaded successfully.");
  };

  const handleScheduleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeadForMeeting) return;
    
    setSchedulingMeeting(true);
    addLog("CALENDAR", `Requesting Google Calendar Meet scheduling for ${selectedLeadForMeeting.incubator_name} on ${meetingDate} at ${meetingTime}...`);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/schedule-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLeadForMeeting.id,
          date: meetingDate,
          time: meetingTime
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        addLog("CALENDAR", `Meeting successfully scheduled! Meet Link: ${data.meeting_link}`);
        toast.success(`Meeting successfully scheduled! Email invite sent to ${selectedLeadForMeeting.email}.`);
        setSelectedLeadForMeeting(null);
        await fetchData();
      } else {
        addLog("ERROR", `Failed to schedule meeting: ${data.detail || "Server error"}`);
        toast.error(`Error: ${data.detail || "Failed to schedule meeting"}`);
      }
    } catch (err) {
      addLog("ERROR", "Failed to connect to backend schedule-meeting API.");
      toast.error("Failed to connect to backend schedule-meeting API.");
    } finally {
      setSchedulingMeeting(false);
    }
  };

  const handleSendEmail = async (leadId, leadName, leadEmail) => {
    addLog("OUTREACH", `Triggering outreach partnership invitation email to ${leadName} (${leadEmail})...`);
    setActiveWorkflowNode(1);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId })
      });
      const data = await res.json();
      
      if (res.ok) {
        addLog("OUTREACH", `Outreach successfully dispatched. Status: SENT.`);
        await fetchData();
        setTimeout(() => setActiveWorkflowNode(0), 1000);
      } else {
        addLog("ERROR", `Failed to send outreach: ${data.detail || "Server error"}`);
        setActiveWorkflowNode(0);
      }
    } catch (err) {
      addLog("ERROR", "Connection to backend campaign API failed.");
      setActiveWorkflowNode(0);
    }
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    addLog("SYSTEM", "Connecting to IMAP inbox to scan for unread responses...");
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/outreach/check-replies", { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        const newReplies = data.new_replies || [];
        if (newReplies.length > 0) {
          addLog("SYSTEM", `IMAP Scan complete. Processed ${newReplies.length} new reply/replies.`);
          newReplies.forEach(reply => {
            addLog("INBOX", `Reply matched from ${reply.incubator_name} (${reply.email}): "${reply.reply_text.substring(0, 60)}..."`);
            addLog("AI_ENGINE", `Gemini Classification: Intent=${reply.intent.toUpperCase()}, Interest Score=${reply.score}/100`);
            if (reply.status === "Meeting Scheduled") {
              addLog("CALENDAR", `Score > 80. Google Calendar Meeting synchronized with Google Meet link.`);
            } else {
              addLog("SYSTEM", `Score (${reply.score}) below threshold. Reply recorded.`);
            }
          });
        } else {
          addLog("SYSTEM", "IMAP Scan complete. No new unread replies from campaign leads detected.");
        }
        await fetchData();
      } else {
        addLog("ERROR", `Scan failed: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      addLog("ERROR", "IMAP mailbox retrieval connection error.");
    } finally {
      setCheckingReplies(false);
    }
  };

  // Signature drawing handlers
  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e3a8a";
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const adoptSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check if canvas is empty
    const context = canvas.getContext("2d");
    const buffer = new Uint32Array(
      context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    const isEmpty = !buffer.some(color => color !== 0);
    
    if (isEmpty) {
      toast.warning("Please draw your signature first.");
      return;
    }
    
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureData(dataUrl);
    addLog("SYSTEM", "Digital signature adopted successfully.");
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.warning("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.min(hRatio, vRatio, 1);
        
        const centerShift_x = (canvas.width - img.width * ratio) / 2;
        const centerShift_y = (canvas.height - img.height * ratio) / 2;
        
        ctx.drawImage(
          img,
          0, 0, img.width, img.height,
          centerShift_x, centerShift_y, img.width * ratio, img.height * ratio
        );
        
        const dataUrl = canvas.toDataURL("image/png");
        setSignatureData(dataUrl);
        addLog("SYSTEM", "Uploaded signature image adopted.");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSendMou = async (e) => {
    e.preventDefault();
    if (!selectedIncId) {
      toast.warning("Please select First Party Incubator.");
      return;
    }
    if (!signatureData) {
      toast.warning("Please draw or upload and adopt your digital signature first.");
      return;
    }

    const selectedInc = incubators.find(i => i.id === selectedIncId);
    const incName = selectedInc ? selectedInc.name : "";
    const incCity = selectedInc ? selectedInc.city : "";
    const incState = selectedInc ? selectedInc.state : "";
    const incEmail = selectedInc ? selectedInc.email : "contact@incubator.org";

    setSendingMou(true);
    setMouSendStatus(null);
    addLog("OUTREACH", `Transmitting executed Academic Collaboration MOU agreement to ${partyBName} (${partyBEmail})...`);

    try {
      const templateData = {
        date: mouDate,
        incubatorName: incName,
        incubatorCity: incCity,
        incubatorState: incState,
        incubatorRep,
        partyBName,
        partyBEmail,
        partyBRep,
        duration,
        targetSectors
      };

      const res = await fetch("http://127.0.0.1:8000/api/mou/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incubator_name: incName,
          incubator_email: incEmail,
          party_b_name: partyBName,
          party_b_email: partyBEmail,
          mou_title: "MEMORANDUM OF UNDERSTANDING FOR STRATEGIC COOPERATION AND ACADEMIC COLLABORATION",
          mou_text: getAcademicMouText(templateData),
          signature_data: signatureData,
          recipient_email: partyBEmail
        })
      });

      const data = await res.json();
      if (res.ok) {
        addLog("OUTREACH", `MOU agreement dispatched successfully to ${partyBEmail}. (Registered as active Sent campaign lead).`);
        setMouSendStatus({ type: "success", message: `Academic Collaboration MOU successfully sent to ${partyBEmail}!` });
        
        // Reset states
        setTimeout(() => {
          setShowMouForm(false);
          setPartyBName("");
          setPartyBEmail("");
          setPartyBRep("");
          setSignatureData(null);
          setMouSendStatus(null);
        }, 3000);

        await fetchData();
      } else {
        setMouSendStatus({ type: "error", message: data.detail || "Failed to send agreement." });
        addLog("ERROR", `Failed to dispatch MOU: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      console.error(err);
      setMouSendStatus({ type: "error", message: "Network connection error." });
      addLog("ERROR", "SMTP transmission connection failed.");
    } finally {
      setSendingMou(false);
    }
  };

  // Metrics
  const totalSent = leads.filter(l => l.status !== "Draft").length;
  const totalReplies = leads.filter(l => ["Replied", "Meeting Scheduled", "Not Interested"].includes(l.status)).length;
  const totalMeetings = meetings.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Campaign Controls Card */}
      <div className="glass-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>
              ⚡ Email Outreach Campaign Management
            </h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Coordinate email outreach invites, check live inbox replies, and monitor automated follow-up calendar schedules.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginRight: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: "#000000", whiteSpace: "nowrap", fontWeight: "600" }}>Auto Scan:</span>
              <select 
                className="form-input" 
                style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", width: "130px", height: "32px", color: "black", background: "#f8fafc", border: "1px solid var(--border-color)", borderRadius: "4px", margin: 0 }}
                value={syncInterval}
                onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
              >
                <option value={30}>Every 30 sec</option>
                <option value={60}>Every 1 min</option>
                <option value={300}>Every 5 min</option>
                <option value={600}>Every 10 min</option>
                <option value={0}>Disabled (Manual)</option>
              </select>
            </div>

            {oauthAuthorized ? (
              <div 
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "0.35rem", 
                  padding: "0.4rem 0.75rem", 
                  fontSize: "0.8rem", 
                  height: "32px", 
                  background: "#d4edda", 
                  border: "1px solid #c3e6cb", 
                  borderRadius: "4px", 
                  color: "#000000", 
                  fontWeight: "600" 
                }}
              >
                <CheckCircle size={14} style={{ color: "#155724" }} />
                <span>✓ Google Calendar Active</span>
              </div>
            ) : oauthConfigured ? (
              <button 
                className="btn"
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "0.35rem", 
                  padding: "0.4rem 0.75rem", 
                  fontSize: "0.8rem", 
                  height: "32px", 
                  background: "#fff3cd", 
                  border: "1px solid #ffeeba", 
                  color: "#000000", 
                  fontWeight: "600", 
                  cursor: "pointer", 
                  borderRadius: "4px" 
                }}
                onClick={handleAuthorizeCalendar}
              >
                <Calendar size={14} style={{ color: "#856404" }} />
                <span>Authorize Google Calendar</span>
              </button>
            ) : (
              <div 
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "0.35rem", 
                  padding: "0.4rem 0.75rem", 
                  fontSize: "0.8rem", 
                  height: "32px", 
                  background: "#f8d7da", 
                  border: "1px solid #f5c6cb", 
                  borderRadius: "4px", 
                  color: "#000000", 
                  fontWeight: "600" 
                }}
                title="Populate GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env"
              >
                <AlertCircle size={14} style={{ color: "#721c24" }} />
                <span>Google OAuth Not Configured (.env)</span>
              </div>
            )}

            <button 
              className="btn btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.75rem", fontSize: "0.8rem", height: "32px" }}
              onClick={handleCheckReplies}
              disabled={checkingReplies}
            >
              <RefreshCcw size={14} className={checkingReplies ? "spin" : ""} />
              <span>{checkingReplies ? "Scanning Inbox..." : "Check Live Replies"}</span>
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.75rem", fontSize: "0.8rem", height: "32px" }}
              onClick={handleReset}
              disabled={resetting}
            >
              <RefreshCcw size={14} className={resetting ? "spin" : ""} />
              <span>Reset Campaigns</span>
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ 
                display: "inline-flex", 
                alignItems: "center", 
                gap: "0.35rem", 
                padding: "0.4rem 0.75rem", 
                fontSize: "0.8rem", 
                height: "32px",
                background: "rgba(139, 92, 246, 0.1)",
                color: "var(--accent-purple)",
                border: "1px solid rgba(139, 92, 246, 0.2)"
              }}
              onClick={handleExportLeadsToCsv}
            >
              <Download size={14} />
              <span>Export Leads (CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* integrated collapsible Academic Collab MOU Generator */}
      <div className="glass-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              ✍ Draft & Execute Academic Collaboration MOU
            </h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Select an incubator, fill in partner academic institution details, digitally sign, and send the official MOU via email.
            </p>
          </div>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowMouForm(!showMouForm)}
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", minWidth: "120px" }}
          >
            {showMouForm ? "Hide Form" : "Open MoU Draft"}
          </button>
        </div>

        {showMouForm && (
          <form onSubmit={handleSendMou} className="animate-in" style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
            
            {/* Search & Select First Party Panel */}
            <div className="form-group" style={{ background: "rgba(255, 255, 255, 0.02)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)", marginBottom: "1.5rem" }}>
              <label style={{ fontWeight: "700", marginBottom: "0.75rem", display: "block", color: "#000000" }}>
                🔍 Search & Select First Party (Incubator)
              </label>
              
              {/* Filter Inputs Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search by name, source..." 
                  value={incSearchQuery}
                  onChange={(e) => setIncSearchQuery(e.target.value)}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
                />
                <select 
                  className="form-input" 
                  value={incSelectedRegion} 
                  onChange={(e) => { setIncSelectedRegion(e.target.value); setIncSelectedState(""); setIncSelectedCity(""); }}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
                >
                  <option value="">All Regions</option>
                  {regionsList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select 
                  className="form-input" 
                  value={incSelectedState} 
                  onChange={(e) => setIncSelectedState(e.target.value)}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
                >
                  <option value="">All States</option>
                  {statesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select 
                  className="form-input" 
                  value={incSelectedCity} 
                  onChange={(e) => setIncSelectedCity(e.target.value)}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
                >
                  <option value="">All Cities</option>
                  {citiesList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  className="form-input" 
                  value={incSelectedSector} 
                  onChange={(e) => setIncSelectedSector(e.target.value)}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
                >
                  <option value="">All Sectors</option>
                  {sectorsList.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </div>

              {/* Selection Dropdown */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <select 
                  className="form-input"
                  value={selectedIncId}
                  onChange={(e) => setSelectedIncId(e.target.value)}
                  required
                  style={{ flex: 1, color: "black", background: "#f8fafc" }}
                >
                  <option value="">-- Select matching incubator ({filteredIncubators.length} found) --</option>
                  {filteredIncubators.map(inc => (
                    <option key={inc.id} value={inc.id}>{inc.name} ({inc.city ? `${inc.city}, ` : ""}{inc.state})</option>
                  ))}
                </select>
                {(incSearchQuery || incSelectedRegion || incSelectedState || incSelectedCity || incSelectedSector) && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                    onClick={() => {
                      setIncSearchQuery("");
                      setIncSelectedRegion("");
                      setIncSelectedState("");
                      setIncSelectedCity("");
                      setIncSelectedSector("");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div className="form-group">
                <label>First Party Representative Signature Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={incubatorRep}
                  onChange={(e) => setIncubatorRep(e.target.value)}
                  placeholder="e.g. Director / Head of Incubation"
                  required
                />
              </div>
              <div className="form-group">
                <label>Second Party (Partner Academic/Research Institution Name)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={partyBName} 
                  onChange={(e) => setPartyBName(e.target.value)}
                  placeholder="e.g. Nagpur Science Research Institute"
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div className="form-group">
                <label>Second Party Representative Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={partyBRep} 
                  onChange={(e) => setPartyBRep(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  required
                />
              </div>
              <div className="form-group">
                <label>Second Party Contact Email (Receives MOU)</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={partyBEmail} 
                  onChange={(e) => setPartyBEmail(e.target.value)}
                  placeholder="e.g. kadurugved0@gmail.com"
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div className="form-group">
                <label>MoU Execution Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={mouDate}
                  onChange={(e) => setMouDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>MoU Valid Duration</label>
                <select 
                  className="form-input" 
                  value={duration} 
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="1 Year">1 Year</option>
                  <option value="2 Years">2 Years</option>
                  <option value="3 Years">3 Years</option>
                  <option value="5 Years">5 Years</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label>Collaboration Sectors / Focus Areas</label>
              <input 
                type="text" 
                className="form-input" 
                value={targetSectors}
                onChange={(e) => setTargetSectors(e.target.value)}
                placeholder="e.g. Biotechnology, Nanotechnology, AI Research"
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label>Draw Digital Signature (First Party Signature)</label>
              <div className="sig-pad-container">
                <div className="sig-pad-header">
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Draw signature inside the box below</span>
                  {signatureData && <span style={{ fontSize: "0.75rem", color: "var(--accent-green)", fontWeight: 700 }}>✓ Signature Adopted</span>}
                </div>
                <canvas 
                  ref={canvasRef}
                  className="sig-canvas"
                  width={450}
                  height={150}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{ background: "#f8fafc", border: "1px solid var(--border-color)", borderRadius: "6px", width: "100%", height: "150px" }}
                />
                <div className="sig-pad-footer" style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }} onClick={clearSignature}>
                    <Trash2 size={12} /> Clear
                  </button>
                  <label className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.25rem", margin: 0 }}>
                    <Upload size={12} /> Upload Image
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: "none" }} 
                      onChange={handleSignatureUpload} 
                    />
                  </label>
                  <button type="button" className="btn btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", marginLeft: "auto" }} onClick={adoptSignature}>
                    Adopt Signature
                  </button>
                </div>
              </div>
            </div>

            {mouSendStatus && (
              <div className={`alert ${mouSendStatus.type === "success" ? "alert-success" : "alert-error"}`} style={{ 
                padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", 
                background: mouSendStatus.type === "success" ? "rgba(16,185,129,0.12)" : "rgba(220,38,38,0.12)",
                color: mouSendStatus.type === "success" ? "var(--accent-green)" : "var(--accent-red)",
                border: `1px solid ${mouSendStatus.type === "success" ? "rgba(16,185,129,0.2)" : "rgba(220,38,38,0.2)"}`
              }}>
                {mouSendStatus.message}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }} 
              disabled={sendingMou}
            >
              {sendingMou ? "Transmitting executed agreement..." : "Adopt Signature & Transmit MOU via SMTP"}
            </button>
          </form>
        )}
      </div>

      {/* Directory Lead Finder Card */}
      <div className="glass-card" style={{ padding: "1.5rem" }}>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          🏫 Discover & Add Campaign Leads from Directory
        </h3>
        <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.8rem", color: "var(--text-dim)" }}>
          Search through all academic, government, and private incubators. Filter by confidence score rating stars and add them to your targeted campaigns list.
        </p>

        {/* Filters Panel */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "1rem", background: "rgba(255, 255, 255, 0.01)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
          <input 
            type="text"
            className="form-input"
            placeholder="Search by name, description..."
            value={dirSearchQuery}
            onChange={(e) => setDirSearchQuery(e.target.value)}
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
          />
          <select 
            className="form-input"
            value={dirSelectedRegion}
            onChange={(e) => setDirSelectedRegion(e.target.value)}
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
          >
            <option value="">All Regions</option>
            {regionsList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select 
            className="form-input"
            value={dirSelectedState}
            onChange={(e) => setDirSelectedState(e.target.value)}
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
          >
            <option value="">All States</option>
            {statesList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select 
            className="form-input"
            value={dirSelectedSector}
            onChange={(e) => setDirSelectedSector(e.target.value)}
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
          >
            <option value="">All Sectors</option>
            {sectorsList.map(sec => <option key={sec} value={sec}>{sec}</option>)}
          </select>
          <select 
            className="form-input"
            value={dirMinStars}
            onChange={(e) => setDirMinStars(parseInt(e.target.value))}
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc" }}
          >
            <option value={0}>Any Star Rating</option>
            <option value={5}>⭐⭐⭐⭐⭐ (5 Stars)</option>
            <option value={4}>⭐⭐⭐⭐ & above (4+ Stars)</option>
            <option value={3}>⭐⭐⭐ & above (3+ Stars)</option>
            <option value={2}>⭐⭐ & above (2+ Stars)</option>
            <option value={1}>⭐ & above (1+ Star)</option>
          </select>
        </div>

        {/* Table List of Incubators (5 per page) */}
        {paginatedDirIncubators.length === 0 ? (
          <div style={{ padding: "1.5rem 1rem", textAlign: "center", border: "1px dashed var(--border-color)", borderRadius: "6px", color: "var(--text-dim)", fontSize: "0.85rem" }}>
            No matching incubators found. Try adjusting your search query or filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left", marginBottom: "1rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                  <th style={{ padding: "0.5rem", color: "var(--text-dim)" }}>Incubator</th>
                  <th style={{ padding: "0.5rem", color: "var(--text-dim)" }}>Region & State</th>
                  <th style={{ padding: "0.5rem", color: "var(--text-dim)", textAlign: "center" }}>Confidence Star</th>
                  <th style={{ padding: "0.5rem", color: "var(--text-dim)", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDirIncubators.map(inc => {
                  const isAlreadyLead = leads.some(lead => lead.incubator_id === inc.id);
                  return (
                    <tr key={inc.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", verticalAlign: "middle" }}>
                      <td style={{ padding: "0.6rem 0.5rem" }}>
                        <div style={{ fontWeight: "600", color: "#000000" }}>{inc.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px" }}>
                          {inc.description || "No description provided."}
                        </div>
                      </td>
                      <td style={{ padding: "0.6rem 0.5rem" }}>
                        <div style={{ fontWeight: "500", color: "#000000" }}>{inc.region || "Unknown"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#000000" }}>{inc.city ? `${inc.city}, ` : ""}{inc.state}</div>
                      </td>
                      <td style={{ padding: "0.6rem 0.5rem", textAlign: "center", fontSize: "0.85rem" }}>
                        <span title={`Confidence score: ${(inc.confidence_score || 1.0).toFixed(2)}`}>
                          {"⭐".repeat(getStarsCount(inc.confidence_score))}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>
                        {isAlreadyLead ? (
                          <span style={{ fontSize: "0.75rem", color: "var(--accent-green)", fontWeight: "600", paddingRight: "0.5rem" }}>
                            ✓ In Campaigns
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                            onClick={() => handleAddLead(inc)}
                            disabled={addingLeadId === inc.id}
                          >
                            {addingLeadId === inc.id ? "Adding..." : "Add to Campaign"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                Showing page <strong style={{ color: "black" }}>{dirCurrentPage}</strong> of <strong style={{ color: "black" }}>{totalPages}</strong> ({filteredDirIncubators.length} total incubators matched)
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => setDirCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={dirCurrentPage === 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => setDirCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={dirCurrentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Campaign Leads</span>
            <span className="metric-icon"><Mail size={18} /></span>
          </div>
          <div className="metric-value" style={{ color: "#000000" }}>{leads.length}</div>
          <div className="metric-footer">Total targeted outreach partners</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Outreach Dispatched</span>
            <span className="metric-icon"><Send size={18} style={{ color: "var(--secondary)" }} /></span>
          </div>
          <div className="metric-value" style={{ color: "#000000" }}>{totalSent}</div>
          <div className="metric-footer">Outreach invitations sent</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Replies Scanned</span>
            <span className="metric-icon"><MessageSquare size={18} style={{ color: "var(--primary)" }} /></span>
          </div>
          <div className="metric-value" style={{ color: "#000000" }}>{totalReplies}</div>
          <div className="metric-footer">Inbox responses classified</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-title">Auto-Scheduled</span>
            <span className="metric-icon"><Calendar size={18} style={{ color: "var(--accent-green)" }} /></span>
          </div>
          <div className="metric-value" style={{ color: "#000000" }}>{totalMeetings}</div>
          <div className="metric-footer">Meetings synced to Calendar</div>
        </div>
      </div>

      {/* Main Grid: Leads List & Console Logs */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: "1.5rem" }}>
        
        {/* Leads Management Panel */}
        <div className="glass-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>📋 Targeted Outreach Campaigns</h3>
          
          {/* Campaign Search & Filter Controls */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
            <input 
              type="text"
              className="form-input"
              placeholder="Search leads by name/email..."
              value={leadSearchQuery}
              onChange={(e) => setLeadSearchQuery(e.target.value)}
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc", flex: 1, minWidth: "150px" }}
            />
            <select 
              className="form-input"
              value={leadSelectedStatus}
              onChange={(e) => setLeadSelectedStatus(e.target.value)}
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", color: "black", background: "#f8fafc", width: "160px" }}
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Replied">Replied</option>
              <option value="Meeting Scheduled">Meeting Scheduled</option>
              <option value="Not Interested">Not Interested</option>
            </select>
          </div>

          {loading ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>Loading outreach campaigns...</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                    <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-dim)" }}>Incubator</th>
                    <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-dim)" }}>Status</th>
                    <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-dim)", textAlign: "center" }}>Lead Score</th>
                    <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-dim)", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", verticalAlign: "middle" }}>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <div style={{ fontWeight: "600", color: "#000000" }}>{lead.incubator_name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#000000" }}>{lead.email}</div>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <select
                          value={lead.status}
                          onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                          style={{ 
                            fontSize: "0.72rem", 
                            padding: "2px 6px", 
                            borderRadius: "4px",
                            fontWeight: "700",
                            border: "1px solid rgba(0,0,0,0.05)",
                            cursor: "pointer",
                            outline: "none",
                            background: 
                              lead.status === "Meeting Scheduled" ? "#d1fae5" : 
                              lead.status === "Replied" ? "#ede9fe" :            
                              lead.status === "Sent" ? "#ecfeff" :               
                              lead.status === "Not Interested" ? "#fee2e2" :     
                              "#f3f4f6",                                         
                            color: 
                              lead.status === "Meeting Scheduled" ? "#065f46" :
                              lead.status === "Replied" ? "#5b21b6" :
                              lead.status === "Sent" ? "#155e75" :
                              lead.status === "Not Interested" ? "#991b1b" :
                              "#374151"
                          }}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Sent">Sent</option>
                          <option value="Replied">Replied</option>
                          <option value="Meeting Scheduled">Meeting Scheduled</option>
                          <option value="Not Interested">Not Interested</option>
                        </select>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                        {lead.status === "Draft" || lead.status === "Sent" ? (
                          <span style={{ color: "#000000" }}>-</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}>
                            <span style={{ 
                              fontWeight: "700", 
                              color: "#000000"
                            }}>
                              {lead.lead_score}
                            </span>
                            <div style={{ width: "60px", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ 
                                height: "100%", 
                                width: `${lead.lead_score}%`,
                                background: lead.lead_score >= 80 ? "var(--accent-green)" : lead.lead_score >= 50 ? "var(--accent-amber)" : "var(--accent-red)"
                              }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                        {lead.status === "Draft" && (
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                            onClick={() => handleSendEmail(lead.id, lead.incubator_name, lead.email)}
                          >
                            <Send size={12} />
                            <span>Send Invite</span>
                          </button>
                        )}
                        {lead.status === "Replied" && (
                          <button 
                            className="btn btn-primary" 
                            style={{ 
                              padding: "0.3rem 0.6rem", 
                              fontSize: "0.75rem", 
                              marginRight: "0.35rem",
                              background: "#e2f0d9",
                              border: "1px solid #385723",
                              color: "#000000",
                              fontWeight: "600"
                            }}
                            onClick={() => {
                              setSelectedLeadForMeeting(lead);
                              const twoDaysOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                              setMeetingDate(twoDaysOut);
                              setMeetingTime("11:00 AM");
                            }}
                          >
                            Schedule Meet
                          </button>
                        )}
                        {["Sent", "Replied", "Meeting Scheduled", "Not Interested"].includes(lead.status) && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                            onClick={() => setSelectedLeadForDetail(lead)}
                          >
                            View Details
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Leads Pagination Controls */}
              {filteredLeads.length > leadsItemsPerPage && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem", marginTop: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    Showing page <strong style={{ color: "black" }}>{leadsCurrentPage}</strong> of <strong style={{ color: "black" }}>{totalLeadsPages}</strong> ({filteredLeads.length} total campaigns)
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => setLeadsCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={leadsCurrentPage === 1}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => setLeadsCurrentPage(prev => Math.min(totalLeadsPages, prev + 1))}
                      disabled={leadsCurrentPage === totalLeadsPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Terminal & Calendar Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Console Log Terminal */}
          <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", height: "300px", background: "#0b0f19", border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.5rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondary)", display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: "700" }}>
                <span className="dot spin" style={{ width: "8px", height: "8px", background: "var(--secondary)", borderRadius: "50%", display: "inline-block" }} />
                <span>Campaign Console Log</span>
              </h4>
              <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "monospace" }}>STDOUT_LIVE</span>
            </div>
            
            <div style={{ 
              flex: 1, 
              overflowY: "auto", 
              fontFamily: "monospace", 
              fontSize: "0.75rem", 
              color: "#38bdf8", 
              lineHeight: "1.4",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              paddingRight: "0.5rem"
            }}>
              {terminalLogs.map((log, idx) => (
                <div key={idx} style={{ display: "flex", gap: "0.5rem" }}>
                  <span style={{ color: "var(--text-dim)", flexShrink: 0 }}>[{log.time}]</span>
                  <span style={{ 
                    color: 
                      log.src === "SYSTEM" ? "var(--accent-amber)" : 
                      log.src === "OUTREACH" ? "var(--secondary)" :
                      log.src === "AI_ENGINE" ? "#ec4899" :
                      log.src === "CALENDAR" ? "var(--accent-green)" :
                      "var(--accent-red)",
                    fontWeight: "600",
                    flexShrink: 0
                  }}>
                    {log.src}:
                  </span>
                  <span style={{ color: "#f8fafc", wordBreak: "break-all" }}>{log.msg}</span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Calendar Sync panel */}
          <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              📅 Calendar Meeting Sync
            </h4>
            
            {meetings.length === 0 ? (
              <div style={{ 
                padding: "2rem 1rem", 
                textAlign: "center", 
                border: "1px dashed var(--border-color)", 
                borderRadius: "6px",
                color: "var(--text-dim)",
                fontSize: "0.8rem"
              }}>
                <Clock size={20} style={{ margin: "0 auto 0.5rem auto", opacity: 0.5 }} />
                <span>No automated meetings scheduled yet. Trigger outreach and reply checking to sync.</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "250px", overflowY: "auto" }}>
                {meetings.map((meeting) => (
                  <div 
                    key={meeting.id} 
                    style={{ 
                      padding: "0.75rem", 
                      background: 
                        meeting.status === "Completed" ? "rgba(71, 85, 105, 0.05)" : 
                        meeting.status === "Cancelled" ? "rgba(220, 38, 38, 0.05)" : 
                        meeting.status === "Confirmed" ? "rgba(16, 185, 129, 0.08)" : 
                        "rgba(16, 185, 129, 0.04)",
                      border: 
                        meeting.status === "Completed" ? "1px solid rgba(71, 85, 105, 0.2)" :
                        meeting.status === "Cancelled" ? "1px solid rgba(220, 38, 38, 0.2)" :
                        meeting.status === "Confirmed" ? "1px solid rgba(16, 185, 129, 0.3)" :
                        "1px solid rgba(16, 185, 129, 0.15)",
                      borderRadius: "6px" 
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#000000" }}>{meeting.title}</div>
                    <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "#000000", marginTop: "0.25rem" }}>
                      <span>📅 {meeting.date}</span>
                      <span>⏰ {meeting.time}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "0.5rem" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--accent-green)", fontWeight: "600" }}>✓ Google Meet Generated</span>
                        <span style={{ 
                          fontSize: "0.7rem", 
                          fontWeight: "700",
                          color: 
                            meeting.status === "Confirmed" ? "var(--accent-green)" : 
                            meeting.status === "Completed" ? "var(--primary)" :
                            meeting.status === "Cancelled" ? "var(--accent-red)" :
                            "#e28743"
                        }}>
                          Status: {meeting.status || "Scheduled"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                        {(meeting.status === "Scheduled" || !meeting.status) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateMeetingStatus(meeting.id, "Confirmed")}
                              style={{
                                fontSize: "0.7rem",
                                color: "white",
                                background: "var(--primary)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: "600"
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateMeetingStatus(meeting.id, "Cancelled")}
                              style={{
                                fontSize: "0.7rem",
                                color: "white",
                                background: "var(--accent-red)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: "600"
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {meeting.status === "Confirmed" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateMeetingStatus(meeting.id, "Completed")}
                              style={{
                                fontSize: "0.7rem",
                                color: "white",
                                background: "var(--accent-green)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: "600"
                              }}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateMeetingStatus(meeting.id, "Cancelled")}
                              style={{
                                fontSize: "0.7rem",
                                color: "white",
                                background: "var(--accent-red)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: "600"
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <a 
                          href={meeting.meeting_link || "https://meet.google.com"} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ 
                            fontSize: "0.7rem", 
                            color: "white", 
                            background: "var(--accent-green)", 
                            padding: "2px 6px", 
                            borderRadius: "4px", 
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem"
                          }}
                        >
                          <span>Join</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Google Calendar Public Events Section */}
            {externalEvents.length > 0 && (
              <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--primary)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span>🏛 Academic & Public Holidays</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "150px", overflowY: "auto" }}>
                  {externalEvents.map((evt, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", background: "#f8fafc", padding: "5px 8px", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                      <span style={{ color: "#000000", fontWeight: "600", marginRight: "0.5rem" }}>{evt.summary}</span>
                      <span style={{ color: "#000000", flexShrink: 0 }}>{evt.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* View Result / Detail Drawer Modal */}
      {selectedLeadForDetail && (
        <div className="drawer-backdrop" style={{ zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSelectedLeadForDetail(null)}>
          <div className="glass-card" style={{ width: "90%", maxWidth: "550px", padding: "1.5rem", background: "#ffffff", border: "1px solid var(--border-color)", zIndex: 10001 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.15rem", color: "var(--primary)", fontWeight: "800" }}>
              📊 AI Outreach Result Analysis
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: "0.8rem", color: "#000000" }}>Incubator Name</strong>
                  <div style={{ fontWeight: "700", color: "#000000" }}>{selectedLeadForDetail.incubator_name}</div>
                  <div style={{ fontSize: "0.85rem", color: "#000000" }}>{selectedLeadForDetail.email}</div>
                </div>
                <div>
                  <strong style={{ fontSize: "0.8rem", color: "#000000" }}>Campaign Status</strong>
                  <div style={{ marginTop: "0.25rem" }}>
                    <select
                      value={selectedLeadForDetail.status}
                      onChange={(e) => handleUpdateLeadStatus(selectedLeadForDetail.id, e.target.value)}
                      className="form-input"
                      style={{ 
                        fontSize: "0.8rem", 
                        padding: "0.3rem 0.5rem", 
                        color: "black", 
                        background: "#f8fafc",
                        border: "1px solid var(--border-color)",
                        borderRadius: "4px"
                      }}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Replied">Replied</option>
                      <option value="Meeting Scheduled">Meeting Scheduled</option>
                      <option value="Not Interested">Not Interested</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: "0.8rem", color: "#000000" }}>Latest Reply Received</strong>
                <div style={{ 
                  background: "#f8fafc", 
                  padding: "0.75rem", 
                  borderRadius: "6px", 
                  fontSize: "0.85rem", 
                  color: "#000000", 
                  border: "1px solid var(--border-color)",
                  marginTop: "0.25rem",
                  maxHeight: "100px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap"
                }}>
                  {selectedLeadForDetail.reply_text ? `"${selectedLeadForDetail.reply_text}"` : "No reply detected yet. Send email and reply to it, then click Scanning Inbox."}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <strong style={{ fontSize: "0.8rem", color: "#000000" }}>Intent Classification</strong>
                  <div style={{ marginTop: "0.25rem" }}>
                    <span style={{ 
                      fontSize: "0.8rem", 
                      fontWeight: "700",
                      color: "#000000"
                    }}>
                      {selectedLeadForDetail.intent_classification || "Not Scanned Yet"}
                    </span>
                  </div>
                </div>

                <div>
                  <strong style={{ fontSize: "0.8rem", color: "#000000" }}>Computed Lead Score</strong>
                  <div style={{ fontWeight: "700", fontSize: "1.1rem", color: "#000000" }}>
                    {selectedLeadForDetail.lead_score}/100
                  </div>
                </div>
              </div>

              {/* Campaign Notes & CRM History section */}
              <div>
                <strong style={{ fontSize: "0.8rem", color: "#000000" }}>Campaign Notes & CRM History</strong>
                <textarea
                  className="form-input"
                  rows={3}
                  value={leadNotesInput}
                  onChange={(e) => setLeadNotesInput(e.target.value)}
                  placeholder="Enter custom notes, key contact points, or partnership status details..."
                  style={{ 
                    color: "#000000", 
                    background: "#f8fafc", 
                    width: "100%", 
                    padding: "0.5rem", 
                    fontSize: "0.85rem", 
                    marginTop: "0.25rem",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    resize: "vertical"
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: "0.5rem", padding: "0.35rem 0.75rem", fontSize: "0.8rem", background: "var(--primary)" }}
                  onClick={() => handleUpdateLeadNotes(selectedLeadForDetail.id, leadNotesInput)}
                >
                  Save Notes
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setSelectedLeadForDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {selectedLeadForMeeting && (
        <div className="drawer-backdrop" style={{ zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSelectedLeadForMeeting(null)}>
          <div className="glass-card" style={{ width: "90%", maxWidth: "450px", padding: "1.5rem", background: "#ffffff", border: "1px solid var(--border-color)", zIndex: 10001 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.15rem", color: "var(--primary)", fontWeight: "800", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              📅 Schedule MOU Discussion
            </h3>
            
            <form onSubmit={handleScheduleMeetingSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <strong style={{ fontSize: "0.8rem", color: "#000000" }}>Incubator Name</strong>
                <div style={{ fontWeight: "700", color: "#000000" }}>{selectedLeadForMeeting.incubator_name}</div>
                <div style={{ fontSize: "0.85rem", color: "#000000" }}>{selectedLeadForMeeting.email}</div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: "700", color: "#000000", fontSize: "0.8rem", marginBottom: "0.25rem", display: "block" }}>Select Meeting Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={meetingDate} 
                  onChange={(e) => setMeetingDate(e.target.value)} 
                  required 
                  style={{ color: "#000000", background: "#f8fafc", width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: "700", color: "#000000", fontSize: "0.8rem", marginBottom: "0.25rem", display: "block" }}>Select Meeting Time</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 11:00 AM or 15:30" 
                  value={meetingTime} 
                  onChange={(e) => setMeetingTime(e.target.value)} 
                  required 
                  style={{ color: "#000000", background: "#f8fafc", width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedLeadForMeeting(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={schedulingMeeting}
                  style={{ background: "var(--accent-green)", border: "1px solid var(--accent-green)", color: "#000000", fontWeight: "600" }}
                >
                  {schedulingMeeting ? "Scheduling..." : "Schedule & Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
