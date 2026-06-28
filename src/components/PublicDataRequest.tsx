import React, { useState } from "react";
import { FileText, Send, CheckCircle, Search, Clock, Calendar, ShieldAlert } from "lucide-react";
import { FootageRequest } from "./FootageRequestsTab";

interface PublicDataRequestProps {
  requests: FootageRequest[];
  onSubmitRequest: (newReq: Omit<FootageRequest, "id" | "dateSubmitted" | "status" | "handledBy">) => void;
}

export default function PublicDataRequest({ requests, onSubmitRequest }: PublicDataRequestProps) {
  // Mode: "FORM" | "SUCCESS" | "TRACK"
  const [activeView, setActiveView] = useState<"FORM" | "TRACK">("FORM");
  const [successId, setSuccessId] = useState<string | null>(null);

  // Form Fields State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [nature, setNature] = useState("Academic");
  const [camera, setCamera] = useState("Camera #1");
  const [footageDateStart, setFootageDateStart] = useState("");
  const [footageDateEnd, setFootageDateEnd] = useState("");
  const [timeRangeStart, setTimeRangeStart] = useState("09:00");
  const [timeRangeEnd, setTimeRangeEnd] = useState("10:00");
  const [description, setDescription] = useState("");

  // Track search state
  const [searchQuery, setSearchQuery] = useState("");
  const [trackResult, setTrackResult] = useState<FootageRequest | null>(null);
  const [searched, setSearched] = useState(false);

  // Form validation & submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !contact || !address || !description || !footageDateStart) {
      alert("Please fill in all required fields.");
      return;
    }

    const nextId = String(Math.floor(Math.random() * 90) + 15);
    const dateStr = footageDateEnd 
      ? `${footageDateStart} → ${footageDateEnd}`
      : footageDateStart;
    const timeStr = `${timeRangeStart}:00 - ${timeRangeEnd}:00`;

    onSubmitRequest({
      requesterName: fullName,
      email,
      organization: organization || "Personal / Individual",
      contact,
      address,
      nature,
      camera,
      footageDate: dateStr,
      timeRange: timeStr,
      description,
    });

    setSuccessId(nextId);
    setActiveView("FORM"); // We'll show success card overlay or separate state
    // Reset fields
    setFullName("");
    setEmail("");
    setOrganization("");
    setContact("");
    setAddress("");
    setNature("Academic");
    setCamera("Camera #1");
    setFootageDateStart("");
    setFootageDateEnd("");
    setDescription("");
  };

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      setTrackResult(null);
      return;
    }

    // Search by ID (e.g., "#14", "14") or exact Email
    const found = requests.find(
      (r) => r.id === trimmed || r.id === trimmed.replace("#", "") || r.email.toLowerCase() === trimmed
    );
    setTrackResult(found || null);
  };

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
            }}
            className={`pb-4 text-xs font-bold tracking-wider uppercase transition-all ${
              activeView === "TRACK"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            TRACK STATUS
          </button>
        </div>
      </div>

      {activeView === "FORM" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-6">
            {successId && (
              <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-start gap-4 shadow-sm">
                <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-emerald-800">CCTV Footage Request Submitted Successfully!</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Your request has been securely queued for administrator assessment. Your tracking ID is{" "}
                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-3xs text-emerald-900">
                      #{successId}
                    </span>
                    .
                  </p>
                  <p className="text-[11px] text-emerald-600">
                    A copy of this confirmation has been sent to your email. STAP officials will evaluate the legal merit and dispatch further correspondence.
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

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">STAP CCTV Footage Request Form</h3>
                  <p className="text-xs text-slate-500 font-medium">Official citizen petition portal for intersection video archives</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Section 1: Personal */}
                <div className="space-y-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block border-b border-slate-100 pb-1">
                    1. APPLICANT INFORMATION
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">FULL NAME *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Juan dela Cruz"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">EMAIL ADDRESS *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. juan@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">ORGANIZATION / AFFILIATION</label>
                      <input
                        type="text"
                        placeholder="e.g. PUP, Barangay, law office"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">CONTACT NUMBER *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 0917-XXX-XXXX"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 block">PHYSICAL ADDRESS *</label>
                    <input
                      type="text"
                      required
                      placeholder="Street, Barangay, City, Province"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Section 2: Details */}
                <div className="space-y-4 pt-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block border-b border-slate-100 pb-1">
                    2. VIDEO FOOTAGE DETAILS
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">NATURE OF REQUEST</label>
                      <select
                        value={nature}
                        onChange={(e) => setNature(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                      >
                        <option value="Academic">Academic Study / Research</option>
                        <option value="Accident">Traffic Accident Investigation</option>
                        <option value="Investigation">Law Enforcement Inquiry</option>
                        <option value="Legal">Court Order / Litigation</option>
                        <option value="Personal">Personal Safety / Lost Item</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">TARGET INTERSECTION CAMERA</label>
                      <select
                        value={camera}
                        onChange={(e) => setCamera(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                      >
                        <option value="Camera #1">Camera #1 — Mayor Gil Fernando Ave Northbound</option>
                        <option value="Camera #2">Camera #2 — Mayor Gil Fernando Ave Southbound</option>
                        <option value="Camera #3">Camera #3 — Sumulong Highway Eastbound</option>
                        <option value="Camera #4">Camera #4 — Sumulong Highway Westbound</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">FOOTAGE DATE START *</label>
                      <div className="relative">
                        <input
                          type="date"
                          required
                          value={footageDateStart}
                          onChange={(e) => setFootageDateStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">FOOTAGE DATE END (OPTIONAL)</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={footageDateEnd}
                          onChange={(e) => setFootageDateEnd(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">TIME RANGE START</label>
                      <input
                        type="time"
                        value={timeRangeStart}
                        onChange={(e) => setTimeRangeStart(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">TIME RANGE END</label>
                      <input
                        type="time"
                        value={timeRangeEnd}
                        onChange={(e) => setTimeRangeEnd(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      INCIDENT DESCRIPTION & PURPOSE OF PETITION *
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe exactly what happened (e.g. exact time of vehicle collision, vehicle plate numbers involved) and why this video is needed for your case."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white min-h-[100px] leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    <span>Submit Official Request</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Guidelines Sidebar */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">
                LEGAL GUIDELINES
              </span>
              <div className="space-y-3 text-xs leading-relaxed text-slate-600 font-medium">
                <div className="flex gap-2.5 items-start">
                  <span className="text-slate-400 text-[10px] mt-0.5">🔒</span>
                  <p>
                    <strong>Data Privacy Act (R.A. 10173):</strong> In compliance with law, facial features, identities, and plate numbers may be subject to masking unless subpoenaed.
                  </p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="text-slate-400 text-[10px] mt-0.5">📋</span>
                  <p>
                    <strong>Legitimate Interest:</strong> Footage will only be issued to parties with proven direct legal involvement in registered traffic incidents.
                  </p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="text-slate-400 text-[10px] mt-0.5">⏱️</span>
                  <p>
                    <strong>30-Day Retention:</strong> Cameras overwrite video data every 30 days. Please file petitions as promptly as possible after an incident occurs.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#1E293B] text-slate-300 p-5 rounded-2xl border border-slate-800 text-xs leading-relaxed font-semibold flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                Requests representing fraudulent declarations or mock police reports will be immediately routed to legal authorities for prosecution.
              </div>
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
                className="bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 shadow-xs"
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
                  {/* Result Header */}
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

                  {/* Status Timeline */}
                  <div className="p-6 space-y-6">
                    <div className="space-y-4">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">
                        TRACKING PROCESS TIMELINE
                      </span>

                      <div className="relative pl-6 space-y-6 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {/* Milestone 1: Submitted */}
                        <div className="relative">
                          <span className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-100 flex items-center justify-center text-[7px] text-white">✓</span>
                          <div className="space-y-0.5 text-left">
                            <span className="text-xs font-bold text-slate-800 block">Footage Request Lodged</span>
                            <span className="text-[10px] text-slate-400 block">Submitted on {trackResult.dateSubmitted} — Queue registered</span>
                          </div>
                        </div>

                        {/* Milestone 2: Processing / Status dependent */}
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

                        {/* Milestone 3: End state */}
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

                    {/* Metadata summary */}
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
    </div>
  );
}
