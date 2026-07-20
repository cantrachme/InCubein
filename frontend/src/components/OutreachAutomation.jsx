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
  Download,
  Building2,
  Rocket
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


const PREDEFINED_TEMPLATES = {
  incubation: {
    name: "Incubation Seat Offer",
    subject: "INCUBEIN Cohort: Incubation Seat Offer - {StartupName}",
    body: "Dear Founder,\n\nWe are pleased to inform you that {StartupName} has been selected for incubation in the INCUBEIN Startup Cohort!\n\nOur evaluation committee was highly impressed by your application. We will follow up shortly with formal onboarding details.\n\nBest regards,\nINCUBEIN Foundation Team"
  },
  deck_request: {
    name: "Pitch Deck Request",
    subject: "INCUBEIN Cohort: Pitch Deck Request - {StartupName}",
    body: "Dear Founder,\n\nThank you for applying to the INCUBEIN Startup Program.\n\nWe have completed our initial screening. To assist in our final ranking, please reply with your latest presentation deck and financial roadmap.\n\nBest regards,\nINCUBEIN Foundation Team"
  },
  interview: {
    name: "Selection Interview Invite",
    subject: "INCUBEIN Cohort: Selection Interview - {StartupName}",
    body: "Dear Founder,\n\nCongratulations! {StartupName} has shortlisted for the final interview phase of the INCUBEIN Cohort.\n\nPlease select a convenient slot to schedule a 15-minute pitch session with our selection committee.\n\nBest regards,\nINCUBEIN Foundation Team"
  }
};

