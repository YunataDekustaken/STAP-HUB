import React, { useState, useEffect } from "react";
import { Mail, Send, Inbox, FileCode, CheckCircle2, Search, Trash2, Calendar, Clock, ArrowRight, User, Loader2, Sparkles, ChevronRight, CornerUpLeft, X } from "lucide-react";
import { getFirebaseInstances } from "../firebase";
import { collection, doc, setDoc, getDoc, onSnapshot, addDoc, deleteDoc } from "firebase/firestore";

export interface EmailTemplate {
  id: "APPROVED" | "REJECTED" | "UNDER_REVIEW";
  name: string;
  subject: string;
  body: string;
}

export interface SentEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  requestId?: string;
  statusType?: string;
}

export interface ReceivedEmail {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  dateReceived: string;
  status: "UNREAD" | "REPLIED" | "ARCHIVED";
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "APPROVED",
    name: "Approved Footage Request Template",
    subject: "STAP CCTV Footage Request #{id} - APPROVED",
    body: `Dear {name},<br/><br/>We are pleased to inform you that your request for CCTV footage on <strong>{date}</strong> has been <strong>APPROVED</strong>.<br/><br/><strong>Request Summary:</strong><br/>- Reference ID: {id}<br/>- Camera Location: {camera}<br/>- Time Range: {timeRange}<br/>- Date of Interest: {date}<br/><br/>The requested footage files have been prepared and are accessible via the following secure download link:<br/><br/><a href="{footageLink}" style="display: inline-block; background-color: #22c55e; color: white; padding: 10px 20px; font-weight: bold; border-radius: 8px; text-decoration: none;" target="_blank">Download Video Footage CCTV File</a><br/><br/>Please note this link will expire in 7 days for security reasons. If you have any further questions, reply to this email.<br/><br/>Sincerely,<br/><strong>STAP Traffic Automation Program Operations Team</strong>`
  },
  {
    id: "REJECTED",
    name: "Rejected Footage Request Template",
    subject: "STAP CCTV Footage Request #{id} - REJECTED",
    body: `Dear {name},<br/><br/>We regret to inform you that your request for CCTV footage on <strong>{date}</strong> has been <strong>REJECTED</strong>.<br/><br/><strong>Request Summary:</strong><br/>- Reference ID: {id}<br/>- Camera Location: {camera}<br/>- Date of Interest: {date}<br/><br/><strong>Reason for Rejection:</strong><br/>The request does not comply with our CCTV security and privacy policies (e.g., lack of official court subpoena, incomplete details, or privacy protection of other vehicles/individuals).<br/><br/>You may submit a new request with proper legal documentation if needed.<br/><br/>Sincerely,<br/><strong>STAP Traffic Automation Program Operations Team</strong>`
  },
  {
    id: "UNDER_REVIEW",
    name: "Under Review Footage Request Template",
    subject: "STAP CCTV Footage Request #{id} - UNDER REVIEW",
    body: `Dear {name},<br/><br/>Your request for CCTV footage has been received and is currently <strong>UNDER REVIEW</strong>.<br/><br/><strong>Request Summary:</strong><br/>- Reference ID: {id}<br/>- Camera Location: {camera}<br/>- Date of Interest: {date}<br/>- Current Status: Pending Verification<br/><br/>Our engineering and administrative teams are checking the active disk array logs and confirming that the video archive for the requested date and time is intact. We will follow up with you within 24–48 hours once review is complete.<br/><br/>Sincerely,<br/><strong>STAP Traffic Automation Program Operations Team</strong>`
  }
];

const INITIAL_RECEIVED_EMAILS: ReceivedEmail[] = [
  {
    id: "rcv_1",
    fromName: "Engr. Leo Salvador",
    fromEmail: "leosalvador@pup.edu.ph",
    subject: "Inquiry on CCTV footage storage duration",
    body: "Greetings STAP Admin,<br/><br/>I am writing to inquire about the retention policy of the CCTV cameras located at the North and East lanes. Our student research group is conducting a study on vehicle density and we would like to know if footage from May 2026 is still available in your active disk array, or if it has been rotated out. Thank you!",
    dateReceived: "2026-06-28T09:30:00Z",
    status: "UNREAD"
  },
  {
    id: "rcv_2",
    fromName: "Atty. Clara Santos",
    fromEmail: "clara.santos@lawfirm.com",
    subject: "Subpoena duces tecum - Incident on June 18, 2026",
    body: "Dear Custodian of Records,<br/><br/>Please find attached the official subpoena for the CCTV footage of the collision that occurred at the West lane intersection on June 18, 2026, between 09:00:00 and 10:00:00. This is in connection with active insurance case #INC-2026-9812. Please let us know once the certified logs are ready.<br/><br/>Best regards,<br/>Atty. Clara Santos",
    dateReceived: "2026-06-27T14:15:00Z",
    status: "UNREAD"
  },
  {
    id: "rcv_3",
    fromName: "Marc De Guzman",
    fromEmail: "marcguzman91@gmail.com",
    subject: "Lost personal item near South Lane camera",
    body: "Hello, I lost my brown backpack near the South lane traffic pole yesterday afternoon around 3:00 PM. I believe it was left near the pedestrian crossing. Is it possible to check the CCTV stream to see if someone picked it up? Any help would be highly appreciated. Thank you.",
    dateReceived: "2026-06-26T11:05:00Z",
    status: "REPLIED"
  }
];

