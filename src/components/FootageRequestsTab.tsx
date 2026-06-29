import React, { useState, useEffect } from "react";
import { Check, X, Eye, FileText, Info, Mail, Send, HardDrive, ExternalLink, Loader2, Play } from "lucide-react";

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
    </div>
  );
}