export default function OutreachAutomation({ preselectedIncubatorName, refreshTrigger, defaultTargetType }) {
  const [leads, setLeads] = useState([]);

  const [targetType, setTargetType] = useState(defaultTargetType || "incubators"); // 'incubators' or 'startups'

  useEffect(() => {
    if (defaultTargetType) {
      setTargetType(defaultTargetType);
    }
  }, [defaultTargetType]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("incubation");

  const [meetings, setMeetings] = useState([]);
  const [incubators, setIncubators] = useState([]);
  const [externalEvents, setExternalEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [checkingFollowups, setCheckingFollowups] = useState(false);
  const [followupDelay, setFollowupDelay] = useState(120);
  
  // Active workflow node (for flowchart animation highlight)
  // 1: Send, 2: Reply, 3: AI intent, 4: Score, 5: Calendar
  const [activeWorkflowNode, setActiveWorkflowNode] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState("campaigns");

  // Ensure invalid tabs for startups are deselected automatically
  useEffect(() => {
    if (targetType === "startups" && (activeSubTab === "mou" || activeSubTab === "discover")) {
      setActiveSubTab("campaigns");
    }
  }, [targetType, activeSubTab]);
  
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
  const [leadNextActionDateInput, setLeadNextActionDateInput] = useState("");

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
  // Filter campaign leads
  const filteredLeads = leads.filter(lead => {
    // Target Type filtering
    if (targetType === "startups") {
      if (lead.incubator_id !== "incubein_cohort") return false;
    } else {
      if (lead.incubator_id === "incubein_cohort") return false;
    }

    if (leadSearchQuery && 
        !lead.incubator_name.toLowerCase().includes(leadSearchQuery.toLowerCase()) && 
        !(lead.email || "").toLowerCase().includes(leadSearchQuery.toLowerCase())) {
      return false;
    }
    if (leadSelectedStatus && lead.status !== leadSelectedStatus) {
      return false;
    }
    return true;
  });

  const filteredMeetings = meetings.filter(meeting => {
    if (targetType === "startups") {
      return meeting.incubator_id === "incubein_cohort";
    } else {
      return meeting.incubator_id !== "incubein_cohort";
    }
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
      setLeadNextActionDateInput(selectedLeadForDetail.next_action_date || "");
    } else {
      setLeadNotesInput("");
      setLeadNextActionDateInput("");
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
      const leadsRes = await fetch("/api/outreach/leads", { cache: "no-store" });
      const leadsData = await leadsRes.json();
      setLeads(leadsData);
      
      const meetingsRes = await fetch("/api/outreach/meetings", { cache: "no-store" });
      const meetingsData = await meetingsRes.json();
      setMeetings(meetingsData);

      const incsRes = await fetch("/api/incubators", { cache: "no-store" });
      const incsData = await incsRes.json();
      setIncubators(incsData);

      // Fetch external events using the Google Calendar API key
      try {
        const calendarRes = await fetch("/api/outreach/calendar-events", { cache: "no-store" });
        const calendarData = await calendarRes.json();
        setExternalEvents(calendarData.events || []);
      } catch (calErr) {
        console.error("Error fetching calendar events:", calErr);
      }

      // Fetch auto-scan interval and followup delay config
      try {
        const configRes = await fetch("/api/outreach/config");
        const configData = await configRes.json();
        if (configData) {
          if (typeof configData.sync_interval === "number") {
            setSyncInterval(configData.sync_interval);
          }
          if (typeof configData.followup_delay === "number") {
            setFollowupDelay(configData.followup_delay);
          }
        }
      } catch (configErr) {
        console.error("Error fetching sync config:", configErr);
      }

      // Fetch OAuth configuration & authorization status
      try {
        const oauthRes = await fetch("/api/outreach/oauth-status");
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
      const res = await fetch("/api/outreach/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_interval: newVal, followup_delay: followupDelay })
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

  const handleFollowupDelayChange = async (newVal) => {
    setFollowupDelay(newVal);
    addLog("SYSTEM", `Changing follow-up delay to ${newVal} seconds...`);
    try {
      const res = await fetch("/api/outreach/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_interval: syncInterval, followup_delay: newVal })
      });
      if (res.ok) {
        addLog("SYSTEM", `Follow-up delay successfully updated to ${newVal} seconds.`);
      } else {
        addLog("ERROR", "Failed to persist follow-up delay setting on backend.");
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
      const res = await fetch("/api/outreach/add-lead", {
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
      const res = await fetch("/api/outreach/authorize");
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
          const leadsRes = await fetch("/api/outreach/leads", { cache: "no-store" });
          if (leadsRes.ok) {
            const leadsData = await leadsRes.json();
            setLeads(leadsData);
          }
          const meetingsRes = await fetch("/api/outreach/meetings", { cache: "no-store" });
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
      const res = await fetch("/api/outreach/reset", { method: "POST" });
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
      const res = await fetch("/api/outreach/meetings/update-status", {
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
      const res = await fetch("/api/outreach/leads/update-status", {
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

  const handleUpdateLeadNotes = async (leadId, notesText, nextActionDate) => {
    addLog("SYSTEM", `Saving CRM notes and schedule for campaign lead...`);
    try {
      const res = await fetch("/api/outreach/leads/update-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, notes: notesText, next_action_date: nextActionDate })
      });
      const data = await res.json();
      if (res.ok) {
        addLog("SYSTEM", `CRM notes saved successfully.`);
        await fetchData();
        if (selectedLeadForDetail && selectedLeadForDetail.id === leadId) {
          setSelectedLeadForDetail(prev => ({ ...prev, notes: notesText, next_action_date: nextActionDate }));
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
      const res = await fetch("/api/outreach/schedule-meeting", {
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
    addLog("OUTREACH", `Triggering outreach email to ${leadName} (${leadEmail})...`);
    setActiveWorkflowNode(1);
    
    let payload = { lead_id: leadId };
    
    if (targetType === "startups") {
      const template = PREDEFINED_TEMPLATES[selectedTemplateKey];
      const compiledSubject = template.subject.replace(/{StartupName}/g, leadName);
      const compiledBody = template.body.replace(/{StartupName}/g, leadName);
      payload = {
        lead_id: leadId,
        subject: compiledSubject,
        body: compiledBody
      };
    }
    
    try {
      const res = await fetch("/api/outreach/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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
 
  const handleSendFollowup = async (leadId, leadName, leadEmail) => {
    addLog("OUTREACH", `Triggering outreach partnership follow-up email to ${leadName} (${leadEmail})...`);
    
    try {
      const res = await fetch("/api/outreach/send-followup-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId })
      });
      const data = await res.json();
      
      if (res.ok) {
        addLog("OUTREACH", `Followup successfully dispatched. Status: Follow-up Sent.`);
        toast.success(`Follow-up email sent to ${leadName}!`);
        await fetchData();
      } else {
        addLog("ERROR", `Failed to send followup: ${data.detail || "Server error"}`);
        toast.error(`Failed to send followup: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      addLog("ERROR", "Connection to backend followup API failed.");
    }
  };

  const handleTriggerFollowups = async () => {
    setCheckingFollowups(true);
    addLog("SYSTEM", "Scanning for leads due for partnership follow-up emails...");
    
    try {
      const res = await fetch("/api/outreach/send-followups", { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        const count = data.followups_sent_count || 0;
        addLog("SYSTEM", `Follow-up scan complete. Sent ${count} follow-up email(s).`);
        if (count > 0 && data.dispatched) {
          data.dispatched.forEach(item => {
            addLog("OUTREACH", `Dispatched follow-up #${item.followup_number} to ${item.incubator_name} (${item.email}). Status: ${item.status}.`);
          });
        }
        await fetchData();
      } else {
        addLog("ERROR", `Follow-up scan failed: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      addLog("ERROR", "Connection to backend follow-up trigger API failed.");
    } finally {
      setCheckingFollowups(false);
    }
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    addLog("SYSTEM", "Connecting to IMAP inbox to scan for unread responses...");
    
    try {
      const res = await fetch("/api/outreach/check-replies", { method: "POST" });
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

      const res = await fetch("/api/mou/send", {
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
  const totalSent = filteredLeads.filter(l => l.status !== "Draft").length;
  const totalReplies = filteredLeads.filter(l => ["Replied", "Meeting Scheduled", "Not Interested"].includes(l.status)).length;
  const totalMeetings = filteredMeetings.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Premium Target Type Toggle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem", marginTop: "0.5rem" }} className="animate-in">
        <div style={{ 
          background: "rgba(255, 255, 255, 0.7)", 
          padding: "6px", 
          borderRadius: "50px", 
          border: "1px solid rgba(0,0,0,0.08)", 
          display: "inline-flex", 
          gap: "4px",
          position: "relative",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)"
        }}>
          {/* Animated Background Pill */}
          <div style={{
            position: "absolute",
            top: "6px",
            left: targetType === "incubators" ? "6px" : "calc(50% + 2px)",
            width: "calc(50% - 8px)",
            height: "calc(100% - 12px)",
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
            borderRadius: "40px",
            transition: "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)"
          }} />

          <button
            onClick={() => setTargetType("incubators")}
            style={{ 
              minWidth: "190px",
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "transparent",
              color: targetType === "incubators" ? "white" : "var(--text-body)",
              border: "none",
              fontWeight: targetType === "incubators" ? "600" : "500",
              fontSize: "0.95rem",
              position: "relative",
              zIndex: 1,
              transition: "color 0.3s ease",
              cursor: "pointer",
              borderRadius: "40px"
            }}
          >
            <Building2 size={16} />
            Incubator Network
          </button>
          
          <button
            onClick={() => setTargetType("startups")}
            style={{ 
              minWidth: "190px",
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "transparent",
              color: targetType === "startups" ? "white" : "var(--text-body)",
              border: "none",
              fontWeight: targetType === "startups" ? "600" : "500",
              fontSize: "0.95rem",
              position: "relative",
              zIndex: 1,
              transition: "color 0.3s ease",
              cursor: "pointer",
              borderRadius: "40px"
            }}
          >
            <Rocket size={16} />
            Startup Cohort
          </button>
        </div>
      </div>

      {/* Sub Tab Bar Navigation */}
      <div style={{ 
        display: "flex", 
        gap: "0.5rem", 
        borderBottom: "1px solid var(--border-color)", 
        paddingBottom: "0.75rem", 
        marginBottom: "0.5rem", 
        flexWrap: "wrap" 
      }}>
        <button 
          className="btn" 
          style={{ 
            background: activeSubTab === "campaigns" ? "var(--primary-light)" : "transparent",
            color: activeSubTab === "campaigns" ? "var(--primary)" : "var(--text-muted)",
            borderColor: activeSubTab === "campaigns" ? "var(--primary)" : "transparent",
            fontWeight: activeSubTab === "campaigns" ? "700" : "500",
            padding: "8px 16px",
            fontSize: "0.85rem",
            border: "1px solid transparent"
          }}
          onClick={() => setActiveSubTab("campaigns")}
        >
          <Sparkles size={14} style={{ marginRight: "6px" }} />
          Outreach Campaigns
        </button>
        {targetType === "incubators" && (
          <button 
            className="btn" 
            style={{ 
              background: activeSubTab === "mou" ? "var(--primary-light)" : "transparent",
              color: activeSubTab === "mou" ? "var(--primary)" : "var(--text-muted)",
              borderColor: activeSubTab === "mou" ? "var(--primary)" : "transparent",
              fontWeight: activeSubTab === "mou" ? "700" : "500",
              padding: "8px 16px",
              fontSize: "0.85rem",
              border: "1px solid transparent"
            }}
            onClick={() => setActiveSubTab("mou")}
          >
            <PenTool size={14} style={{ marginRight: "6px" }} />
            MOU Draft Builder
          </button>
        )}
        <button 
          className="btn" 
          style={{ 
            background: activeSubTab === "meetings" ? "var(--primary-light)" : "transparent",
            color: activeSubTab === "meetings" ? "var(--primary)" : "var(--text-muted)",
            borderColor: activeSubTab === "meetings" ? "var(--primary)" : "transparent",
            fontWeight: activeSubTab === "meetings" ? "700" : "500",
            padding: "8px 16px",
            fontSize: "0.85rem",
            border: "1px solid transparent"
          }}
          onClick={() => setActiveSubTab("meetings")}
        >
          <Calendar size={14} style={{ marginRight: "6px" }} />
          Scheduled Meetings ({filteredMeetings.length})
        </button>
        {targetType === "incubators" && (
          <button 
            className="btn" 
            style={{ 
              background: activeSubTab === "discover" ? "var(--primary-light)" : "transparent",
              color: activeSubTab === "discover" ? "var(--primary)" : "var(--text-muted)",
              borderColor: activeSubTab === "discover" ? "var(--primary)" : "transparent",
              fontWeight: activeSubTab === "discover" ? "700" : "500",
              padding: "8px 16px",
              fontSize: "0.85rem",
              border: "1px solid transparent"
            }}
            onClick={() => setActiveSubTab("discover")}
          >
            <Building2 size={14} style={{ marginRight: "6px" }} />
            Discover Leads
          </button>
        )}
      </div>

      {activeSubTab === "campaigns" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }} className="animate-in">
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

                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginRight: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "#000000", whiteSpace: "nowrap", fontWeight: "600" }}>Follow-up Delay:</span>
                  <select 
                    className="form-input" 
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", width: "130px", height: "32px", color: "black", background: "#f8fafc", border: "1px solid var(--border-color)", borderRadius: "4px", margin: 0 }}
                    value={followupDelay}
                    onChange={(e) => handleFollowupDelayChange(parseInt(e.target.value))}
                  >
                    <option value={30}>30 sec (Test)</option>
                    <option value={60}>1 min (Test)</option>
                    <option value={120}>2 min (Test)</option>
                    <option value={300}>5 min</option>
                    <option value={86400 * 3}>3 Days</option>
                    <option value={86400 * 7}>7 Days</option>
                  </select>
                </div>

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
                  className="btn btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.75rem", fontSize: "0.8rem", height: "32px", background: "rgba(139, 92, 246, 0.9)", border: "1px solid rgb(139, 92, 246)" }}
                  onClick={handleTriggerFollowups}
                  disabled={checkingFollowups}
                >
                  <Send size={14} className={checkingFollowups ? "spin" : ""} />
                  <span>{checkingFollowups ? "Sending Followups..." : "Trigger Followups"}</span>
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

          {/* Funnel Analytics Widget */}
          {filteredLeads.length > 0 && (() => {
            const targetedCount = filteredLeads.length;
            const sentCount = filteredLeads.filter(l => l.status !== 'Draft').length;
            const followupCount = filteredLeads.filter(l => l.status === 'Follow-up Sent' || (l.followup_count || 0) > 0).length;
            const repliedCount = filteredLeads.filter(l => ['Replied', 'Meeting Scheduled', 'Not Interested', 'In Loop', 'Interviewed', 'Incubated'].includes(l.status)).length;
            const meetingCount = filteredLeads.filter(l => ['Meeting Scheduled', 'Interviewed'].includes(l.status)).length;

            const getPercent = (count, base) => {
              if (!base) return '0%';
              return `${Math.round((count / base) * 100)}%`;
            };

            const funnelStages = [
              { label: "Targeted Leads", count: targetedCount, pct: "100%", color: "var(--accent-purple)", bg: "rgba(139, 92, 246, 0.05)" },
              { label: "Outreach Sent", count: sentCount, pct: getPercent(sentCount, targetedCount), color: "var(--secondary)", bg: "rgba(56, 189, 248, 0.05)" },
              { label: "Follow-up Sent", count: followupCount, pct: getPercent(followupCount, sentCount), color: "var(--accent-amber)", bg: "rgba(245, 158, 11, 0.05)" },
              { label: "Replies Received", count: repliedCount, pct: getPercent(repliedCount, sentCount), color: "var(--primary)", bg: "rgba(99, 102, 241, 0.05)" },
              { label: "Meetings Booked", count: meetingCount, pct: getPercent(meetingCount, repliedCount), color: "var(--accent-green)", bg: "rgba(16, 185, 129, 0.05)" },
            ];

            return (
              <div className="glass-card animate-in" style={{ padding: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  📊 Campaign Conversion Funnel Analytics
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem", alignItems: "stretch" }}>
                  {funnelStages.map((stage, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        background: stage.bg, 
                        border: `1px solid ${stage.color}33`, 
                        borderRadius: "8px", 
                        padding: "1rem", 
                        textAlign: "center", 
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {stage.label}
                      </div>
                      <div style={{ fontSize: "1.8rem", fontWeight: "800", color: stage.color, margin: "0.25rem 0" }}>
                        {stage.count}
                      </div>
                      <div style={{ fontSize: "0.75rem", fontWeight: "600", color: stage.color, background: `${stage.color}1a`, padding: "2px 8px", borderRadius: "12px", display: "inline-block", alignSelf: "center" }}>
                        {idx === 0 ? "Base" : `${stage.pct} conv.`}
                      </div>
                      {idx < 4 && (
                        <div 
                          style={{ 
                            position: "absolute", 
                            right: "-0.7rem", 
                            top: "50%", 
                            transform: "translateY(-50%)", 
                            zIndex: 2, 
                            background: "#ffffff", 
                            borderRadius: "50%", 
                            width: "22px", 
                            height: "22px", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            border: "1px solid var(--border-color)",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                          }}
                        >
                          <ChevronRight size={13} style={{ color: "var(--text-dim)" }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

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
                  <option value="Follow-up Sent">Follow-up Sent</option>
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
                        <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-dim)" }}>
                          {targetType === "startups" ? "Startup" : "Incubator"}
                        </th>
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
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{lead.email}</span>
                              {(lead.followup_count || 0) > 0 && (
                                <span style={{ 
                                  fontSize: "0.68rem", 
                                  fontWeight: "700",
                                  background: "rgba(224, 242, 254, 0.6)", 
                                  color: "#0369a1", 
                                  padding: "1px 5px", 
                                  borderRadius: "3px" 
                                }}>
                                  Follow-ups: {lead.followup_count}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>
                            <select
                              value={lead.status || "Draft"}
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
                                  lead.status === "Follow-up Sent" ? "#e0f2fe" :
                                  lead.status === "Not Interested" ? "#fee2e2" :     
                                  "#f3f4f6",                                         
                                color: 
                                  lead.status === "Meeting Scheduled" ? "#065f46" :
                                  lead.status === "Replied" ? "#5b21b6" :
                                  lead.status === "Sent" ? "#155e75" :
                                  lead.status === "Follow-up Sent" ? "#0369a1" :
                                  lead.status === "Not Interested" ? "#991b1b" :
                                  "#374151"
                              }}
                            >
                              <option value="Draft">Draft</option>
                              <option value="Sent">Sent</option>
                              <option value="Follow-up Sent">Follow-up Sent</option>
                              <option value="Replied">Replied</option>
                              <option value="Meeting Scheduled">Meeting Scheduled</option>
                              <option value="Not Interested">Not Interested</option>
                            </select>
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                            {lead.status === "Draft" || lead.status === "Sent" || lead.status === "Follow-up Sent" ? (
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
                                onClick={(e) => { e.stopPropagation(); handleSendEmail(lead.id, lead.incubator_name, lead.email); }}
                              >
                                <Send size={12} />
                                <span>Send Invite</span>
                              </button>
                            )}
                            {(lead.status === "Sent" || lead.status === "Follow-up Sent") && (lead.followup_count || 0) < 2 && (
                              <button 
                                className="btn btn-primary" 
                                style={{ 
                                  padding: "0.3rem 0.6rem", 
                                  fontSize: "0.75rem", 
                                  marginRight: "0.35rem",
                                  background: "#e0f2fe",
                                  border: "1px solid #0284c7",
                                  color: "#0369a1",
                                  fontWeight: "600",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem"
                                }}
                                onClick={(e) => { e.stopPropagation(); handleSendFollowup(lead.id, lead.incubator_name, lead.email); }}
                              >
                                <Send size={12} />
                                <span>Follow Up</span>
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
                            {["Sent", "Follow-up Sent", "Replied", "Meeting Scheduled", "Not Interested"].includes(lead.status) && (
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

            {/* Live Terminal Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", height: "450px", background: "#0b0f19", border: "1px solid var(--border-color)" }}>
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
            </div>

          </div>
        </div>
      )}

      {activeSubTab === "mou" && (
        <div className="glass-card animate-in" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                ✍ Draft & Execute Academic Collaboration MOU
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-dim)" }}>
                Select an incubator, fill in partner academic institution details, digitally sign, and send the official MOU via email.
              </p>
            </div>
          </div>

          <form onSubmit={handleSendMou} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Search & Select First Party Panel */}
            <div className="form-group" style={{ background: "rgba(255, 255, 255, 0.02)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)", marginBottom: "0.5rem" }}>
              <label style={{ fontWeight: "700", marginBottom: "0.75rem", display: "block", color: "#000000" }}>
                🔍 Search & Select First Party (Incubator)
              </label>
              
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
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <select 
                  className="form-input" 
                  value={selectedIncId} 
                  onChange={(e) => {
                    const incId = e.target.value;
                    setSelectedIncId(incId);
                    const inc = incubators.find(i => i.id === incId);
                    if (inc) {
                      setIncubatorRep(`Director, ${inc.name}`);
                    }
                  }}
                  style={{ fontSize: "0.8rem", padding: "0.45rem", fontWeight: 700, color: "var(--text-primary)", background: "var(--primary-light)", borderColor: "var(--primary)" }}
                  required
                >
                  <option value="">-- Choose Party A (Incubator) --</option>
                  {filteredIncubators.map(inc => (
                    <option key={inc.id} value={inc.id}>{inc.name} ({inc.city ? `${inc.city}, ` : ""}{inc.state})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Second Party Form Fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label>Party B Institution Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Nagpur University Technology Cell" 
                  value={partyBName}
                  onChange={(e) => setPartyBName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Party B Contact Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="e.g. contact@nu-tech.edu.in" 
                  value={partyBEmail}
                  onChange={(e) => setPartyBEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label>Party B Representative</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Dean of R&D" 
                  value={partyBRep}
                  onChange={(e) => setPartyBRep(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Party A Representative (You)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Director, Nagpur Incubation Cell" 
                  value={incubatorRep}
                  onChange={(e) => setIncubatorRep(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "1rem" }}>
              <div className="form-group">
                <label>Execution Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={mouDate}
                  onChange={(e) => setMouDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Validity Period</label>
                <select className="form-input" value={duration} onChange={(e) => setDuration(e.target.value)}>
                  <option value="1 Year">1 Year</option>
                  <option value="2 Years">2 Years</option>
                  <option value="3 Years">3 Years</option>
                  <option value="5 Years">5 Years</option>
                </select>
              </div>
              <div className="form-group">
                <label>Collaboration Sectors</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={targetSectors}
                  onChange={(e) => setTargetSectors(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Signature Pad container */}
            <div className="form-group">
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>✍ Party A Representative Signature (Draw or Upload)</span>
                {signatureData && <span style={{ fontSize: "0.75rem", color: "var(--accent-green)", fontWeight: 700 }}>✓ Signature Adopted</span>}
              </label>
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
        </div>
      )}

      {activeSubTab === "meetings" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }} className="animate-in">
          {/* Left Column: Scheduled Meetings */}
          <div className="glass-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>📅 Scheduled Collaboration Meetings</h3>
            </div>
            
            {filteredMeetings.length === 0 ? (
              <div style={{ 
                padding: "3rem 1rem", 
                textAlign: "center", 
                border: "1px dashed var(--border-color)", 
                borderRadius: "6px",
                color: "var(--text-dim)",
                fontSize: "0.85rem"
              }}>
                <Clock size={24} style={{ margin: "0 auto 0.5rem auto", opacity: 0.5 }} />
                <span>No automated meetings scheduled yet. Trigger outreach and reply checking to sync.</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "400px", overflowY: "auto" }}>
                {filteredMeetings.map((meeting) => (
                  <div 
                    key={meeting.id} 
                    style={{ 
                      padding: "0.75rem", 
                      background: 
                        meeting.status === "Completed" ? "rgba(71, 85, 105, 0.05)" : 
                        meeting.status === "Cancelled" ? "rgba(220, 38, 38, 0.05)" : 
                        meeting.status === "Confirmed" ? "rgba(16, 185, 129, 0.08)" : 
                        "rgba(16, 185, 129, 0.04)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                      <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{meeting.incubator_name}</strong>
                      <span style={{ 
                        fontSize: "0.68rem", 
                        padding: "1px 5px", 
                        borderRadius: "3px", 
                        fontWeight: "700",
                        background: 
                          meeting.status === "Completed" ? "#f1f5f9" : 
                          meeting.status === "Cancelled" ? "#fee2e2" : 
                          meeting.status === "Confirmed" ? "#d1fae5" : 
                          "#f3f4f6",
                        color: 
                          meeting.status === "Completed" ? "#475569" : 
                          meeting.status === "Cancelled" ? "#b91c1c" : 
                          meeting.status === "Confirmed" ? "#065f46" : 
                          "#374151"
                      }}>
                        {meeting.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                      <div>
                        <span>📅 {meeting.date} at 🕒 {meeting.time}</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        {meeting.status === "Confirmed" && (
                          <button 
                            className="btn" 
                            style={{ 
                              fontSize: "0.7rem", 
                              color: "#b91c1c", 
                              background: "#fee2e2", 
                              border: "1px solid #fca5a5", 
                              padding: "2px 6px",
                              borderRadius: "4px"
                            }} 
                            onClick={() => handleUpdateMeetingStatus(meeting.id, "Cancelled")}
                          >
                            Cancel
                          </button>
                        )}
                        {meeting.status === "Confirmed" && (
                          <button 
                            className="btn" 
                            style={{ 
                              fontSize: "0.7rem", 
                              color: "#475569", 
                              background: "#f1f5f9", 
                              border: "1px solid var(--border-color)", 
                              padding: "2px 6px",
                              borderRadius: "4px"
                            }} 
                            onClick={() => handleUpdateMeetingStatus(meeting.id, "Completed")}
                          >
                            Mark Done
                          </button>
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
                            gap: "0.2"
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
          </div>

          {/* Right Column: Google Auth Integration */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="glass-card" style={{ padding: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.05rem", fontWeight: "700" }}>🔒 Google Calendar API Status</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "1rem" }}>
                Integrate Google Calendar token credentials to sync automated video call invites directly.
              </p>
              
              {oauthAuthorized ? (
                <div 
                  style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: "0.35rem", 
                    padding: "0.5rem 1rem", 
                    fontSize: "0.8rem", 
                    background: "#d4edda", 
                    border: "1px solid #c3e6cb", 
                    borderRadius: "6px", 
                    color: "#155724", 
                    fontWeight: "600",
                    width: "100%",
                    justifyContent: "center"
                  }}
                >
                  <CheckCircle size={14} />
                  <span>Google Calendar API Active</span>
                </div>
              ) : oauthConfigured ? (
                <button 
                  className="btn"
                  style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: "0.35rem", 
                    padding: "0.5rem 1rem", 
                    fontSize: "0.8rem", 
                    background: "#fff3cd", 
                    border: "1px solid #ffeeba", 
                    color: "#856404", 
                    fontWeight: "600", 
                    cursor: "pointer", 
                    borderRadius: "6px",
                    width: "100%",
                    justifyContent: "center"
                  }}
                  onClick={handleAuthorizeCalendar}
                >
                  <Calendar size={14} />
                  <span>Authorize Google Calendar Connection</span>
                </button>
              ) : (
                <div 
                  style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: "0.35rem", 
                    padding: "0.5rem 1rem", 
                    fontSize: "0.8rem", 
                    background: "#f8d7da", 
                    border: "1px solid #f5c6cb", 
                    borderRadius: "6px", 
                    color: "#721c24", 
                    fontWeight: "600",
                    width: "100%",
                    justifyContent: "center"
                  }}
                >
                  <AlertCircle size={14} />
                  <span>Google OAuth Client Not Configured (.env)</span>
                </div>
              )}
            </div>

            {/* Public Events Section */}
            {externalEvents.length > 0 && (
              <div className="glass-card" style={{ padding: "1.25rem" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: "700" }}>🏛 Academic & Public Holidays</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "250px", overflowY: "auto" }}>
                  {externalEvents.map((evt, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", background: "var(--bg-surface)", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: "600", marginRight: "0.5rem" }}>{evt.summary}</span>
                      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{evt.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "discover" && (
        <div className="animate-in">
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
                          <td style={{ padding: "0.5rem" }}>
                            <div style={{ fontWeight: "600", color: "#000000" }}>{inc.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{inc.email || "No email available"}</div>
                          </td>
                          <td style={{ padding: "0.5rem" }}>{inc.city ? `${inc.city}, ` : ""}{inc.state}</td>
                          <td style={{ padding: "0.5rem", textAlign: "center" }}>{"⭐".repeat(Math.round(inc.confidence_score * 5))}</td>
                          <td style={{ padding: "0.5rem", textAlign: "right" }}>
                            <button 
                              className="btn" 
                              style={{ 
                                fontSize: "0.75rem", 
                                padding: "0.25rem 0.5rem", 
                                background: isAlreadyLead ? "rgba(16,185,129,0.1)" : "var(--primary-light)",
                                color: isAlreadyLead ? "var(--accent-green)" : "var(--primary)",
                                borderColor: isAlreadyLead ? "rgba(16,185,129,0.2)" : "rgba(0,106,99,0.2)",
                                fontWeight: "700" 
                              }}
                              onClick={() => !isAlreadyLead && handleAddLead(inc)}
                              disabled={isAlreadyLead || addingLeadId === inc.id}
                            >
                              {isAlreadyLead ? "Already in Leads" : addingLeadId === inc.id ? "Adding..." : "Add to Leads"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {filteredIncubatorsFromDir.length > itemsPerPage && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      Showing page <strong style={{ color: "black" }}>{dirCurrentPage}</strong> of <strong style={{ color: "black" }}>{totalPages}</strong> ({filteredIncubatorsFromDir.length} total incubators)
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
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Result / Detail Drawer Modal */}
      {selectedLeadForDetail && (
        <div className="drawer-backdrop" style={{ zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSelectedLeadForDetail(null)}>
          <div className="glass-card animate-in" style={{ width: "95%", maxWidth: "840px", padding: "1.75rem", background: "#ffffff", border: "1px solid var(--border-color)", zIndex: 10001, boxShadow: "var(--shadow-xl)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary)", fontWeight: "800" }}>
                📊 AI Outreach Result Analysis
              </h3>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: "4px 8px", fontSize: "0.85rem" }} 
                onClick={() => setSelectedLeadForDetail(null)}
              >
                Close
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
              
              {/* Left Column: Incubator Details & CRM Notes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "var(--bg-surface)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div>
                    <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>
                      {selectedLeadForDetail.incubator_id === "incubein_cohort" ? "Startup Partner" : "Incubator Partner"}
                    </strong>
                    <div style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "0.95rem", marginTop: "2px" }}>{selectedLeadForDetail.incubator_name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 500 }}>{selectedLeadForDetail.email}</div>
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Status</strong>
                    <div style={{ marginTop: "0.25rem" }}>
                      <select
                        value={selectedLeadForDetail.status || "Draft"}
                        onChange={(e) => handleUpdateLeadStatus(selectedLeadForDetail.id, e.target.value)}
                        className="form-input"
                        style={{ 
                          fontSize: "0.78rem", 
                          padding: "0.25rem 0.5rem", 
                          color: "var(--text-primary)", 
                          background: "#ffffff",
                          border: "1px solid var(--border-color)",
                          borderRadius: "6px",
                          fontWeight: 600
                        }}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Follow-up Sent">Follow-up Sent</option>
                        <option value="Replied">Replied</option>
                        <option value="Meeting Scheduled">Meeting Scheduled</option>
                        <option value="Not Interested">Not Interested</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "var(--bg-surface)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div>
                    <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Follow-ups Sent</strong>
                    <div style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: "700" }}>
                      {selectedLeadForDetail.followup_count || 0} / 2
                    </div>
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Last Follow-up Sent</strong>
                    <div style={{ marginTop: "0.25rem", fontSize: "0.78rem", color: "var(--text-primary)" }}>
                      {selectedLeadForDetail.last_followup_at ? new Date(selectedLeadForDetail.last_followup_at).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                </div>

                {/* Campaign Notes & CRM History */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Campaign Notes & CRM History</strong>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={leadNotesInput}
                    onChange={(e) => setLeadNotesInput(e.target.value)}
                    placeholder="Enter custom notes, key contact points, or partnership status details..."
                    style={{ 
                      color: "var(--text-primary)", 
                      background: "#ffffff", 
                      width: "100%", 
                      padding: "0.5rem", 
                      fontSize: "0.82rem", 
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      resize: "none"
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem", alignSelf: "flex-end" }}
                    onClick={() => handleUpdateLeadNotes(selectedLeadForDetail.id, leadNotesInput)}
                  >
                    Save Notes
                  </button>
                </div>
              </div>
              
              {/* Right Column: AI Analysis Metrics */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Latest Reply Received</strong>
                  <div style={{ 
                    background: "var(--bg-surface)", 
                    padding: "10px 12px", 
                    borderRadius: "6px", 
                    fontSize: "0.8rem", 
                    color: "var(--text-primary)", 
                    border: "1px solid var(--border-color)",
                    marginTop: "0.25rem",
                    maxHeight: "100px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.4
                  }}>
                    {selectedLeadForDetail.reply_text ? `"${selectedLeadForDetail.reply_text}"` : "No reply detected yet. Send email and reply to it, then click Scanning Inbox."}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "var(--bg-surface)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div>
                    <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Intent</strong>
                    <div style={{ marginTop: "0.25rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)" }}>
                        {selectedLeadForDetail.intent_classification || "Not Scanned"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Lead Score</strong>
                    <div style={{ fontWeight: "800", fontSize: "1.1rem", color: "var(--primary)" }}>
                      {selectedLeadForDetail.lead_score}/100
                    </div>
                  </div>
                </div>

                {selectedLeadForDetail.reply_text && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "var(--bg-surface)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <div>
                      <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Sentiment</strong>
                      <div style={{ marginTop: "0.25rem" }}>
                        <span style={{ 
                          fontSize: "0.72rem", 
                          padding: "3px 8px", 
                          borderRadius: "12px", 
                          fontWeight: "700",
                          background: 
                            selectedLeadForDetail.reply_sentiment === "Highly Interested" ? "#d1fae5" :
                            selectedLeadForDetail.reply_sentiment === "Tentative" ? "#fef3c7" :
                            selectedLeadForDetail.reply_sentiment === "Requires Clarification" ? "#dbeafe" :
                            selectedLeadForDetail.reply_sentiment === "Uninterested" ? "#fee2e2" :
                            "#f3f4f6",
                          color: 
                            selectedLeadForDetail.reply_sentiment === "Highly Interested" ? "#065f46" :
                            selectedLeadForDetail.reply_sentiment === "Tentative" ? "#92400e" :
                            selectedLeadForDetail.reply_sentiment === "Requires Clarification" ? "#1e40af" :
                            selectedLeadForDetail.reply_sentiment === "Uninterested" ? "#991b1b" :
                            "#374151"
                        }}>
                          {selectedLeadForDetail.reply_sentiment || "Neutral"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Action Urgency</strong>
                      <div style={{ marginTop: "0.25rem" }}>
                        <span style={{ 
                          fontSize: "0.72rem", 
                          padding: "3px 8px", 
                          borderRadius: "12px", 
                          fontWeight: "700",
                          background: 
                            selectedLeadForDetail.reply_urgency === "High" ? "#ffe4e6" :
                            selectedLeadForDetail.reply_urgency === "Medium" ? "#ffedd5" :
                            "#f1f5f9",
                          color: 
                            selectedLeadForDetail.reply_urgency === "High" ? "#9f1239" :
                            selectedLeadForDetail.reply_urgency === "Medium" ? "#9a3412" :
                            "#475569"
                        }}>
                          {selectedLeadForDetail.reply_urgency || "Low"}
                        </span>
                      </div>
                    </div>

                    <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--border-color)", paddingTop: "8px", marginTop: "4px" }}>
                      <strong style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Category / Reason</strong>
                      <div style={{ marginTop: "0.25rem" }}>
                        <span style={{ 
                          fontSize: "0.75rem", 
                          padding: "3px 8px", 
                          borderRadius: "4px", 
                          fontWeight: "600",
                          background: "#ffffff",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-color)",
                          display: "inline-block"
                        }}>
                          {selectedLeadForDetail.reply_reason || "Other"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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