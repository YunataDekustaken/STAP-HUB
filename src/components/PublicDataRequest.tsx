import React, { useState, useEffect } from "react";
import { 
  FileText, Send, CheckCircle, Search, Clock, Calendar, ShieldAlert, Check, 
  Download, BarChart2, Car, TrendingUp, AlertCircle, RefreshCw, Lock, X, Mail 
} from "lucide-react";
import { FootageRequest } from "./FootageRequestsTab";

export interface ReportRequestSubmission {
  type: string;
  requestedRange: { startDate: string; endDate: string };
  requesterInfo: {
    name: string;
    email: string;
    organization: string;
    contact: string;
    address: string;
  };
}

interface PublicDataRequestProps {
  requests: FootageRequest[];
  onSubmitRequest: (newReq: Omit<FootageRequest, "id" | "dateSubmitted" | "status" | "handledBy">) => void;
  onSubmitReportRequest: (newReq: ReportRequestSubmission) => void;
}

export default function PublicDataRequest({ requests, onSubmitRequest, onSubmitReportRequest }: PublicDataRequestProps) {
  // Mode: "FORM" | "TRACK" | "REPORT_FORM"
  const [activeView, setActiveView] = useState<"FORM" | "TRACK" | "REPORT_FORM">("FORM");
  const [successId, setSuccessId] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  // 01 Requester Information
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  // 02 Nature & Purpose of Request
  const [nature, setNature] = useState("Academic");

  // 03 Footage Details
  const [camera, setCamera] = useState("Camera #1");
  const [selectMultipleDates, setSelectMultipleDates] = useState(false);
  const [footageDateStart, setFootageDateStart] = useState("");
  const [footageDateEnd, setFootageDateEnd] = useState("");
  const [timeRangeStart, setTimeRangeStart] = useState("09:00");
  const [timeRangeEnd, setTimeRangeEnd] = useState("10:00");
  const [description, setDescription] = useState("");

  // 04 Incident Details (Optional)
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [namesInvolved, setNamesInvolved] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");

  // Track search state
  const [searchQuery, setSearchQuery] = useState("");
  const [trackResult, setTrackResult] = useState<FootageRequest | null>(null);
  const [searched, setSearched] = useState(false);

  // On-Demand request modal state
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [modalOrg, setModalOrg] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalSuccess, setModalSuccess] = useState(false);

  // Public On-Demand Stats State (ledgers count checking)
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [isLoadingLedgers, setIsLoadingLedgers] = useState(false);

  // Load draft from localStorage to prevent data clearing on refresh
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("stap_footage_request_draft");
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        setFullName(draft.fullName || "");
        setOrganization(draft.organization || "");
        setContact(draft.contact || "");
        setAddress(draft.address || "");
        setEmail(draft.email || "");
        setNature(draft.nature || "Academic");
        setCamera(draft.camera || "Camera #1");
        setSelectMultipleDates(!!draft.selectMultipleDates);
        setFootageDateStart(draft.footageDateStart || "");
        setFootageDateEnd(draft.footageDateEnd || "");
        setTimeRangeStart(draft.timeRangeStart || "09:00");
        setTimeRangeEnd(draft.timeRangeEnd || "10:00");
        setDescription(draft.description || "");
        setIncidentDate(draft.incidentDate || "");
        setIncidentTime(draft.incidentTime || "");
        setNamesInvolved(draft.namesInvolved || "");
        setIncidentDescription(draft.incidentDescription || "");
      }
    } catch (e) {
      console.warn("Could not load footage request draft:", e);
    }
  }, []);

  // Save draft on every state change
  useEffect(() => {
    const draft = {
      fullName, organization, contact, address, email,
      nature, camera, selectMultipleDates, footageDateStart, footageDateEnd,
      timeRangeStart, timeRangeEnd, description,
      incidentDate, incidentTime, namesInvolved, incidentDescription
    };
    localStorage.setItem("stap_footage_request_draft", JSON.stringify(draft));
  }, [
    fullName, organization, contact, address, email,
    nature, camera, selectMultipleDates, footageDateStart, footageDateEnd,
    timeRangeStart, timeRangeEnd, description,
    incidentDate, incidentTime, namesInvolved, incidentDescription
  ]);

  const clearDraft = () => {
    localStorage.removeItem("stap_footage_request_draft");
    setFullName("");
    setOrganization("");
    setContact("");
    setAddress("");
    setEmail("");
    setNature("Academic");
    setCamera("Camera #1");
    setSelectMultipleDates(false);
    setFootageDateStart("");
    setFootageDateEnd("");
    setTimeRangeStart("09:00");
    setTimeRangeEnd("10:00");
    setDescription("");
    setIncidentDate("");
    setIncidentTime("");
    setNamesInvolved("");
    setIncidentDescription("");
  };

  const fetchLedgers = async () => {
    setIsLoadingLedgers(true);
    try {
      const res = await fetch("/api/v1/ledgers");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const filtered = data.ledgers.filter((l: any) => new Date(l.uploadedAt) >= sevenDaysAgo);
          setLedgers(filtered);
        }
      }
    } catch (err) {
      console.error("Failed to fetch public ledgers:", err);
    } finally {
      setIsLoadingLedgers(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, []);

  // Reusable confirmation email sender helper
  const sendConfirmationEmail = async (
    targetEmail: string, 
    name: string, 
    requestType: string, 
    requestDetailsHtml: string
  ) => {
    try {
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 28px; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px;">
            <div style="display: inline-block; padding: 10px; background-color: #f1f5f9; border-radius: 12px; margin-bottom: 12px;">
              <span style="font-size: 24px;">🚦</span>
            </div>
            <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">STAP Hub System</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Smart Traffic Automation Program</p>
          </div>
          
          <div style="margin-bottom: 28px;">
            <h3 style="color: #0f172a; font-size: 16px; font-weight: 800; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.02em;">Request Lodged Successfully</h3>
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
              Hello <strong>${name}</strong>,
            </p>
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
              This is an official verification that your request for <strong>${requestType}</strong> has been securely logged by the STAP Hub Traffic Management Authority.
            </p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #475569; font-size: 11px; font-weight: 800; text-transform: uppercase; margin: 0 0 12px 0; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Request Properties</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                ${requestDetailsHtml}
              </table>
            </div>
            
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
              Your petition is now categorized under <span style="background-color: #fef3c7; color: #d97706; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em;">Pending Approval</span>. STAP administration will evaluate the legal merit, private-property parameters, and municipal authority limits before dispatching certified files.
            </p>
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
              The standard assessment timeline is <strong>3 to 5 business days</strong>. Once the petition is authorized, the system will trigger a secure delivery dispatch directly to your registered email address.
            </p>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
            <p style="margin: 0 0 6px 0; font-weight: 600;">This is an automated system confirmation. Replies to this mailbox are unmonitored.</p>
            <p style="margin: 0;">&copy; 2026 STAP Hub • Marikina City Traffic Operations Division. All rights reserved.</p>
          </div>
        </div>
      `;

      await fetch("/api/gmail/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetEmail,
          subject: `STAP Hub Confirmation: ${requestType} Received`,
          body: htmlBody
        })
      });
    } catch (err) {
      console.error("Failed to send email confirmation:", err);
    }
  };

  // Footage Request Submission
  const handleFootageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !contact || !address || !description || !footageDateStart) {
      alert("Please fill in all required fields.");
      return;
    }

    const generatedId = String(Math.floor(Math.random() * 90) + 15);
    const dateStr = selectMultipleDates && footageDateEnd 
      ? `${footageDateStart} → ${footageDateEnd}`
      : footageDateStart;
    const timeStr = `${timeRangeStart}:00 - ${timeRangeEnd}:00`;

    // Concatenate Incident Details into Description for backward compatibility & easy admin view
    let finalDescription = description;
    if (incidentDate || incidentTime || namesInvolved || incidentDescription) {
      finalDescription = `${description}\n\n[INCIDENT DETAILS]\nDate: ${incidentDate || "—"}\nTime: ${incidentTime || "—"}\nNames Involved: ${namesInvolved || "—"}\nDescription: ${incidentDescription || "—"}`;
    }

    const payload = {
      requesterName: fullName,
      email,
      organization: organization || "Personal / Individual",
      contact,
      address,
      nature,
      camera,
      footageDate: dateStr,
      timeRange: timeStr,
      description: finalDescription,
      // Pass raw incident fields structurally to be preserved in Firestore document
      incidentDate,
      incidentTime,
      namesInvolved,
      incidentDescription
    };

    onSubmitRequest(payload);

    // Send confirmation email
    const emailDetails = `
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 140px;">Request ID:</td>
        <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">#${generatedId} (Draft Ref)</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Requester:</td>
        <td style="padding: 8px 0; color: #0f172a;">${fullName} (${email})</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Camera Unit:</td>
        <td style="padding: 8px 0; color: #0f172a;">${camera}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Target Date(s):</td>
        <td style="padding: 8px 0; color: #0f172a;">${dateStr}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Time Frame:</td>
        <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${timeStr}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Purpose:</td>
        <td style="padding: 8px 0; color: #334155;">${description}</td>
      </tr>
    `;
    await sendConfirmationEmail(email, fullName, "CCTV Footage Request", emailDetails);

    setSuccessId(generatedId);
    clearDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Certified Report Request Submission
  const handleCertifiedReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !footageDateStart) {
      alert("Please provide all required details.");
      return;
    }

    const startDate = footageDateStart;
    const endDate = footageDateEnd || footageDateStart;

    onSubmitReportRequest({
      type: "Certified Traffic Log",
      requestedRange: { startDate, endDate },
      requesterInfo: {
        name: fullName,
        email,
        organization: organization || "Personal / Individual",
        contact: contact || "—",
        address: address || "—"
      }
    });

    // Send confirmation email
    const emailDetails = `
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 140px;">Report Type:</td>
        <td style="padding: 8px 0; color: #0f172a; font-weight: 700; text-transform: uppercase; font-size: 11px;">Official Certified Traffic Log</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Target Range:</td>
        <td style="padding: 8px 0; color: #0f172a;">${startDate} to ${endDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Requester:</td>
        <td style="padding: 8px 0; color: #0f172a;">${fullName} (${email})</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Institution:</td>
        <td style="padding: 8px 0; color: #0f172a;">${organization || "Personal / Individual"}</td>
      </tr>
    `;
    await sendConfirmationEmail(email, fullName, "Certified Traffic Log Report", emailDetails);

    setReportSuccess(true);
    setFullName("");
    setEmail("");
    setFootageDateStart("");
    setFootageDateEnd("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit On-Demand Summary Request Modal Form
  const handleOnDemandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName || !modalEmail) {
      alert("Name and Email are required.");
      return;
    }

    setModalSubmitting(true);
    try {
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);

      const startDateStr = sevenDaysAgo.toISOString().split('T')[0];
      const endDateStr = today.toISOString().split('T')[0];

      // Save to report_requests Firestore collection
      await onSubmitReportRequest({
        type: `On-Demand: ${selectedSummary}`,
        requestedRange: { startDate: startDateStr, endDate: endDateStr },
        requesterInfo: {
          name: modalName,
          email: modalEmail,
          organization: modalOrg || "Individual / Citizen",
          contact: "—",
          address: "—"
        }
      });

      // Send confirmation email
      const emailDetails = `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 140px;">Report Type:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 700; text-transform: uppercase; font-size: 11px;">${selectedSummary} (On-Demand Summary)</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Reference Scope:</td>
          <td style="padding: 8px 0; color: #0f172a;">Last 7 Days (Auto Rolled)</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Requester:</td>
          <td style="padding: 8px 0; color: #0f172a;">${modalName} (${modalEmail})</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Affiliation:</td>
          <td style="padding: 8px 0; color: #0f172a;">${modalOrg || "None (Citizen)"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Intended Purpose:</td>
          <td style="padding: 8px 0; color: #334155; font-style: italic;">"${modalMessage || "No message provided."}"</td>
        </tr>
      `;
      await sendConfirmationEmail(modalEmail, modalName, `${selectedSummary} On-Demand Request`, emailDetails);

      setModalSuccess(true);
      setTimeout(() => {
        setSelectedSummary(null);
        setModalSuccess(false);
        setModalName("");
        setModalEmail("");
        setModalOrg("");
        setModalMessage("");
      }, 3000);
    } catch (err) {
      console.error("Failed to submit on-demand request:", err);
      alert("Submission failed. Please try again.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      setTrackResult(null);
      return;
    }

    const found = requests.find(
      (r) => r.id === trimmed || r.id === trimmed.replace("#", "") || r.email.toLowerCase() === trimmed
    );
    setTrackResult(found || null);
  };

  // Styled options lists to match Screenshot 2
  const natureOptions = ["Academic", "Personal", "Legal", "Media", "Other"];
  const cameraOptions = [
    { value: "Camera #1", label: "Mayor Gil Fernando Ave — Northbound" },
    { value: "Camera #2", label: "Mayor Gil Fernando Ave — Southbound" },
    { value: "Camera #3", label: "Sumulong Highway — Eastbound" },
    { value: "Camera #4", label: "Sumulong Highway — Westbound" },
    { value: "All", label: "All" }
  ];

  return (
    <div className="space-y-6" id="public-data-request">
      {/* Sub Header / Tab Bar */}
      <div className="border-b border-slate-200">
        <div className="flex gap-8">
          <button
            onClick={() => {
              setActiveView("FORM");
              setSuccessId(null);
            }}
            className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all ${
              activeView === "FORM"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            REQUEST FOOTAGE
          </button>
          <button
            onClick={() => {
              setActiveView("TRACK");
              setSuccessId(null);
              setSearched(false);
              setTrackResult(null);
              setSearchQuery("");
              setReportSuccess(false);
            }}
            className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all ${
              activeView === "TRACK"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            TRACK STATUS
          </button>
          <button
            onClick={() => {
              setActiveView("REPORT_FORM");
              setSuccessId(null);
              setReportSuccess(false);
            }}
            className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all ${
              activeView === "REPORT_FORM"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            REQUEST CERTIFIED REPORT
          </button>
        </div>
      </div>

      {activeView === "REPORT_FORM" && (
        <div className="space-y-8 animate-fadeIn">
          {/* Public On-Demand Stats Section - LOCK STYLED, NOT DOWNLOADABLE INSTANTLY */}
          <div className="bg-[#1E293B] rounded-3xl p-6 shadow-xl border border-slate-800 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-rose-500/20 rounded-lg text-rose-400">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">On-Demand Traffic Summaries</h3>
                </div>
                <p className="text-xs text-slate-400 font-medium">Download instant, non-certified traffic statistics for the current week.</p>
              </div>
              <button 
                onClick={fetchLedgers}
                disabled={isLoadingLedgers}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase transition-all"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLedgers ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Daily Summary", icon: BarChart2, color: "text-indigo-400", bg: "bg-indigo-400/10" },
                { label: "Vehicle Breakdown", icon: Car, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                { label: "Range Comparison", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-400/10" },
                { label: "Incident Summary", icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-400/10" }
              ].map((report) => (
                <button
                  key={report.label}
                  onClick={() => setSelectedSummary(report.label)}
                  className="bg-slate-800/40 hover:bg-slate-800 border border-slate-700/80 p-4 rounded-2xl flex flex-col items-center gap-3 transition-all group active:scale-95 text-center relative overflow-hidden"
                >
                  <div className={`p-3 ${report.bg} ${report.color} rounded-xl group-hover:scale-110 transition-all`}>
                    <report.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">{report.label}</span>
                  
                  {/* Lock Indicator instead of raw download icon */}
                  <div className="flex items-center gap-1 mt-auto text-slate-500 group-hover:text-amber-400 transition-all">
                    <Lock className="h-3 w-3" />
                    <span className="text-[8px] font-bold uppercase tracking-wider">Request Access</span>
                  </div>
                </button>
              ))}
            </div>
            {ledgers.length === 0 && !isLoadingLedgers && (
              <p className="text-center text-[10px] text-slate-500 font-bold italic">No traffic data recorded in the last 7 days.</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            <div className="lg:col-span-2 space-y-6">
              {reportSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-start gap-4 shadow-sm">
                  <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-emerald-800">Certification Request Submitted!</h4>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Your petition for a <strong>Certified Traffic Log</strong> has been received. Our operations team will verify the traffic ledger data for your requested period and dispatch a confirmation email.
                    </p>
                    <button
                      onClick={() => setReportSuccess(false)}
                      className="text-xs font-bold text-emerald-800 underline hover:text-emerald-900 pt-1"
                    >
                      File another request
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 uppercase tracking-tight">Petition for Certified Traffic Records</h3>
                    <p className="text-xs text-slate-500 font-medium">Official request for stamped and signed traffic analytics ledgers</p>
                  </div>
                </div>

                <form onSubmit={handleCertifiedReportSubmit} className="space-y-5">
                  <div className="space-y-4">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block border-b border-slate-100 pb-1">
                      APPLICANT & DATA RANGE
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">FULL NAME *</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">EMAIL ADDRESS *</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">START DATE *</label>
                        <input
                          type="date"
                          required
                          value={footageDateStart}
                          onChange={(e) => setFootageDateStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">END DATE *</label>
                        <input
                          type="date"
                          required
                          value={footageDateEnd}
                          onChange={(e) => setFootageDateEnd(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                      <span>Request Official Certification</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-rose-400">What is a Certified Log?</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  A Certified Traffic Log is a legally-defensible document generated by STAP Hub and digitally signed by an on-duty Traffic Operations Officer. It includes:
                </p>
                <ul className="text-[10px] space-y-2 text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Verified session-by-session volume data</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Officer Certification Metadata & Ref No.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Official STAP Hub Departmental Stamp</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === "FORM" && (
        <div className="space-y-6">
          {/* Main Title & Description Section exactly as Mockup */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Footage / Data Request</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Request CCTV footage from <strong className="text-slate-700">Mayor Gil Fernando Avenue / Sumulong Highway</strong>. Fill in the form below and our team will review your request and contact you via email.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                JUNE 29, 2026
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form Area matching screen structure */}
            <div className="lg:col-span-3 space-y-6">
              {successId && (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-start gap-4 shadow-sm animate-fadeIn">
                  <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-emerald-800">CCTV Footage Request Submitted Successfully!</h4>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Your request has been securely queued and persisted in the STAP database. Your tracking reference email has been dispatched.
                    </p>
                    <button
                      onClick={() => setSuccessId(null)}
                      className="text-xs font-bold text-emerald-800 underline hover:text-emerald-900 pt-1"
                    >
                      Dismiss notification & file another request
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleFootageSubmit} className="space-y-6">
                {/* 01 Requester Information */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#0F172A] text-white rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      01
                    </div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Requester Information</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Juan dela Cruz"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Organization / Institution</label>
                      <input
                        type="text"
                        placeholder="e.g. University of the Philippines"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Contact Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 09171234567"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Address</label>
                      <input
                        type="text"
                        required
                        placeholder="Street, City, Province"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* 02 Nature & Purpose of Request */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#0F172A] text-white rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      02
                    </div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Nature & Purpose of Request</h3>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Request Nature *</label>
                    <div className="flex flex-wrap gap-2.5">
                      {natureOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setNature(opt)}
                          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            nature === opt
                              ? "bg-[#0F172A] text-white border border-[#0F172A] shadow-sm scale-102"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 03 Footage Details */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#0F172A] text-white rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      03
                    </div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Footage Details</h3>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Camera / Direction *</label>
                    <div className="flex flex-wrap gap-2.5">
                      {cameraOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCamera(opt.value)}
                          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            camera === opt.value
                              ? "bg-[#0F172A] text-white border border-[#0F172A] shadow-sm scale-102"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="multiple-dates"
                        checked={selectMultipleDates}
                        onChange={(e) => setSelectMultipleDates(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-[#0F172A]"
                      />
                      <label htmlFor="multiple-dates" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                        Select Multiple Dates
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          {selectMultipleDates ? "Start Date *" : "Date of Footage *"}
                        </label>
                        <input
                          type="date"
                          required
                          value={footageDateStart}
                          onChange={(e) => setFootageDateStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                        />
                      </div>

                      {selectMultipleDates && (
                        <div className="space-y-1.5 animate-fadeIn">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">End Date *</label>
                          <input
                            type="date"
                            required
                            value={footageDateEnd}
                            onChange={(e) => setFootageDateEnd(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Time From *</label>
                        <input
                          type="time"
                          required
                          value={timeRangeStart}
                          onChange={(e) => setTimeRangeStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Time To *</label>
                        <input
                          type="time"
                          required
                          value={timeRangeEnd}
                          onChange={(e) => setTimeRangeEnd(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Description & Specific Purpose of Request *
                      </label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Provide details about the requested segment, e.g. lane specific, reason for request."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white min-h-[100px] leading-relaxed transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* 04 Incident Details (Optional) - Gold left-border style with OPTIONAL badge */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 border-l-4 border-l-amber-500 shadow-sm space-y-6 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-amber-500 text-white rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0">
                        04
                      </div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Incident Details</h3>
                    </div>
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[9px] font-black uppercase tracking-wider">
                      Optional
                    </span>
                  </div>

                  {/* Warning Bar */}
                  <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl text-xs font-medium text-amber-800 leading-relaxed">
                    Fill this section only if your request is related to a specific incident.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Incident Date</label>
                      <input
                        type="date"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Incident Time</label>
                      <input
                        type="time"
                        value={incidentTime}
                        onChange={(e) => setIncidentTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Names Involved</label>
                    <input
                      type="text"
                      placeholder="e.g. Pedro Manalo, driver of white Toyota"
                      value={namesInvolved}
                      onChange={(e) => setNamesInvolved(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Incident Description</label>
                    <textarea
                      rows={3}
                      placeholder="Briefly describe what happened..."
                      value={incidentDescription}
                      onChange={(e) => setIncidentDescription(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white min-h-[80px] leading-relaxed transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Footer Submission Action Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-[#1E293B] hover:bg-[#0F172A] text-white font-extrabold text-xs uppercase tracking-wider px-8 py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2.5 shadow-md cursor-pointer shrink-0"
                  >
                    <Send className="h-4.5 w-4.5" />
                    <span>Submit Request</span>
                  </button>
                  <p className="text-[11px] text-slate-500 font-semibold text-center sm:text-left leading-normal">
                    Our team will review your request and respond to your email within 3–5 business days.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeView === "TRACK" && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-800">Track Footage Request Status</h3>
              <p className="text-xs text-slate-500 font-medium">Query live assessment records using your credentials</p>
            </div>

            <form onSubmit={handleTrackSearch} className="flex gap-2.5">
              <input
                type="text"
                required
                placeholder="Enter Tracking ID (e.g. #14) or Email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-mono"
              />
              <button
                type="submit"
                className="bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </button>
            </form>
          </div>

          {searched && (
            <div className="transition-all animate-fadeIn">
              {trackResult ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-400">REQUEST #{trackResult.id}</span>
                      <h4 className="text-sm font-bold text-slate-800 mt-0.5">{trackResult.requesterName}</h4>
                    </div>
                    <span
                      className={`text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border ${
                        trackResult.status === "PENDING"
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : trackResult.status === "APPROVED" || trackResult.status === "ONGOING"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : "bg-rose-50 text-rose-600 border-rose-200"
                      }`}
                    >
                      {trackResult.status}
                    </span>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="space-y-4">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">
                        TRACKING PROCESS TIMELINE
                      </span>

                      <div className="relative pl-6 space-y-6 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        <div className="relative">
                          <span className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-100 flex items-center justify-center text-[7px] text-white">✓</span>
                          <div className="space-y-0.5 text-left">
                            <span className="text-xs font-bold text-slate-800 block">Footage Request Lodged</span>
                            <span className="text-[10px] text-slate-400 block">Submitted on {trackResult.dateSubmitted} — Queue registered</span>
                          </div>
                        </div>

                        <div className="relative">
                          {trackResult.status === "PENDING" ? (
                            <>
                              <span className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white ring-2 ring-amber-100 animate-pulse" />
                              <div className="space-y-0.5 text-left">
                                <span className="text-xs font-bold text-amber-600 block">Under Official Assessment</span>
                                <span className="text-[10px] text-slate-400 block">Administrator examining incident description and purpose</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-100 flex items-center justify-center text-[7px] text-white">✓</span>
                              <div className="space-y-0.5 text-left">
                                <span className="text-xs font-bold text-slate-800 block">Assessment Concluded</span>
                                <span className="text-[10px] text-slate-400 block">Evaluated by traffic operations specialist</span>
                              </div>
                            </>
                          )}
                        </div>

                        {trackResult.status !== "PENDING" && (
                          <div className="relative">
                            {trackResult.status === "APPROVED" || trackResult.status === "ONGOING" ? (
                              <>
                                <span className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-100 flex items-center justify-center text-[7px] text-white">✓</span>
                                <div className="space-y-0.5 text-left">
                                  <span className="text-xs font-bold text-emerald-600 block">Petition Approved</span>
                                  <span className="text-[10px] text-slate-400 block">
                                    Assigned to operator <strong className="text-slate-600">{trackResult.handledBy}</strong>. Video download links dispatching to email.
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white ring-2 ring-rose-100 flex items-center justify-center text-[7px] text-white">X</span>
                                <div className="space-y-0.5 text-left">
                                  <span className="text-xs font-bold text-rose-600 block">Petition Rejected</span>
                                  <span className="text-[10px] text-slate-400 block">
                                    Insufficient judicial merit / private property boundaries breached. Correspondence sent.
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-xs font-semibold">
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wide">CAMERA DETECTED</span>
                        <span className="text-slate-700 font-bold block mt-0.5">{trackResult.camera}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wide">TARGET RANGE</span>
                        <span className="text-slate-700 font-bold block mt-0.5">{trackResult.timeRange}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2.5">
                  <Clock className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 uppercase">Request Record Not Found</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-normal">
                    Double check the Tracking ID (e.g. #14) or ensure the email matches your official lodging submission form.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* REUSABLE ON-DEMAND ACCESS REQUEST MODAL */}
      {selectedSummary && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-fadeIn" 
            onClick={() => !modalSubmitting && !modalSuccess && setSelectedSummary(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-scaleIn">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Request Weekly Summary</h3>
                  <p className="text-[9px] text-amber-600 font-black uppercase tracking-widest">{selectedSummary}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSummary(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                disabled={modalSubmitting || modalSuccess}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              {modalSuccess ? (
                <div className="text-center py-6 space-y-3 animate-fadeIn">
                  <div className="mx-auto h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 shadow-sm">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-black text-emerald-800 uppercase tracking-tight">Petition Lodged!</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Your request for <strong>{selectedSummary}</strong> is pending operator approval. An official confirmation email was sent.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleOnDemandSubmit} className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100/50 p-3.5 rounded-xl text-[10px] text-amber-800 leading-relaxed font-semibold">
                    🔑 Access to traffic summaries requires validation. Fill in details to request administrator approval.
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">FULL NAME *</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Maria Santos"
                        value={modalName}
                        onChange={(e) => setModalName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">EMAIL ADDRESS *</label>
                      <input 
                        type="email"
                        required
                        placeholder="maria@email.com"
                        value={modalEmail}
                        onChange={(e) => setModalEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">ORGANIZATION (OPTIONAL)</label>
                      <input 
                        type="text"
                        placeholder="e.g. Barangay Highway Division"
                        value={modalOrg}
                        onChange={(e) => setModalOrg(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">REASON FOR ACCESS (OPTIONAL)</label>
                      <textarea 
                        rows={2}
                        placeholder="Add details about intended study or investigation..."
                        value={modalMessage}
                        onChange={(e) => setModalMessage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-medium resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedSummary(null)}
                      disabled={modalSubmitting}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalSubmitting || !modalName || !modalEmail}
                      className="flex-1 py-3 bg-[#1E293B] hover:bg-[#0F172A] text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {modalSubmitting ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>{modalSubmitting ? "Submitting..." : "Submit Request"}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
