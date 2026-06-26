import React, { useState, useEffect, useRef } from "react";
import { PenTool, Send, Trash2, Award, FileText, CheckCircle2, Maximize2, Minimize2, Upload, Download, Printer, RefreshCcw } from "lucide-react";

const TEMPLATES = {
  incubation: {
    title: "MEMORANDUM OF UNDERSTANDING FOR STARTUP INCUBATION & ECOSYSTEM SUPPORT",
    getText: (data) => `MEMORANDUM OF UNDERSTANDING (MoU)

This Memorandum of Understanding (hereinafter referred to as the "Agreement") is entered into and executed on this ${data.date} ("Effective Date"), by and between:

PARTY A:
${data.incubatorName || "[Select Party A Incubator]"}
Located at: ${data.incubatorCity || "City"}, ${data.incubatorState || "State"}, India
Represented by: ${data.incubatorRep || "[Incubator Representative Name]"}
(hereinafter referred to as the "Incubator", which expression shall, unless repugnant to the context or meaning thereof, include its successors-in-interest and permitted assigns);

AND

PARTY B:
${data.partyBName || "[Startup/Incubatee Name]"}
Contact Email: ${data.partyBEmail || "[Contact Email]"}
Represented by: ${data.partyBRep || "[Representative Name]"}
(hereinafter referred to as the "Incubatee", which expression shall, unless repugnant to the context or meaning thereof, include its successors-in-interest and permitted assigns).

WHEREAS:
A. The Incubator is a Technology Business Incubator established to foster innovation, research, and entrepreneurship by providing infrastructure, mentorship, and support to early-stage technology ventures.
B. The Incubatee is engaged in developing innovative technology solutions in the focus sector of: ${data.targetSectors || "Technology"}.
C. The Incubatee has requested admission to the incubation program of the Incubator, and the Incubator has agreed to admit the Incubatee on the terms and conditions set forth herein.

NOW, THEREFORE, IT IS MUTUALLY AGREED BY AND BETWEEN THE PARTIES AS FOLLOWS:

1. SCOPE OF SERVICES & RESOURCES
1.1 Facilities: The Incubator agrees to provide physical co-working space, high-speed internet, and laboratory infrastructure for a period of ${data.duration || "3 Years"} from the Effective Date.
1.2 Advisory: The Incubator shall facilitate access to professional mentors, industry experts, regulatory advisory, and capital/investor networks.

2. CONSIDERATION & COMMERCIALS
2.1 Compensation: In consideration of the services and infrastructure provided, the Incubatee agrees to either:
  (a) Pay standard monthly incubation facility fees as agreed in writing, or
  (b) Grant the Incubator a mutually agreed equity stake (typically 1% to 3%) in the Incubatee startup entity, subject to a separate definitive equity agreement.

3. INTELLECTUAL PROPERTY RIGHTS (IPR)
3.1 Ownership: All intellectual property, designs, patents, software code, and business models developed solely by the Incubatee during the incubation period shall remain the exclusive property of the Incubatee.
3.2 Joint Development: Any IP created jointly by the staff/students of the Incubator and the Incubatee shall be jointly owned, and the commercialization terms shall be governed by a separate joint-patent agreement.

4. CONFIDENTIALITY & NON-DISCLOSURE
4.1 Obligation: Both Parties agree to maintain strict confidentiality regarding all proprietary information, trade secrets, technology structures, and business plans disclosed during the term of this incubation.
4.2 Survival: The confidentiality obligations shall survive the expiration or termination of this Agreement for a period of three (3) years.

5. TERM AND TERMINATION
5.1 Duration: This MoU is valid for a period of ${data.duration || "3 Years"} from the Effective Date.
5.2 Termination: Either Party may terminate this Agreement with thirty (30) days prior written notice. The Incubator reserves the right to terminate this agreement immediately in the event of material breach of policies.

6. GOVERNING LAW & ARBITRATION
6.1 Law: This Agreement shall be governed by and construed in accordance with the laws of India.
6.2 Arbitration: Any dispute arising out of this MoU shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be in the state of ${data.incubatorState || "India"} and the language of arbitration shall be English.

IN WITNESS WHEREOF, the Parties hereto have signed and executed this Memorandum of Understanding on the date and year first written above.`
  },
  mentorship: {
    title: "EXECUTIVE COLLABORATION AND STARTUP MENTORSHIP AGREEMENT",
    getText: (data) => `EXECUTIVE MENTORSHIP & ADVISORY AGREEMENT

This Executive Mentorship Agreement (hereinafter referred to as the "Agreement") is made and entered into on this ${data.date} ("Effective Date"), by and between:

PARTY A:
${data.incubatorName || "[Select Party A Incubator]"}
Represented by: ${data.incubatorRep || "[Incubator Representative Name]"}
(hereinafter referred to as the "Incubator", which expression shall, unless repugnant to the context or meaning thereof, include its successors-in-interest and permitted assigns);

AND

PARTY B:
${data.partyBName || "[Mentor/Advisor Name]"}
Contact Email: ${data.partyBEmail || "[Contact Email]"}
(hereinafter referred to as the "Ecosystem Mentor", which expression shall, unless repugnant to the context or meaning thereof, include its successors and permitted assigns).

WHEREAS:
A. The Incubator supports various startup entrepreneurs and desires to leverage external expert advisory networks.
B. The Ecosystem Mentor possesses deep expertise in: ${data.targetSectors || "Technology and Business Strategy"}.
C. The Mentor agrees to provide advisory, startup evaluation, and strategic mentorship services to the Incubator's portfolio startups on an independent contractor basis.

NOW, THEREFORE, IT IS MUTUALLY AGREED BY AND BETWEEN THE PARTIES AS FOLLOWS:

1. ADVISORY ENGAGEMENT & SERVICES
1.1 Mentoring: The Mentor agrees to provide pro-bono or equity-incentivized strategic advice, product reviews, and business model reviews to incubated founders.
1.2 Commitments: The Mentor agrees to dedicate reasonable hours per month for a duration of ${data.duration || "3 Years"} from the Effective Date.

2. RELATIONSHIP OF PARTIES
2.1 Independent Contractor: The Mentor's relationship with the Incubator is that of an independent professional expert. Nothing in this Agreement shall construct an employer-employee, agency, or partnership relationship.

3. CONFIDENTIALITY AND NON-DISCLOSURE (NDA)
3.1 Non-Disclosure: The Mentor acknowledges that in the course of advisory sessions, startups will disclose highly sensitive proprietary code, financials, and trade secrets. The Mentor agrees to hold all such information in strict confidence and shall not disclose it to any third party.
3.2 Non-Compete: The Mentor shall not exploit the proprietary business ideas of mentored startups for personal commercial gain or for competing businesses.

4. INTELLECTUAL PROPERTY
4.1 No Claim: The Mentor agrees that all intellectual property, improvements, and business products developed by the startups during or after the mentorship sessions remain the exclusive property of the respective startup. The Mentor makes no claims to any startup IP by virtue of providing advisory services.

5. LIABILITY & INDEMNITY
5.1 Good Faith: Advisory services are provided in good faith. The Mentor shall not be held liable for the commercial failure or financial losses of any mentored startup resulting from strategic business decisions.

6. GOVERNING LAW & JURISDICTION
6.1 Jurisdiction: This Agreement shall be governed by the laws of India. Any disputes arising out of this engagement shall be subject to the exclusive jurisdiction of the competent courts in the state of the Incubator's registration.

IN WITNESS WHEREOF, the Parties hereto have signed and executed this Advisory Agreement on the date and year first written above.`
  },
  collaboration: {
    title: "MEMORANDUM OF UNDERSTANDING FOR STRATEGIC COOPERATION AND ACADEMIC COLLABORATION",
    getText: (data) => `STRATEGIC INSTITUTIONAL COLLABORATION MOU

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

IN WITNESS WHEREOF, the Parties hereto have signed and executed this Memorandum of Understanding on the date and year first written above.`
  }
};


