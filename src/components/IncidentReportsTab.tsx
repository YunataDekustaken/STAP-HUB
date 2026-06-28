import React, { useState } from "react";
import { AlertTriangle, Plus, FileText, CheckCircle, ShieldAlert } from "lucide-react";

export interface IncidentReport {
  id: string;
  lane: string;
  type: "Accident" | "Gridlock" | "Debris" | "Signal Failure" | "Weather Hazard";
  reporterName: string;
  reporterContact: string;
  timeReported: string;
  status: "ACTIVE" | "RESOLVING" | "RESOLVED";
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface IncidentReportsTabProps {
  reports: IncidentReport[];
  onAddReport: (report: Omit<IncidentReport, "id" | "timeReported">) => void;
  onUpdateReportStatus: (id: string, nextStatus: IncidentReport["status"]) => void;
}

export default function IncidentReportsTab({ reports, onAddReport, onUpdateReportStatus }: IncidentReportsTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [lane, setLane] = useState("NORTH");
  const [type, setType] = useState<IncidentReport["type"]>("Accident");
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [severity, setSeverity] = useState<IncidentReport["severity"]>("MEDIUM");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterName || !description) return;
    onAddReport({
      lane,
      type,
      reporterName,
      reporterContact,
      severity,
      description,
      status: "ACTIVE"
    });
    // Reset form
    setReporterName("");
    setReporterContact("");
    setDescription("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6" id="incident-reports-tab">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">City Incident Reports</h2>
          <p className="text-[11px] text-slate-500 font-medium">Log and track live hazards, vehicle crashes, and roadway gridlocks</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-bold rounded-xl transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>{showAddForm ? "Cancel" : "Report Incident"}</span>
        </button>
      </div>

      {/* Reporting Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-2xl">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">File Traffic Incident Report</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">INCIDENT TYPE</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as IncidentReport["type"])}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium"
              >
                <option value="Accident">💥 Accident / Collision</option>
                <option value="Gridlock">🚗 Gridlock / Congestion</option>
                <option value="Debris">🪵 Debris on Road</option>
                <option value="Signal Failure">🚥 Signal Failure</option>
                <option value="Weather Hazard">🌧️ Weather Hazard</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">LANE / LOCATION</label>
              <select
                value={lane}
                onChange={(e) => setLane(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium"
              >
                <option value="NORTH">Mayor Gil Fernando Ave North</option>
                <option value="SOUTH">Mayor Gil Fernando Ave South</option>
                <option value="EAST">Sumulong Hwy East</option>
                <option value="WEST">Sumulong Hwy West</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">REPORTER NAME</label>
              <input
                type="text"
                required
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Full Name"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">CONTACT NUMBER</label>
              <input
                type="text"
                value={reporterContact}
                onChange={(e) => setReporterContact(e.target.value)}
                placeholder="Mobile or landline"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 font-bold block mb-1">SEVERITY LEVEL</label>
              <div className="flex gap-2">
                {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as IncidentReport["severity"][]).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      severity === sev
                        ? sev === "LOW"
                          ? "bg-cyan-50 border-cyan-300 text-cyan-600"
                          : sev === "MEDIUM"
                          ? "bg-amber-50 border-amber-300 text-amber-600"
                          : "bg-rose-50 border-rose-300 text-rose-600 font-black animate-pulse"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 font-bold block mb-1">DETAILED DESCRIPTION</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the incident, vehicles involved, lanes blocked, etc."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold rounded-xl transition-all shadow-sm"
          >
            Submit Incident Report
          </button>
        </form>
      )}

      {/* Reports Listing Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-400 text-[11px] font-bold tracking-wider">
              <th className="py-4 px-6">ID</th>
              <th className="py-4 px-6">INCIDENT & SEVERITY</th>
              <th className="py-4 px-6">LOCATION</th>
              <th className="py-4 px-6">TIME FILED</th>
              <th className="py-4 px-6">REPORTER</th>
              <th className="py-4 px-6">STATUS</th>
              <th className="py-4 px-6 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-slate-300" />
                    <span>No active incidents reported at the moment</span>
                  </div>
                </td>
              </tr>
            ) : (
              reports.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-400">#{rep.id}</td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <AlertTriangle className={`h-3.5 w-3.5 ${
                          rep.severity === "CRITICAL" || rep.severity === "HIGH" ? "text-rose-500 animate-bounce" : "text-amber-500"
                        }`} />
                        {rep.type}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border self-start ${
                        rep.severity === "LOW"
                          ? "bg-cyan-50 text-cyan-600 border-cyan-200"
                          : rep.severity === "MEDIUM"
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : "bg-rose-50 text-rose-600 border-rose-200"
                      }`}>
                        {rep.severity}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700 capitalize text-[11px]">{rep.lane.toLowerCase()} Corridor</span>
                      <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{rep.description}</p>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-500 font-medium">{rep.timeReported}</td>
                  <td className="py-4 px-6 text-slate-600">
                    <div className="flex flex-col">
                      <span className="font-semibold">{rep.reporterName}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{rep.reporterContact || "No Phone"}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-[10px] font-bold tracking-wide uppercase ${
                      rep.status === "ACTIVE"
                        ? "text-rose-600 font-black animate-pulse"
                        : rep.status === "RESOLVING"
                        ? "text-amber-500"
                        : "text-emerald-500"
                    }`}>
                      {rep.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex gap-1.5 justify-end">
                      {rep.status === "ACTIVE" && (
                        <button
                          onClick={() => onUpdateReportStatus(rep.id, "RESOLVING")}
                          className="px-2.5 py-1.5 bg-[#475569] hover:bg-[#334155] text-white font-bold rounded-lg transition-all text-[10px]"
                        >
                          Dispatch
                        </button>
                      )}
                      {rep.status === "RESOLVING" && (
                        <button
                          onClick={() => onUpdateReportStatus(rep.id, "RESOLVED")}
                          className="px-2.5 py-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold rounded-lg transition-all text-[10px]"
                        >
                          Resolve
                        </button>
                      )}
                      {rep.status === "RESOLVED" && (
                        <span className="text-[10px] text-slate-400 font-bold pr-2 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Done
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
