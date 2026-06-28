import React, { useState } from "react";
import { AlertTriangle, Plus, Send, ShieldAlert, CheckCircle, Flame, Clock } from "lucide-react";
import { IncidentReport } from "./IncidentReportsTab";
import { Lane } from "../types";

interface PublicIncidentReportProps {
  reports: IncidentReport[];
  onAddReport: (newRep: Omit<IncidentReport, "id" | "timeReported">) => void;
}

export default function PublicIncidentReport({ reports, onAddReport }: PublicIncidentReportProps) {
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form Fields State
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [lane, setLane] = useState<Lane>("NORTH");
  const [type, setType] = useState("Accident");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterName || !reporterContact || !description) {
      alert("Please fill in all required fields.");
      return;
    }

    onAddReport({
      lane,
      type,
      reporterName,
      reporterContact,
      status: "ACTIVE",
      description,
      severity,
    });

    setSuccess(true);
    setShowForm(false);

    // Reset Form
    setReporterName("");
    setReporterContact("");
    setLane("NORTH");
    setType("Accident");
    setSeverity("MEDIUM");
    setDescription("");
  };

  const activeIncidents = reports.filter((r) => r.status === "ACTIVE");
  const resolvedIncidents = reports.filter((r) => r.status === "RESOLVED");

  return (
    <div className="space-y-6" id="public-incident-report">
      {/* Header Area */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">Public Incident Reporting Portal</h3>
          <p className="text-xs text-slate-500 font-medium">View active road safety updates or lodge a live traffic incident report</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setSuccess(false);
          }}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? "Cancel Report" : "Report Traffic Incident"}</span>
        </button>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-start gap-3.5 shadow-xs transition-all animate-fadeIn">
          <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Live Incident Dispatched!</h4>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Your incident report has been securely broadcast to the STAP Admin Hub. Traffic operators have been flagged for response. Thank you for helping keep Marikina roads safe.
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-w-2xl transition-all animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Lodge New Traffic Incident</h4>
              <p className="text-[11px] text-slate-400 font-semibold">Report blocks, road hazards, floods, or vehicle breakdowns</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 block">YOUR FULL NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jose Rizal"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 block">CONTACT NUMBER *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0917-123-4567"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 block">AFFECTED APPROACH / LANE</label>
                <select
                  value={lane}
                  onChange={(e) => setLane(e.target.value as Lane)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="NORTH">NORTH — Mayor Gil Fernando Ave</option>
                  <option value="SOUTH">SOUTH — Mayor Gil Fernando Ave</option>
                  <option value="EAST">EAST — Sumulong Highway</option>
                  <option value="WEST">WEST — Sumulong Highway</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 block">INCIDENT TYPE</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="Accident">Accident / Collision</option>
                  <option value="Gridlock">Heavy Gridlock / Congestion</option>
                  <option value="Hazard">Road Obstruction / Hazard</option>
                  <option value="Flooding">Flash Flooding</option>
                  <option value="Breakdown">Stalled Vehicle</option>
                  <option value="Signal Outage">Traffic Light Malfunction</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 block">ESTIMATED SEVERITY</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="LOW">LOW — Slow traffic build-up</option>
                  <option value="MEDIUM">MEDIUM — Lane partially blocked</option>
                  <option value="HIGH">HIGH — Total obstruction / danger</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">DESCRIPTION OF INCIDENT *</label>
              <textarea
                required
                rows={3}
                placeholder="Describe what is causing the blockage. Mention vehicles involved, exact lane position, and whether traffic is moving."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white min-h-[80px]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Dispatch Live Alert</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Incidents List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Incidents Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
              🔴 LIVE ROAD SAFETY REPORTS ({activeIncidents.length})
            </h4>
          </div>

          <div className="space-y-4">
            {activeIncidents.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-600 uppercase">All approaches clear</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-normal">
                  No active traffic disruptions or accidents have been reported on Mayor Gil Fernando Ave x Sumulong Hwy.
                </p>
              </div>
            ) : (
              activeIncidents.map((rep) => (
                <div key={rep.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-left">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800">{rep.type}</span>
                        <span className="text-[10px] bg-red-50 text-red-600 font-black px-2 py-0.5 rounded border border-red-100">
                          {rep.lane} APPROACH
                        </span>
                        <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded ${
                          rep.severity === "HIGH" 
                            ? "bg-red-100 text-red-700" 
                            : rep.severity === "MEDIUM"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {rep.severity} SEVERITY
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>Reported at {rep.timeReported}</span>
                      </div>
                    </div>
                    <span className="bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse border border-rose-150">
                      ● Active
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-600 leading-relaxed">
                    {rep.description}
                  </p>

                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between items-center border-t border-slate-50 pt-3">
                    <span>Source: {rep.reporterName}</span>
                    <span className="text-slate-400">ID: #{rep.id}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar widgets for Incidents */}
        <div className="space-y-4">
          {/* Incident hotlines */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-left">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">
              EMERGENCY HOTLINES
            </span>
            <div className="space-y-3 font-semibold text-xs text-slate-700">
              <div className="border-b border-slate-50 pb-2">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Marikina Rescue (MCDRRMO)</span>
                <span className="text-slate-800 font-bold block mt-0.5">☎️ 161 / (02) 8646-2436</span>
              </div>
              <div className="border-b border-slate-50 pb-2">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Marikina Traffic Police</span>
                <span className="text-slate-800 font-bold block mt-0.5">☎️ (02) 8646-1633</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">STAP Automatics Center</span>
                <span className="text-slate-800 font-bold block mt-0.5">☎️ stap-ops@marikina.gov</span>
              </div>
            </div>
          </div>

          {/* Resolved Incidents */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-left">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">
              RECENT RESOLUTIONS ({resolvedIncidents.length})
            </span>
            <div className="space-y-2 text-xs">
              {resolvedIncidents.map((rep) => (
                <div key={rep.id} className="border-b border-slate-50 last:border-0 pb-2 last:pb-0 font-medium">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">{rep.type}</span>
                    <span className="text-[9px] text-emerald-600 font-black">RESOLVED</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{rep.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