export default function MouGenerator({ preselectedIncubatorName }) {
  const [incubators, setIncubators] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [selectedIncId, setSelectedIncId] = useState("");
  const [partyBName, setPartyBName] = useState("");
  const [partyBEmail, setPartyBEmail] = useState("");
  const [partyBRep, setPartyBRep] = useState("");
  const [mouType, setMouType] = useState("incubation");
  const [mouDate, setMouDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("3 Years");
  const [targetSectors, setTargetSectors] = useState("DeepTech, AI/ML, SaaS");
  const [incubatorRep, setIncubatorRep] = useState("Director, IncubIMN");
  const [mouText, setMouText] = useState("");
  
  // Manual editing and auto-sync state
  const [autoSync, setAutoSync] = useState(true);
  
  // Signature Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  
  // Email sending states
  const [emailRecipient, setEmailRecipient] = useState("abcd@rtmun.ac.in");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // { type: 'success'|'error'|'mock', message: '' }
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef(null);

  // Load incubators
  useEffect(() => {
    const fetchIncubators = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/incubators");
        const data = await res.json();
        setIncubators(data);
        
        // Find default Nagpur University incubator
        const defaultNagpur = data.find(inc => inc.name.includes("IMN incubation") || inc.name.includes("IncubIMN") || inc.name.includes("Nagpur"));
        if (defaultNagpur) {
          setSelectedIncId(defaultNagpur.id);
          setIncubatorRep(defaultNagpur.founder_or_head || "Director, IncubIMN");
          if (defaultNagpur.email) {
            setEmailRecipient(defaultNagpur.email);
          }
        }
      } catch (e) {
        console.error("Error fetching incubators:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchIncubators();
  }, []);

  // Preselected incubator watcher
  useEffect(() => {
    if (preselectedIncubatorName && incubators.length > 0) {
      const match = incubators.find(inc => inc.name.toLowerCase() === preselectedIncubatorName.toLowerCase());
      if (match) {
        setSelectedIncId(match.id);
        setIncubatorRep(match.founder_or_head || "Chief Executive Officer");
        if (match.email) {
          setEmailRecipient(match.email);
        }
      }
    }
  }, [preselectedIncubatorName, incubators]);

  // Update incubator metadata when dropdown changes
  const handleIncubatorChange = (e) => {
    const id = e.target.value;
    setSelectedIncId(id);
    const selected = incubators.find((inc) => inc.id === id);
    if (selected) {
      setIncubatorRep(selected.founder_or_head || "Chief Executive Officer");
      // Populate recipient email defaults to incubator email if set
      if (selected.email) {
        setEmailRecipient(selected.email);
      }
    }
  };

  // Synchronize generated text when any fields change
  const currentIncubator = incubators.find((inc) => inc.id === selectedIncId);
  const formData = {
    date: mouDate,
    incubatorName: currentIncubator ? currentIncubator.name : "",
    incubatorCity: currentIncubator ? currentIncubator.city : "",
    incubatorState: currentIncubator ? currentIncubator.state : "",
    incubatorRep: incubatorRep,
    partyBName: partyBName,
    partyBEmail: partyBEmail,
    partyBRep: partyBRep,
    duration: duration,
    targetSectors: targetSectors
  };

  useEffect(() => {
    if (autoSync) {
      const template = TEMPLATES[mouType];
      if (template) {
        setMouText(template.getText(formData));
      }
    }
  }, [selectedIncId, partyBName, partyBEmail, partyBRep, mouType, mouDate, duration, targetSectors, incubatorRep, autoSync]);

  // Signature Canvas Drawing Handlers
  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e3a8a"; // Navy signature ink
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
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
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
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
    // Check if canvas is empty before adopting
    const isEmpty = isCanvasEmpty(canvas);
    if (isEmpty) {
      alert("Please draw your signature on the canvas first.");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureData(dataUrl);
  };

  const isCanvasEmpty = (canvas) => {
    const context = canvas.getContext("2d");
    const buffer = new Uint32Array(
      context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG/JPG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Scale and center the image in the canvas
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.min(hRatio, vRatio, 1);
        
        const centerShift_x = (canvas.width - img.width * ratio) / 2;
        const centerShift_y = (canvas.height - img.height * ratio) / 2;
        
        ctx.drawImage(
          img,
          0,
          0,
          img.width,
          img.height,
          centerShift_x,
          centerShift_y,
          img.width * ratio,
          img.height * ratio
        );
        
        // Automatically adopt the signature
        const dataUrl = canvas.toDataURL("image/png");
        setSignatureData(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDownloadTxt = () => {
    if (!mouText) {
      alert("No MOU content to download.");
      return;
    }
    const title = TEMPLATES[mouType]?.title || "Memorandum of Understanding";
    const content = `${title}\n\n${mouText}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print the document.");
      return;
    }

    const title = TEMPLATES[mouType]?.title || "Memorandum of Understanding";
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: Georgia, serif;
              line-height: 1.6;
              color: #000000;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .mou-seal {
              text-align: center;
              border: 2px solid #1e3a8a;
              color: #1e3a8a;
              font-family: 'Times New Roman', serif;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 2px;
              padding: 10px;
              width: 120px;
              margin: 0 auto 30px auto;
              border-radius: 50%;
              line-height: 1.2;
            }
            .mou-title {
              font-size: 18px;
              font-weight: 800;
              text-align: center;
              margin-bottom: 40px;
              text-transform: uppercase;
              color: #111111;
            }
            .mou-text-body {
              white-space: pre-wrap;
              font-size: 14px;
              margin-bottom: 60px;
              text-align: justify;
            }
            .mou-signatures-display {
              display: flex;
              justify-content: space-between;
              margin-top: 50px;
              page-break-inside: avoid;
            }
            .mou-sig-block {
              width: 45%;
              text-align: center;
            }
            .mou-sig-line {
              border-top: 1px solid #000000;
              margin-top: 40px;
              margin-bottom: 8px;
            }
            .mou-sig-image {
              max-height: 60px;
              max-width: 180px;
              object-fit: contain;
              display: block;
              margin: 0 auto;
            }
            @media print {
              body {
                padding: 0;
              }
              @page {
                margin: 20mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="mou-seal">
            Ecosystem<br />Portal<br />Govt of India
          </div>
          <div class="mou-title">${title}</div>
          <div class="mou-text-body">${mouText}</div>
          
          <div class="mou-signatures-display">
            <div class="mou-sig-block">
              <div style="font-size: 11px; color: #b45309; border: 1px dashed #b45309; padding: 4px; margin-bottom: 10px; display: inline-block;">
                PARTY A STAMPED
              </div>
              <div class="mou-sig-line"></div>
              <div style="font-size: 12px; font-weight: bold;">${incubatorRep || "Party A Representative"}</div>
              <div style="font-size: 11px; color: #555555;">Authorized Signatory, Party A</div>
            </div>
            <div class="mou-sig-block">
              ${signatureData ? `<img src="${signatureData}" alt="Digital Signature" class="mou-sig-image" />` : `<div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #777777; font-size: 12px; font-style: italic;">Pending signature...</div>`}
              <div class="mou-sig-line"></div>
              <div style="font-size: 12px; font-weight: bold;">${partyBRep || partyBName || "Party B Representative"}</div>
              <div style="font-size: 11px; color: #555555;">Authorized Signatory, Party B</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Submit and send signed MOU via email API
  const handleSendMou = async (e) => {
    e.preventDefault();
    if (!selectedIncId) {
      alert("Please select a Party A Incubator.");
      return;
    }
    if (!partyBName) {
      alert("Please enter Party B Name.");
      return;
    }
    if (!signatureData) {
      alert("Please draw and adopt your digital signature first.");
      return;
    }
    if (!emailRecipient) {
      alert("Please enter a recipient email address.");
      return;
    }

    setSendingEmail(true);
    setEmailStatus(null);

    const postData = {
      incubator_name: currentIncubator.name,
      incubator_email: currentIncubator.email || "incubator@example.gov.in",
      party_b_name: partyBName,
      party_b_email: partyBEmail || "partyb@example.com",
      mou_title: TEMPLATES[mouType].title,
      mou_text: mouText,
      signature_data: signatureData,
      recipient_email: emailRecipient
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/api/mou/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData)
      });
      
      const result = await res.json();
      if (res.ok) {
        if (result.status === "mock_success") {
          setEmailStatus({
            type: "mock",
            message: `MOU Signed & Sent! [DEVELOPER MOCK MODE] Since SMTP is not configured in env variables, the email and signature PNG were successfully saved to backend file log: f:\\WorkForRTMUN\\backend\\scratch\\mou_sent_log.txt`
          });
        } else {
          setEmailStatus({
            type: "success",
            message: "MOU digitally signed and successfully sent via SMTP email!"
          });
        }
      } else {
        setEmailStatus({
          type: "error",
          message: `Error sending email: ${result.detail || "Server error"}`
        });
      }
    } catch (err) {
      console.error(err);
      setEmailStatus({
        type: "error",
        message: "Failed to connect to email API endpoint."
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: "2rem" }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--primary)", marginBottom: "0.5rem" }}>
        📝 Digital MOU Signature Workspace
      </h2>
      <p style={{ color: "var(--text-dim)", fontSize: "0.95rem", marginBottom: "2rem" }}>
        Generate legally aligned Memorandum of Understanding agreements with incubators, draw your digital signature, and dispatch via email.
      </p>

      <div className="mou-layout">
        {/* Left Side: Form Controls */}
        <div className="mou-form-container">
          <div className="form-group">
            <label>MOU Type & Agreement Template</label>
            <div className="template-grid">
              <button 
                type="button" 
                className={`template-btn ${mouType === "incubation" ? "active" : ""}`}
                onClick={() => setMouType("incubation")}
              >
                <FileText size={18} />
                <span>Startup Incubation</span>
              </button>
              <button 
                type="button" 
                className={`template-btn ${mouType === "mentorship" ? "active" : ""}`}
                onClick={() => setMouType("mentorship")}
              >
                <Award size={18} />
                <span>Advisory Mentor</span>
              </button>
              <button 
                type="button" 
                className={`template-btn ${mouType === "collaboration" ? "active" : ""}`}
                onClick={() => setMouType("collaboration")}
              >
                <PenTool size={18} />
                <span>Academic Collab</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Party A: Incubator (Select from indexed DB)</label>
            <select 
              className="form-select"
              value={selectedIncId}
              onChange={handleIncubatorChange}
              disabled={loading}
            >
              <option value="">-- Choose Incubator --</option>
              {incubators.map((inc) => (
                <option key={inc.id} value={inc.id}>{inc.name} ({inc.city})</option>
              ))}
            </select>
            {loading && <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>Loading 1,353 records...</span>}
          </div>

          <div className="form-group">
            <label>Party A Representative (Founder / Head)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Director" 
              value={incubatorRep}
              onChange={(e) => setIncubatorRep(e.target.value)}
            />
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "0.5rem 0" }} />

          <div className="form-group">
            <label>Party B: Startup / Mentor / Institution Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Ideaforge Tech / Prof. Sharma" 
              value={partyBName}
              onChange={(e) => setPartyBName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Party B Representative Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. CEO / Director" 
              value={partyBRep}
              onChange={(e) => setPartyBRep(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Party B Contact Email</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="partyb@domain.com" 
              value={partyBEmail}
              onChange={(e) => setPartyBEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>MOU Terms Duration & Focus Sectors</label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <input 
                type="text" 
                className="form-input" 
                style={{ width: "35%" }}
                placeholder="Duration" 
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              <input 
                type="text" 
                className="form-input" 
                style={{ flexGrow: "1" }}
                placeholder="Sectors" 
                value={targetSectors}
                onChange={(e) => setTargetSectors(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Agreement Execution Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={mouDate}
              onChange={(e) => setMouDate(e.target.value)}
            />
          </div>

          {/* Interactive Digital Signature Drawing Canvas */}
          <div className="form-group">
            <label>Draw Digital Signature (Sign Below)</label>
            <div className="sig-pad-container">
              <div className="sig-pad-header">
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Use Mouse / Touchpad inside box</span>
                {signatureData && <span style={{ fontSize: "0.75rem", color: "var(--accent-green)", fontWeight: 700 }}>✓ Adopted</span>}
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
              />
              <div className="sig-pad-footer">
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
                <button type="button" className="btn btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }} onClick={adoptSignature}>
                  Adopt Signature
                </button>
              </div>
            </div>
          </div>

          {/* Email dispatch */}
          <form onSubmit={handleSendMou} className="form-group" style={{ marginTop: "1rem" }}>
            <label>MOU Dispatch Settings</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input 
                type="email" 
                className="form-input" 
                style={{ flexGrow: "1" }}
                placeholder="Send PDF copy to: recipient@domain.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                required
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={sendingEmail}
              >
                {sendingEmail ? "Sending..." : "Sign & Send"}
                <Send size={14} />
              </button>
            </div>
            {emailStatus && (
              <div style={{ 
                marginTop: "0.75rem", 
                padding: "0.75rem", 
                borderRadius: "8px", 
                fontSize: "0.85rem",
                lineHeight: "1.4",
                background: emailStatus.type === "error" ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)",
                color: emailStatus.type === "error" ? "var(--accent-red)" : "var(--accent-green)",
                border: `1px solid ${emailStatus.type === "error" ? "rgba(220,38,38,0.2)" : "rgba(22,163,74,0.2)"}`
              }}>
                {emailStatus.message}
              </div>
            )}
          </form>
        </div>

        {/* Right Side: Live Government Paper Document Preview */}
        <div className={`mou-preview-container ${isFullscreen ? "fullscreen" : ""}`}>
          <div className="mou-preview-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)" }}>AGREEMENT PREVIEW</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.15rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Format: Standard Govt Innovation MOU</span>
                {!autoSync && (
                  <span style={{ 
                    fontSize: "0.7rem", 
                    background: "rgba(245,158,11,0.15)", 
                    color: "#b45309", 
                    padding: "0.1rem 0.35rem", 
                    borderRadius: "4px", 
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.2rem"
                  }}>
                    ⚠️ Manual Edit Active
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {!autoSync && (
                <button
                  type="button"
                  className="btn-mou-action"
                  onClick={() => setAutoSync(true)}
                  style={{
                    background: "rgba(22,163,74,0.08)",
                    border: "1px solid rgba(22,163,74,0.2)",
                    color: "var(--accent-green)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    transition: "all 0.2s ease"
                  }}
                  title="Regenerate agreement text based on the left form details"
                >
                  <RefreshCcw size={14} />
                  <span>Reset to Template</span>
                </button>
              )}
              <button
                type="button"
                className="btn-mou-action"
                onClick={handleDownloadTxt}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  transition: "all 0.2s ease"
                }}
                title="Download MOU Text File"
              >
                <Download size={16} />
                <span>Download</span>
              </button>
              <button
                type="button"
                className="btn-mou-action"
                onClick={handlePrint}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  transition: "all 0.2s ease"
                }}
                title="Print MOU / Save to PDF"
              >
                <Printer size={16} />
                <span>Print / PDF</span>
              </button>
              <button
                type="button"
                className="btn-fullscreen"
                onClick={() => setIsFullscreen(!isFullscreen)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  transition: "all 0.2s ease"
                }}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
              </button>
            </div>
          </div>
          
          <div className="mou-preview-paper">
            {/* Ashoka Chakra Styled Emblem Seal */}
            <div className="mou-seal">
              Ecosystem<br />Portal<br />Govt of India
            </div>

            <div className="mou-title">
              {TEMPLATES[mouType].title}
            </div>

            <textarea
              className="mou-text-body-editable"
              value={mouText}
              onChange={(e) => {
                setMouText(e.target.value);
                setAutoSync(false);
              }}
              placeholder="Start drafting or editing your agreement here..."
            />

            <div className="mou-signatures-display">
              <div className="mou-sig-block">
                {/* Simulated Party A stamp */}
                <div style={{ fontSize: "0.75rem", color: "#b45309", border: "1px dashed #b45309", padding: "0.25rem", marginBottom: "0.5rem", width: "120px", display: "inline-block" }}>
                  PARTY A STAMPED
                </div>
                <div className="mou-sig-line"></div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{incubatorRep || "Party A Representative"}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>Authorized Signatory, Party A</div>
              </div>
              <div className="mou-sig-block">
                {signatureData ? (
                  <img src={signatureData} alt="Digital Signature" className="mou-sig-image" />
                ) : (
                  <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: "0.8rem", fontStyle: "italic", marginBottom: "0.5rem" }}>
                    Pending signature...
                  </div>
                )}
                <div className="mou-sig-line"></div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{partyBRep || partyBName || "Party B Representative"}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>Authorized Signatory, Party B</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