// Load templates with Firestore/localStorage fallback
export function getStoredTemplates(): EmailTemplate[] {
  try {
    const saved = localStorage.getItem("stap_email_templates");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading templates from localStorage:", e);
  }
  return DEFAULT_TEMPLATES;
}

export default function EmailsTab() {
  const [subTab, setSubTab] = useState<"SENT" | "RECEIVED" | "TEMPLATES">("SENT");
  const [templates, setTemplates] = useState<EmailTemplate[]>(getStoredTemplates());
  const [activeTemplateId, setActiveTemplateId] = useState<"APPROVED" | "REJECTED" | "UNDER_REVIEW">("APPROVED");
  const [sentMails, setSentMails] = useState<SentEmail[]>([]);
  const [receivedMails, setReceivedMails] = useState<ReceivedEmail[]>([]);
  const [selectedSent, setSelectedSent] = useState<SentEmail | null>(null);
  const [selectedReceived, setSelectedReceived] = useState<ReceivedEmail | null>(null);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Reply Composer modal
  const [replyTarget, setReplyTarget] = useState<ReceivedEmail | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");

  const fetchLiveInbox = async () => {
    setIsFetchingLive(true);
    setLiveError(null);
    try {
      const response = await fetch("/api/gmail/messages");
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch live inbox");
      }

      if (data.success && data.messages) {
        const mappedMails: ReceivedEmail[] = data.messages.map((m: any) => ({
          id: m.id,
          fromName: m.from.split("<")[0].trim().replace(/^"|"$/g, '') || "Unknown",
          fromEmail: m.from.match(/<(.+)>/)?.[1] || m.from,
          subject: m.subject,
          dateReceived: m.timestamp,
          body: m.body || m.snippet,
          status: "UNREAD"
        }));
        setReceivedMails(mappedMails);
      }
    } catch (err: any) {
      console.warn("Gmail API Fetch error:", err);
      setLiveError("Connect to Google in Settings to view live inbox.");
    } finally {
      setIsFetchingLive(false);
    }
  };

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) || templates[0];

  // Sync templates and sent/received mails from Firestore (or mock)
  useEffect(() => {
    // Initial fetch of live data
    fetchLiveInbox();

    const { db } = getFirebaseInstances();
    
    // Sync templates
    let unsubTemplates = () => {};
    if (db) {
      unsubTemplates = onSnapshot(doc(db, "settings", "email_templates"), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const loaded: EmailTemplate[] = [
            {
              id: "APPROVED",
              name: "Approved Footage Request Template",
              subject: data.approved?.subject || DEFAULT_TEMPLATES[0].subject,
              body: data.approved?.body || DEFAULT_TEMPLATES[0].body
            },
            {
              id: "REJECTED",
              name: "Rejected Footage Request Template",
              subject: data.rejected?.subject || DEFAULT_TEMPLATES[1].subject,
              body: data.rejected?.body || DEFAULT_TEMPLATES[1].body
            },
            {
              id: "UNDER_REVIEW",
              name: "Under Review Footage Request Template",
              subject: data.underReview?.subject || DEFAULT_TEMPLATES[2].subject,
              body: data.underReview?.body || DEFAULT_TEMPLATES[2].body
            }
          ];
          setTemplates(loaded);
          localStorage.setItem("stap_email_templates", JSON.stringify(loaded));
        }
      });
    }

    // Sync sent emails
    let unsubSent = () => {};
    if (db) {
      unsubSent = onSnapshot(collection(db, "sent_emails"), (snap) => {
        const mails = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SentEmail));
        mails.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
        setSentMails(mails);
      }, () => {
        // Fallback local storage
        const savedSent = localStorage.getItem("stap_sent_emails");
        if (savedSent) setSentMails(JSON.parse(savedSent));
      });
    } else {
      const savedSent = localStorage.getItem("stap_sent_emails");
      if (savedSent) setSentMails(JSON.parse(savedSent));
    }

    // Sync received emails - Modified to support live refresh
    let unsubReceived = () => {};
    if (db) {
      unsubReceived = onSnapshot(collection(db, "received_emails"), (snap) => {
        if (!snap.empty && !isFetchingLive) { // Only use firestore if we aren't live fetching
          const mails = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReceivedEmail));
          mails.sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
          setReceivedMails(mails);
        }
      });
    }

    return () => {
      unsubTemplates();
      unsubSent();
      unsubReceived();
    };
  }, []);

  // Update a single template text locally/globally
  const handleUpdateTemplateField = (field: "subject" | "body", value: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === activeTemplateId ? { ...t, [field]: value } : t))
    );
  };

  // Save templates to Firestore / localStorage
  const handleSaveTemplates = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const { db } = getFirebaseInstances();
    const updatedPayload = {
      approved: {
        subject: templates.find((t) => t.id === "APPROVED")?.subject || "",
        body: templates.find((t) => t.id === "APPROVED")?.body || ""
      },
      rejected: {
        subject: templates.find((t) => t.id === "REJECTED")?.subject || "",
        body: templates.find((t) => t.id === "REJECTED")?.body || ""
      },
      underReview: {
        subject: templates.find((t) => t.id === "UNDER_REVIEW")?.subject || "",
        body: templates.find((t) => t.id === "UNDER_REVIEW")?.body || ""
      }
    };

    try {
      localStorage.setItem("stap_email_templates", JSON.stringify(templates));
      if (db) {
        await setDoc(doc(db, "settings", "email_templates"), updatedPayload, { merge: true });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to save templates:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Reply to an Inquiry
  const handleOpenReply = (email: ReceivedEmail) => {
    setReplyTarget(email);
    setReplySubject(`Re: ${email.subject}`);
    setReplyBody(`Dear ${email.fromName},<br/><br/>Thank you for reaching out to STAP Support.<br/><br/>[Write your response here]<br/><br/>Sincerely,<br/>STAP Operations Team`);
    setReplyMessage("");
  };

  const handleSendReply = async () => {
    if (!replyTarget) return;
    setIsSendingReply(true);
    setReplyMessage("");

    try {
      // 1. Call standard reply api endpoint
      const response = await fetch("/api/footage-requests/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: replyTarget.fromEmail,
          subject: replySubject,
          body: replyBody
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to send email");
      }

      // 2. Save reply to Sent Emails in Firestore
      const { db } = getFirebaseInstances();
      const newSentEmail: Omit<SentEmail, "id"> = {
        to: replyTarget.fromEmail,
        subject: replySubject,
        body: replyBody,
        sentAt: new Date().toISOString(),
        statusType: "REPLY_INQUIRY"
      };

      if (db) {
        await addDoc(collection(db, "sent_emails"), newSentEmail);
        
        // Update Received Inquiry state to REPLIED
        await setDoc(doc(db, "received_emails", replyTarget.id), { status: "REPLIED" }, { merge: true });
      } else {
        const locallySent = [...sentMails, { id: "sent_" + Date.now(), ...newSentEmail }];
        setSentMails(locallySent);
        localStorage.setItem("stap_sent_emails", JSON.stringify(locallySent));

        const updatedRecv = receivedMails.map(m => m.id === replyTarget.id ? { ...m, status: "REPLIED" as const } : m);
        setReceivedMails(updatedRecv);
        localStorage.setItem("stap_received_emails", JSON.stringify(updatedRecv));
      }

      setReplyMessage("Email sent successfully! Your response is stored in Sent Mail.");
      setTimeout(() => {
        setReplyTarget(null);
      }, 2000);
    } catch (e: any) {
      setReplyMessage(`Error: ${e.message}. (We saved the reply locally)`);
      // Fail gracefully: save locally if offline
      const { db } = getFirebaseInstances();
      if (!db) {
        const newSentEmail: SentEmail = {
          id: "sent_" + Date.now(),
          to: replyTarget.fromEmail,
          subject: replySubject,
          body: replyBody,
          sentAt: new Date().toISOString(),
          statusType: "REPLY_INQUIRY"
        };
        const locallySent = [newSentEmail, ...sentMails];
        setSentMails(locallySent);
        localStorage.setItem("stap_sent_emails", JSON.stringify(locallySent));

        const updatedRecv = receivedMails.map(m => m.id === replyTarget.id ? { ...m, status: "REPLIED" as const } : m);
        setReceivedMails(updatedRecv);
        localStorage.setItem("stap_received_emails", JSON.stringify(updatedRecv));
      }
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleDeleteSentMail = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { db } = getFirebaseInstances();
    if (db) {
      await deleteDoc(doc(db, "sent_emails", id));
    } else {
      const filtered = sentMails.filter((m) => m.id !== id);
      setSentMails(filtered);
      localStorage.setItem("stap_sent_emails", JSON.stringify(filtered));
    }
    if (selectedSent?.id === id) setSelectedSent(null);
  };

  const handleInsertPlaceholder = (token: string) => {
    handleUpdateTemplateField("body", activeTemplate.body + ` ${token} `);
  };

  // Filter lists based on search
  const filteredSent = sentMails.filter(
    (m) =>
      m.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.requestId && m.requestId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredReceived = receivedMails.filter(
    (m) =>
      m.fromName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="emails-tab-view">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/20 rounded-lg">
                <Mail className="h-5 w-5 text-blue-400" />
              </span>
              <h2 className="text-xl font-bold tracking-tight">System Mailroom & Correspondence</h2>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Configure CCTV approval templates, reply to citizen requests, and audit sent status reports.
            </p>
          </div>
          <div className="flex bg-slate-800/80 backdrop-blur p-1 rounded-xl gap-1 border border-slate-700/50 self-stretch md:self-auto">
            <button
              onClick={() => setSubTab("SENT")}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                subTab === "SENT" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Sent Logs</span>
            </button>
            <button
              onClick={() => setSubTab("RECEIVED")}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all relative ${
                subTab === "RECEIVED" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Inquiries</span>
              {receivedMails.filter((m) => m.status === "UNREAD").length > 0 && (
                <span className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                  {receivedMails.filter((m) => m.status === "UNREAD").length}
                </span>
              )}
            </button>
            {subTab === "RECEIVED" && (
              <button
                onClick={fetchLiveInbox}
                disabled={isFetchingLive}
                className="px-2 text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50"
                title="Fetch Live Gmail Inbox"
              >
                <Loader2 className={`h-3.5 w-3.5 ${isFetchingLive ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              onClick={() => setSubTab("TEMPLATES")}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                subTab === "TEMPLATES" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>Templates</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main split dashboard depending on subTab */}
      {subTab === "TEMPLATES" ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Templates vertical navigation selector */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Select Trigger Template</h3>
            <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
              {templates.map((t) => {
                const isActive = t.id === activeTemplateId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTemplateId(t.id)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                      isActive 
                        ? "bg-slate-900 text-white shadow-sm font-bold" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs truncate">{t.name}</p>
                      <p className={`text-[9px] uppercase tracking-tighter mt-0.5 ${isActive ? "text-blue-400" : "text-slate-400"}`}>
                        {t.id} Trigger
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isActive ? "text-blue-400" : "text-slate-300 group-hover:translate-x-0.5"}`} />
                  </button>
                );
              })}
            </div>

            {/* Quick Helper guidelines on placeholders */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-blue-500" />
                Dynamic Placeholder Tokens
              </h4>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Placeholders are replaced with real footage request fields when sending CCTV updates.
              </p>
              <div className="grid grid-cols-1 gap-1.5 font-mono text-[9px]">
                {[
                  { token: "{id}", desc: "Request Reference UID" },
                  { token: "{name}", desc: "Requester Full Name" },
                  { token: "{camera}", desc: "Selected CCTV lane camera" },
                  { token: "{date}", desc: "CCTV Date Requested" },
                  { token: "{timeRange}", desc: "Start/End Hour bounds" },
                  { token: "{description}", desc: "Citizen incident description" },
                  { token: "{footageLink}", desc: "Cloud link/Google Drive URL" }
                ].map((item) => (
                  <button
                    key={item.token}
                    onClick={() => handleInsertPlaceholder(item.token)}
                    title="Click to insert at cursor"
                    className="flex justify-between items-center p-1.5 bg-white border border-slate-100 rounded text-left hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <span className="text-blue-600 font-bold">{item.token}</span>
                    <span className="text-slate-400 text-right text-[8px]">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Large Template Editor workspace */}
          <div className="lg:col-span-3 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="inline-block px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest bg-blue-50 text-blue-600 rounded-full mb-1">
                  Active Editor
                </span>
                <h3 className="text-sm font-black text-slate-800">{activeTemplate.name}</h3>
              </div>
              <button
                onClick={handleSaveTemplates}
                disabled={isSaving}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span>Save All Templates</span>
              </button>
            </div>

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-xs font-semibold animate-fade-in">
                ✓ Templates saved successfully to database registry! All subsequent notification emails will reflect these edits.
              </div>
            )}

            <div className="space-y-4">
              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Email Subject Line</label>
                <input
                  type="text"
                  value={activeTemplate.subject}
                  onChange={(e) => handleUpdateTemplateField("subject", e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-semibold transition-all"
                  placeholder="Subject Line"
                />
              </div>

              {/* Body Area */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Email Body Editor (HTML & Text)</label>
                <textarea
                  value={activeTemplate.body}
                  onChange={(e) => handleUpdateTemplateField("body", e.target.value)}
                  rows={15}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all leading-relaxed"
                  placeholder="Body content..."
                />
              </div>

              {/* Beautiful interactive output HTML preview box */}
              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Live Rendered HTML Email Preview</label>
                <div className="border border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 max-h-96 overflow-y-auto">
                  <div className="p-4 bg-white rounded-xl shadow-xs border border-slate-100 space-y-3">
                    <div className="text-[10px] text-slate-400 font-medium pb-2 border-b border-slate-100">
                      <div><strong className="text-slate-600">Subject:</strong> {activeTemplate.subject.replace("{id}", "FR-87192")}</div>
                    </div>
                    <div 
                      className="text-xs text-slate-700 leading-relaxed font-sans prose"
                      dangerouslySetInnerHTML={{
                        __html: activeTemplate.body
                          .replace(/{id}/g, "FR-87192")
                          .replace(/{name}/g, "Crissel Zapatero")
                          .replace(/{date}/g, "2026-06-29")
                          .replace(/{camera}/g, "NORTH LANE (Intersection)")
                          .replace(/{timeRange}/g, "09:00:00 - 10:00:00")
                          .replace(/{description}/g, "Academic research sample")
                          .replace(/{footageLink}/g, "https://drive.google.com/drive/folders/stap_sample")
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List panel (Sent or Received) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search filter banner */}
            <div className="flex bg-white p-3 rounded-2xl border border-slate-100 shadow-xs gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={subTab === "SENT" ? "Search sent messages, emails, request ID..." : "Search sender name, email, subject..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>
            </div>

            {/* Content List container */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs max-h-[640px] overflow-y-auto space-y-2.5">
              {subTab === "SENT" ? (
                filteredSent.length > 0 ? (
                  filteredSent.map((mail) => {
                    const isSelected = selectedSent?.id === mail.id;
                    return (
                      <div
                        key={mail.id}
                        onClick={() => setSelectedSent(mail)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? "bg-blue-50/50 border-blue-200 shadow-xs"
                            : "bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="truncate">
                            <span className="inline-block px-2 py-0.5 text-[8px] font-bold bg-slate-100 text-slate-600 rounded mb-1">
                              {mail.statusType || "NOTIFICATION"}
                            </span>
                            <h4 className="text-xs font-black text-slate-800 truncate">{mail.to}</h4>
                            <p className="text-xs text-slate-600 font-semibold truncate mt-0.5">{mail.subject}</p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1 shrink-0">
                            <p className="text-[9px] font-semibold text-slate-400 font-mono">
                              {new Date(mail.sentAt).toLocaleDateString()} {new Date(mail.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <button
                              onClick={(e) => handleDeleteSentMail(mail.id, e)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <Send className="h-8 w-8 mx-auto text-slate-200" />
                    <p className="text-xs font-semibold">No sent emails found matching query.</p>
                  </div>
                )
              ) : filteredReceived.length > 0 ? (
                filteredReceived.map((mail) => {
                  const isSelected = selectedReceived?.id === mail.id;
                  const isUnread = mail.status === "UNREAD";
                  return (
                    <div
                      key={mail.id}
                      onClick={() => setSelectedReceived(mail)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-blue-50/50 border-blue-200 shadow-xs"
                          : isUnread
                          ? "bg-white border-blue-300 shadow-xs"
                          : "bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      {isUnread && (
                        <span className="absolute left-1.5 top-1.5 flex h-2 w-2 rounded-full bg-blue-600" />
                      )}
                      <div className="flex justify-between items-start gap-2">
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-slate-800 truncate">{mail.fromName}</h4>
                            <span className="text-[9px] text-slate-400 font-medium truncate">({mail.fromEmail})</span>
                          </div>
                          <p className="text-xs text-slate-600 font-semibold truncate mt-0.5">{mail.subject}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1 shrink-0">
                          <p className="text-[9px] font-semibold text-slate-400 font-mono">
                            {new Date(mail.dateReceived).toLocaleDateString()}
                          </p>
                          <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${
                            mail.status === "UNREAD" ? "bg-blue-100 text-blue-700" :
                            mail.status === "REPLIED" ? "bg-emerald-100 text-emerald-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {mail.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Inbox className="h-8 w-8 mx-auto text-slate-200" />
                  <p className="text-xs font-semibold">No inquiries found matching query.</p>
                </div>
              )}
            </div>
          </div>

          {/* Detailed side preview panel */}
          <div className="lg:col-span-1">
            {subTab === "SENT" ? (
              selectedSent ? (
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4 h-full flex flex-col">
                  <div className="pb-3 border-b border-slate-100 space-y-1.5">
                    <span className="inline-block px-2 py-0.5 text-[8px] font-black bg-blue-50 text-blue-600 rounded">
                      Sent Message Audit
                    </span>
                    <h3 className="text-xs font-black text-slate-800 break-words">{selectedSent.subject}</h3>
                    <div className="text-[10px] text-slate-500 font-medium space-y-0.5">
                      <p><strong>To:</strong> {selectedSent.to}</p>
                      <p><strong>Sent:</strong> {new Date(selectedSent.sentAt).toLocaleString()}</p>
                      {selectedSent.requestId && <p><strong>Request Ref:</strong> {selectedSent.requestId}</p>}
                    </div>
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-xl p-4 overflow-y-auto text-xs text-slate-700 font-sans leading-relaxed border border-slate-100">
                    <div dangerouslySetInnerHTML={{ __html: selectedSent.body }} className="prose" />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl p-8 text-center text-slate-400 flex flex-col items-center justify-center h-64 space-y-1.5">
                  <Send className="h-6 w-6 text-slate-300" />
                  <p className="text-xs font-bold text-slate-500">No Sent Mail Selected</p>
                  <p className="text-[10px] text-slate-400 leading-snug max-w-xs">
                    Select any sent record from the log panel on the left to review headers and HTML body.
                  </p>
                </div>
              )
            ) : selectedReceived ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4 h-full flex flex-col justify-between">
                <div>
                  <div className="pb-3 border-b border-slate-100 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="inline-block px-2 py-0.5 text-[8px] font-black bg-indigo-50 text-indigo-600 rounded">
                        Incoming Inquiry
                      </span>
                      {selectedReceived.status !== "REPLIED" && (
                        <button
                          onClick={() => handleOpenReply(selectedReceived)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[9px] font-bold rounded flex items-center gap-1 cursor-pointer"
                        >
                          <CornerUpLeft className="h-3 w-3" />
                          <span>Reply</span>
                        </button>
                      )}
                    </div>
                    <h3 className="text-xs font-black text-slate-800 break-words">{selectedReceived.subject}</h3>
                    <div className="text-[10px] text-slate-500 font-medium space-y-0.5">
                      <p><strong>From:</strong> {selectedReceived.fromName}</p>
                      <p><strong>Email:</strong> {selectedReceived.fromEmail}</p>
                      <p><strong>Received:</strong> {new Date(selectedReceived.dateReceived).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-700 font-sans leading-relaxed border border-slate-100 mt-4 max-h-96 overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: selectedReceived.body }} className="prose" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl p-8 text-center text-slate-400 flex flex-col items-center justify-center h-64 space-y-1.5">
                <Inbox className="h-6 w-6 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">No Inquiry Selected</p>
                <p className="text-[10px] text-slate-400 leading-snug max-w-xs">
                  Select any citizen query from the inbox panel to read and draft direct replies.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {replyTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-100 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black">Compose Email Response</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Replying to: {replyTarget.fromName} ({replyTarget.fromEmail})</p>
              </div>
              <button
                onClick={() => setReplyTarget(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {replyMessage && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${replyMessage.startsWith("Error") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
                  {replyMessage}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Subject</label>
                <input
                  type="text"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-semibold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Message Body (HTML enabled)</label>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={8}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all leading-relaxed"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-[#F8FAFC] flex justify-end gap-3">
              <button
                onClick={() => setReplyTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReply}
                disabled={isSendingReply}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-98 cursor-pointer"
              >
                {isSendingReply ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send Reply</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
