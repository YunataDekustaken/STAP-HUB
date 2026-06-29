import React, { useState, useEffect, useMemo } from "react";
import { Check, X, Eye, FileText, Info, Mail, Send, HardDrive, ExternalLink, Loader2, Play, Clock, Calendar, Building, CheckCircle2, AlertTriangle } from "lucide-react";
import { getFirebaseInstances } from "../firebase";
import { collection, query, orderBy, onSnapshot, doc, setDoc } from "firebase/firestore";
import { parseTrafficCSV, ParsedTrafficData } from "../utils/csvParser";
import { generateTrafficReport, ReportMetadata } from "../utils/reportGenerator";

export interface FootageRequest {
  id: string;
  requesterName: string;
  email: string;
  organization: string;
  contact: string;
  address: string;
  nature: string;
  handledBy: string;
  footageDate: string;
  camera: string;
  timeRange: string;
  description: string;
  status: "PENDING" | "ONGOING" | "REJECTED" | "APPROVED";
  dateSubmitted: string;
}

interface FootageRequestsTabProps {
  requests: FootageRequest[];
  onUpdateRequestStatus: (id: string, nextStatus: FootageRequest["status"], handledBy?: string) => void;
}

export default function FootageRequestsTab({ requests, onUpdateRequestStatus }: FootageRequestsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"NEW" | "ONGOING" | "REJECTED">("NEW");
  const [selectedRequest, setSelectedRequest] = useState<FootageRequest | null>(null);
  
  // High-level tab selection (CCTV vs CERTIFIED)
  const [requestCategory, setRequestCategory] = useState<"CCTV" | "CERTIFIED">("CCTV");
  
  // Certified Report Requests states
  const [reportRequests, setReportRequests] = useState<any[]>([]);
  const [selectedReportRequest, setSelectedReportRequest] = useState<any | null>(null);
  const [localLedgers, setLocalLedgers] = useState<any[]>([]);
  const [cloudLedgers, setCloudLedgers] = useState<any[]>([]);
  const [isProcessingReport, setIsProcessingReport] = useState<string | null>(null);
  const [certifiedSubTab, setCertifiedSubTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");

  // Real-time synchronization of Certified Report Requests & Ledgers
  useEffect(() => {
    const { db } = getFirebaseInstances();
    if (!db) return;

    // 1. Sync Report Requests
    const reportQ = query(collection(db, "report_requests"), orderBy("createdAt", "desc"));
    const unsubReport = onSnapshot(reportQ, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setReportRequests(docs);
    });

    // 2. Sync Cloud Ledgers
    const ledgerQ = query(collection(db, "ledgers"), orderBy("uploadedAt", "desc"));
    const unsubLedger = onSnapshot(ledgerQ, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setCloudLedgers(docs);
    });

    // 3. Fetch Local Ledgers
    const fetchLocalLedgers = async () => {
      try {
        const res = await fetch("/api/v1/ledgers");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setLocalLedgers(data.ledgers || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch local ledgers inside requests tab:", err);
      }
    };
    fetchLocalLedgers();

    return () => {
      unsubReport();
      unsubLedger();
    };
  }, []);

  // Merge lists to build unified ledger logs list for parsing data range
  const unifiedLedgers = useMemo(() => {
    const mergedMap = new Map<string, any>();

    cloudLedgers.forEach((c) => {
      mergedMap.set(c.filename, {
        filename: c.filename,
        size: c.size,
        uploadedAt: c.uploadedAt,
        sourceType: c.sourceType,
        source: "cloud",
        csvData: c.csvData
      });
    });

    localLedgers.forEach((l) => {
      if (mergedMap.has(l.filename)) {
        const existing = mergedMap.get(l.filename)!;
        mergedMap.set(l.filename, {
          ...existing,
          source: "synced"
        });
      } else {
        mergedMap.set(l.filename, {
          filename: l.filename,
          size: l.size,
          uploadedAt: l.uploadedAt,
          sourceType: l.sourceType,
          source: "local"
        });
      }
    });

    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }, [localLedgers, cloudLedgers]);

  // Handle Approve Certified Report Request
  const handleApproveReportRequest = async (request: any) => {
    const { db } = getFirebaseInstances();
    if (!db) return;

    setIsProcessingReport(request.id);
    try {
      // 1. Filter and parse ledgers within scope
      const ledgersToReport = unifiedLedgers.filter(l => {
        const uploadedAt = new Date(l.uploadedAt).getTime();
        const start = new Date(request.requestedRange.startDate).getTime();
        const end = new Date(request.requestedRange.endDate).getTime() + (24 * 60 * 60 * 1000);
        return uploadedAt >= start && uploadedAt < end;
      });

      const parsedDataList = ledgersToReport.map(l => {
        if (!l.csvData) return null;
        try { return parseTrafficCSV(l.csvData); } catch (e) { return null; }
      }).filter(Boolean) as ParsedTrafficData[];

      const metadata: ReportMetadata = {
        type: request.type || "Certified Traffic Log",
        dateRange: `${request.requestedRange.startDate} to ${request.requestedRange.endDate}`,
        generatedBy: "STAP Hub Operations",
        certifiedBy: "Inspector Martinez",
        refNumber: `REQ-${request.id.substring(0, 8).toUpperCase()}`
      };

      const reportDoc = generateTrafficReport(parsedDataList, metadata);
      const pdfDataUri = reportDoc.output("datauristring");

      // 2. Update Firestore document with approval details and the Base64 PDF
      await setDoc(doc(db, "report_requests", request.id), {
        ...request,
        status: "APPROVED",
        certifiedBy: "Inspector Martinez",
        certifiedAt: new Date().toISOString(),
        generatedPdfUrl: pdfDataUri
      }, { merge: true });

      // 3. Dispatch an official notification email to the citizen
      try {
        await fetch("/api/gmail/send-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: request.requesterInfo.email,
            subject: `APPROVED & CERTIFIED: ${request.type || "Certified Traffic Log"} #${request.id.substring(0, 8).toUpperCase()}`,
            body: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <div style="text-align: center; margin-bottom: 28px; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px;">
                  <div style="display: inline-block; padding: 10px; background-color: #f1f5f9; border-radius: 12px; margin-bottom: 12px;">
                    <span style="font-size: 24px;">🚦</span>
                  </div>
                  <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">STAP Hub System</h2>
                  <p style="color: #64748b; margin: 4px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Smart Traffic Automation Program</p>
                </div>
                
                <div style="margin-bottom: 28px;">
                  <h3 style="color: #10b981; font-size: 16px; font-weight: 800; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.02em;">Certified Document Ready</h3>
                  <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                    Hello <strong>${request.requesterInfo.name}</strong>,
                  </p>
                  <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                    We are pleased to inform you that your request for a <strong>${request.type || "Certified Traffic Log"}</strong> has been officially approved and stamped by the STAP traffic command.
                  </p>
                  
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <p style="color: #475569; font-size: 11px; font-weight: 800; text-transform: uppercase; margin: 0 0 12px 0; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Certification Details</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">Request ID:</td>
                        <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">#${request.id.substring(0, 8).toUpperCase()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date Range:</td>
                        <td style="padding: 6px 0; color: #0f172a;">${request.requestedRange.startDate} to ${request.requestedRange.endDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Certified By:</td>
                        <td style="padding: 6px 0; color: #0f172a; font-weight: 700; color: #10b981;">Inspector Martinez (STAP Hub Operations)</td>
                      </tr>
                    </table>
                  </div>
                  
                  <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                    An official digitally stamped PDF copy has been attached to this email. You may also view this report and track future requests in the Citizen Portal at any time.
                  </p>
                </div>
                
                <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
                  <p style="margin: 0 0 6px 0; font-weight: 600;">This is an automated system dispatch. Replies to this mailbox are unmonitored.</p>
                  <p style="margin: 0;">&copy; 2026 STAP Hub • Marikina City Traffic Operations Division. All rights reserved.</p>
                </div>
              </div>
            `,
            attachment: pdfDataUri.split(",")[1],
            filename: `${(request.type || "Certified_Traffic_Log").replace(/\s+/g, "_")}_${request.id.substring(0, 8).toUpperCase()}.pdf`
          })
        });
      } catch (emailErr) {
        console.warn("Could not dispatch confirmation email:", emailErr);
      }

      alert("Request approved and certified successfully. Stamped report generated and dispatched to citizen email.");
      setSelectedReportRequest(null);
    } catch (err) {
      console.error("Failed to approve report request:", err);
      alert("Failed to approve request.");
    } finally {
      setIsProcessingReport(null);
    }
  };

  // Handle Reject Certified Report Request
  const handleRejectReportRequest = async (request: any) => {
    const { db } = getFirebaseInstances();
    if (!db) return;

    if (!confirm("Are you sure you want to REJECT this report request?")) return;

    setIsProcessingReport(request.id);
    try {
      await setDoc(doc(db, "report_requests", request.id), {
        status: "REJECTED",
        rejectedAt: new Date().toISOString()
      }, { merge: true });

      // Dispatch rejection notification email to the citizen
      try {
        await fetch("/api/footage-requests/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: request.requesterInfo.email,
            subject: `STAP Hub Notice: ${request.type || "Certified Traffic Log"} Request Rejected`,
            body: `
              <p>Hello ${request.requesterInfo.name},</p>
              <p>Your request for a certified traffic report (Scope: ${request.requestedRange.startDate} to ${request.requestedRange.endDate}) has been <strong>REJECTED</strong> upon formal administrative review.</p>
              <p><strong>Reason:</strong> Scope of target date range is outside localized node records or requested data lacks municipal context.</p>
              <p>If you believe this decision is in error or wish to appeal, please visit the Marikina City Traffic Operations Division office directly.</p>
              <p>Regards,<br>STAP Management Panel</p>
            `
          })
        });
      } catch (emailErr) {
        console.warn("Could not dispatch rejection email:", emailErr);
      }

      alert("Request rejected successfully. Rejection notice sent to citizen email.");
      setSelectedReportRequest(null);
    } catch (err) {
      console.error("Failed to reject request:", err);
      alert("Failed to reject request.");
    } finally {
      setIsProcessingReport(null);
    }
  };

  // Filter report requests based on active tab selection
  const filteredReportRequests = reportRequests.filter((r) => {
    if (certifiedSubTab === "PENDING") return r.status === "PENDING";
    if (certifiedSubTab === "APPROVED") return r.status === "APPROVED";
    if (certifiedSubTab === "REJECTED") return r.status === "REJECTED";
    return true;
  });
  
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [emailSentStatus, setEmailSentStatus] = useState<"idle" | "success" | "error">("idle");

  const fetchDriveFiles = async () => {
    setIsLoadingDrive(true);
    try {
      const res = await fetch("/api/google/drive-files");
      const data = await res.json();
      if (data.success) {
        setDriveFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to fetch drive files:", err);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (selectedRequest && selectedRequest.status === "APPROVED") {
      fetchDriveFiles();
    }
  }, [selectedRequest]);

  const handleSendReply = async () => {
    if (!selectedRequest || !replyText.trim()) return;
    setIsSending(true);
    setEmailSentStatus("idle");
    try {
      const res = await fetch("/api/footage-requests/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedRequest.email,
          subject: `STAP Footage Request #${selectedRequest.id} Update`,
          body: `<p>Hello ${selectedRequest.requesterName},</p><p>${replyText.replace(/\n/g, "<br>")}</p><p>Regards,<br>STAP Management</p>`
        })
      });
      const data = await res.json();
      if (data.success) {
        setEmailSentStatus("success");
        setReplyText("");
        setIsReplying(false);
      } else {
        setEmailSentStatus("error");
      }
    } catch (err) {
      setEmailSentStatus("error");
    } finally {
      setIsSending(false);
    }
  };

  // Filter requests based on tab selection
  const filteredRequests = requests.filter((r) => {
    if (activeSubTab === "NEW") return r.status === "PENDING";
    if (activeSubTab === "ONGOING") return r.status === "APPROVED" || r.status === "ONGOING";
    if (activeSubTab === "REJECTED") return r.status === "REJECTED";
    return true;
  });

  const handleOpenRequest = (req: FootageRequest) => {
    setSelectedRequest(req);
  };

  const handleCloseRequest = () => {
    setSelectedRequest(null);
  };

  const handleAction = (status: FootageRequest["status"], handledBy: string) => {
    if (selectedRequest) {
      onUpdateRequestStatus(selectedRequest.id, status, handledBy);
      // Update local state for modal display
      setSelectedRequest({
        ...selectedRequest,
        status,
        handledBy: handledBy
      });
    }
  };

  return (
    <div className="space-y-6" id="footage-requests-tab">
      {/* Category Tabs: CCTV Footage vs Certified Reports */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2 w-full max-w-md mx-auto mb-6 border border-slate-200">
        <button
          type="button"
          onClick={() => setRequestCategory("CCTV")}
          className={`flex-1 py-3 text-xs font-black tracking-wider uppercase transition-all rounded-xl cursor-pointer text-center ${
            requestCategory === "CCTV"
              ? "bg-[#0F172A] text-white shadow-md font-extrabold"
              : "text-slate-500 hover:text-slate-800 font-semibold"
          }`}
        >
          CCTV Footage Requests
        </button>
        <button
          type="button"
          onClick={() => setRequestCategory("CERTIFIED")}
          className={`flex-1 py-3 text-xs font-black tracking-wider uppercase transition-all rounded-xl cursor-pointer text-center ${
            requestCategory === "CERTIFIED"
              ? "bg-[#0F172A] text-white shadow-md font-extrabold"
              : "text-slate-500 hover:text-slate-800 font-semibold"
          }`}
        >
          Certified Report Requests
        </button>
      </div>

      {requestCategory === "CCTV" ? (
        <>
          {/* Tab Selectors matching screenshot */}
          <div className="border-b border-slate-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveSubTab("NEW")}
            className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all ${
              activeSubTab === "NEW"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            NEW REQUESTS
          </button>
          <button
            onClick={() => setActiveSubTab("ONGOING")}
            className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all ${
              activeSubTab === "ONGOING"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            ONGOING
          </button>
          <button
            onClick={() => setActiveSubTab("REJECTED")}
            className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all ${
              activeSubTab === "REJECTED"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            REJECTED
          </button>
        </div>
      </div>

      {/* Row count info */}
      <div className="text-xs text-slate-500 font-semibold px-1">
        {filteredRequests.length} request(s)
      </div>

      {/* Table listing */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-400 text-[11px] font-bold tracking-wider">
              <th className="py-4 px-6">#</th>
              <th className="py-4 px-6">REQUESTER</th>
              <th className="py-4 px-6">NATURE</th>
              <th className="py-4 px-6">DATE SUBMITTED</th>
              <th className="py-4 px-6">HANDLED BY</th>
              <th className="py-4 px-6">STATUS</th>
              <th className="py-4 px-6 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-slate-300" />
                    <span>No footage requests found in this queue</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-semibold text-slate-400">#{req.id}</td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{req.requesterName}</span>
                      <span className="text-[10px] text-slate-400">{req.email}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-600">{req.nature}</td>
                  <td className="py-4 px-6 text-slate-500">{req.dateSubmitted}</td>
                  <td className="py-4 px-6 text-slate-500">{req.handledBy || "—"}</td>
                  <td className="py-4 px-6">
                    <span
                      className={`text-[10px] font-bold tracking-wide uppercase ${
                        req.status === "PENDING"
                          ? "text-amber-500"
                          : req.status === "APPROVED" || req.status === "ONGOING"
                          ? "text-emerald-500"
                          : "text-rose-500"
                      }`}
                    >
                      {req.status === "APPROVED" ? "APPROVED" : req.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleOpenRequest(req)}
                      className="px-4 py-2 bg-[#1E293B] hover:bg-[#0F172A] text-white font-bold rounded-lg transition-all text-[11px] active:scale-95"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Interactive Footage Request Detailed Modal (Page 4 style) */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">Footage Request #{selectedRequest.id}</h2>
                  <span
                    className={`text-xs font-bold tracking-wider uppercase ${
                      selectedRequest.status === "PENDING"
                        ? "text-amber-500"
                        : selectedRequest.status === "APPROVED" || selectedRequest.status === "ONGOING"
                        ? "text-emerald-500"
                        : "text-rose-500"
                    }`}
                  >
                    {selectedRequest.status}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseRequest}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Requester Information */}
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  REQUESTER INFORMATION
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">FULL NAME</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.requesterName}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">EMAIL</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.email}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">ORGANIZATION</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.organization}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">CONTACT</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.contact}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100 col-span-2">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">ADDRESS</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.address}</span>
                  </div>
                </div>
              </div>

              {/* Footage Details */}
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  FOOTAGE DETAILS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">NATURE</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.nature}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">HANDLED BY</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.handledBy || "Not yet assigned"}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">FOOTAGE DATE</span>
                    <span className="text-xs font-bold text-slate-800 leading-tight">{selectedRequest.footageDate}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">CAMERA</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.camera}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100 col-span-2">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">TIME RANGE</span>
                    <span className="text-xs font-bold text-slate-800">{selectedRequest.timeRange}</span>
                  </div>
                </div>
              </div>

              {/* Incident Description */}
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  INCIDENT DESCRIPTION
                </h3>
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 text-xs font-medium text-slate-700 min-h-[80px] leading-relaxed">
                  {selectedRequest.description}
                </div>
              </div>

              {/* Gmail Reply Section */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    GMAIL CORRESPONDENCE
                  </h3>
                  {!isReplying && (
                    <button
                      onClick={() => setIsReplying(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
                    >
                      <Mail className="h-3 w-3" />
                      Compose Reply
                    </button>
                  )}
                </div>

                {isReplying ? (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
                      <span className="font-bold uppercase tracking-wider text-slate-400">Recipient:</span>
                      <span className="font-mono">{selectedRequest.email}</span>
                    </div>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response to the requester..."
                      className="w-full h-32 bg-white border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsReplying(false)}
                        className="px-4 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendReply}
                        disabled={isSending || !replyText.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isSending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Send via Gmail
                      </button>
                    </div>
                  </div>
                ) : (
                  emailSentStatus === "success" && (
                    <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100 text-[10px] font-bold flex items-center gap-2">
                      <Check className="h-3.5 w-3.5" />
                      Reply sent successfully!
                    </div>
                  )
                )}
              </div>

              {/* Drive Files Section (Only for approved/ongoing) */}
              {(selectedRequest.status === "APPROVED" || selectedRequest.status === "ONGOING") && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <HardDrive className="h-3 w-3" />
                    LINKED VIDEO FOOTAGE (DRIVE)
                  </h3>
                  
                  {isLoadingDrive ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 text-slate-300 animate-spin" />
                    </div>
                  ) : driveFiles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {driveFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 group hover:border-blue-200 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                              {file.thumbnailLink ? (
                                <img src={file.thumbnailLink} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-slate-200 text-slate-400">
                                  <Play className="h-5 w-5 fill-current" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800 line-clamp-1">{file.name}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-mono">{file.createdTime}</span>
                            </div>
                          </div>
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center space-y-2">
                      <div className="flex justify-center">
                        <HardDrive className="h-8 w-8 text-slate-200" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">No video files found in linked Drive folder.</p>
                      <p className="text-[9px] text-slate-300 uppercase tracking-tighter">Ensure GOOGLE_REFRESH_TOKEN is configured in Admin Settings</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer matching exact buttons & styling */}
            <div className="p-6 border-t border-slate-100 bg-[#F8FAFC] flex gap-3">
              <button
                onClick={() => {
                  handleAction("APPROVED", "Crissel Ann G. Zapatero");
                  handleCloseRequest();
                }}
                className="flex-1 py-3 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-98"
              >
                <Check className="h-4 w-4" />
                <span>✓ Approve</span>
              </button>
              <button
                onClick={() => {
                  handleAction("REJECTED", "Crissel Ann G. Zapatero");
                  handleCloseRequest();
                }}
                className="flex-1 py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-98"
              >
                <X className="h-4 w-4" />
                <span>X Reject</span>
              </button>
              <button
                onClick={() => {
                  handleAction("ONGOING", "Crissel Ann G. Zapatero");
                  handleCloseRequest();
                }}
                className="flex-1 py-3 bg-[#64748B] hover:bg-[#475569] text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-98"
              >
                <span>Mark Under Review</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
    ) : (
      <>
        {/* Certified Reports Bin Navigation */}
          <div className="border-b border-slate-200">
            <div className="flex gap-8">
              <button
                type="button"
                onClick={() => setCertifiedSubTab("PENDING")}
                className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  certifiedSubTab === "PENDING"
                    ? "border-b-2 border-slate-900 text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                PENDING REQUESTS
              </button>
              <button
                type="button"
                onClick={() => setCertifiedSubTab("APPROVED")}
                className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  certifiedSubTab === "APPROVED"
                    ? "border-b-2 border-slate-900 text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                CERTIFIED & STAMPED
              </button>
              <button
                type="button"
                onClick={() => setCertifiedSubTab("REJECTED")}
                className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  certifiedSubTab === "REJECTED"
                    ? "border-b-2 border-slate-900 text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                REJECTED
              </button>
            </div>
          </div>

          {/* Row count info */}
          <div className="text-xs text-slate-500 font-semibold px-1">
            {filteredReportRequests.length} report request(s)
          </div>

          {/* Reports Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-400 text-[11px] font-bold tracking-wider">
                  <th className="py-4 px-6">ID</th>
                  <th className="py-4 px-6">REQUESTER</th>
                  <th className="py-4 px-6">AFFILIATION</th>
                  <th className="py-4 px-6">REPORT TYPE</th>
                  <th className="py-4 px-6">TARGET RANGE</th>
                  <th className="py-4 px-6">STATUS</th>
                  <th className="py-4 px-6 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredReportRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-slate-300" />
                        <span>No certified report requests found in this queue</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReportRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-400">
                        #{req.id?.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{req.requesterInfo?.name}</span>
                          <span className="text-[10px] text-slate-400">{req.requesterInfo?.email}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        {req.requesterInfo?.organization || "Individual / Citizen"}
                      </td>
                      <td className="py-4 px-6 text-slate-700 font-mono text-[10px] uppercase font-bold">
                        {req.type || "Certified Traffic Log"}
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium font-mono text-[10px]">
                        {req.requestedRange?.startDate} to {req.requestedRange?.endDate}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`text-[10px] font-bold tracking-wide uppercase ${
                            req.status === "PENDING"
                              ? "text-amber-500"
                              : req.status === "APPROVED"
                              ? "text-emerald-500"
                              : "text-rose-500"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReportRequest(req)}
                          className="px-4 py-2 bg-[#1E293B] hover:bg-[#0F172A] text-white font-bold rounded-lg transition-all text-[11px] active:scale-95 cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Detailed Certified Report Request Modal */}
          {selectedReportRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-900">
                        Certified Request #{selectedReportRequest.id?.substring(0, 8).toUpperCase()}
                      </h2>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${
                          selectedReportRequest.status === "PENDING"
                            ? "text-amber-500"
                            : selectedReportRequest.status === "APPROVED"
                            ? "text-emerald-500"
                            : "text-rose-500"
                        }`}
                      >
                        {selectedReportRequest.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mt-1">
                      Submitted on: {selectedReportRequest.createdAt ? new Date(selectedReportRequest.createdAt).toLocaleString() : "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReportRequest(null)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                  {/* Requester Information Details */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-4 space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      Requester particulars
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-400 font-semibold mb-0.5">Name</p>
                        <p className="text-slate-900 font-bold">{selectedReportRequest.requesterInfo?.name}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold mb-0.5">Organization / Institution</p>
                        <p className="text-slate-800 font-bold">{selectedReportRequest.requesterInfo?.organization || "None (Citizen)"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold mb-0.5">Email Address</p>
                        <p className="text-slate-800 font-medium">{selectedReportRequest.requesterInfo?.email}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold mb-0.5">Contact Number</p>
                        <p className="text-slate-800 font-medium">{selectedReportRequest.requesterInfo?.contact || "—"}</p>
                      </div>
                      <div className="col-span-2 border-t border-slate-200/40 pt-2">
                        <p className="text-slate-400 font-semibold mb-0.5">Physical Address</p>
                        <p className="text-slate-800 font-medium">{selectedReportRequest.requesterInfo?.address || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Certification Target Scope */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Certification parameters
                    </h3>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                      <div>
                        <p className="text-slate-400 font-semibold mb-0.5">Requested Document</p>
                        <p className="text-slate-800 font-bold uppercase tracking-wider">{selectedReportRequest.type || "Certified Traffic Log"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold mb-0.5">Log Range Scope</p>
                        <p className="text-slate-800 font-bold">
                          {selectedReportRequest.requestedRange?.startDate} to {selectedReportRequest.requestedRange?.endDate}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Generated PDF Download if Approved */}
                  {selectedReportRequest.status === "APPROVED" && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800">Certified PDF Compiled Successfully</p>
                          <p className="text-[10px] text-slate-500 font-semibold">Certified by: {selectedReportRequest.certifiedBy || "Inspector Martinez"} • {selectedReportRequest.certifiedAt ? new Date(selectedReportRequest.certifiedAt).toLocaleDateString() : ""}</p>
                        </div>
                      </div>
                      {selectedReportRequest.generatedPdfUrl && (
                        <a
                          href={selectedReportRequest.generatedPdfUrl}
                          download={`${(selectedReportRequest.type || "Certified_Traffic_Log").replace(/\s+/g, "_")}_${selectedReportRequest.id.substring(0,8).toUpperCase()}.pdf`}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all text-[11px] shadow-sm cursor-pointer"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Download PDF</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="p-6 border-t border-slate-100 bg-[#F8FAFC] flex gap-3">
                  {selectedReportRequest.status === "PENDING" ? (
                    <>
                      <button
                        type="button"
                        disabled={isProcessingReport !== null}
                        onClick={() => handleApproveReportRequest(selectedReportRequest)}
                        className="flex-1 py-3 bg-[#10B981] hover:bg-[#059669] text-white font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessingReport === selectedReportRequest.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Stamping...</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Stamp & Approve</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingReport !== null}
                        onClick={() => handleRejectReportRequest(selectedReportRequest)}
                        className="flex-1 py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                        <span>Reject Request</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedReportRequest(null)}
                      className="w-full py-3 bg-[#64748B] hover:bg-[#475569] text-white font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      Close Details
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
