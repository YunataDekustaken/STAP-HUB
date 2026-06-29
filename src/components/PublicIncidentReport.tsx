import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Clock, Calendar, CloudRain, Shield, User } from "lucide-react";
import { IncidentReport } from "./IncidentReportsTab";

interface PublicIncidentReportProps {
  reports: IncidentReport[];
  onAddReport: (newRep: Omit<IncidentReport, "id" | "timeReported">) => void;
}

export default function PublicIncidentReport({ reports, onAddReport }: PublicIncidentReportProps) {
  const [success, setSuccess] = useState(false);

  // Form Fields State
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [environmentalCondition, setEnvironmentalCondition] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [numberOfVehicles, setNumberOfVehicles] = useState("");
  const [peopleHurt, setPeopleHurt] = useState<"Yes" | "No" | null>(null);
  const [detailedNarrative, setDetailedNarrative] = useState("");
  const [nameOfReportingParty, setNameOfReportingParty] = useState("");

  // Initialize date and time to current values on mount
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    setDate(`${year}-${month}-${day}`);

    const hours = String(today.getHours()).padStart(2, "0");
    const minutes = String(today.getMinutes()).padStart(2, "0");
    setTime(`${hours}:${minutes}`);
  }, []);

  // Formatted date for header (e.g., "JUNE 29, 2026")
  const headerDateString = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

  const vehicleTypes = [
    "Car",
    "Truck",
    "Motorcycle",
    "Bus",
    "Mini Bus",
    "Tricycle",
    "Jeepney",
    "Ambulance",
    "Fire Truck",
    "Emergency Vehicle",
  ];

  const toggleVehicleType = (type: string) => {
    if (selectedVehicles.includes(type)) {
      setSelectedVehicles(selectedVehicles.filter((v) => v !== type));
    } else {
      setSelectedVehicles([...selectedVehicles, type]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !time || !environmentalCondition || !locationDescription || !peopleHurt || !nameOfReportingParty) {
      alert("Please fill in all required fields.");
      return;
    }

    if (detailedNarrative.length < 20) {
      alert("Detailed narrative must be at least 20 characters.");
      return;
    }

    // Infer lane from location description
    let inferredLane = "NORTH";
    const locLower = locationDescription.toLowerCase();
    if (locLower.includes("south")) {
      inferredLane = "SOUTH";
    } else if (locLower.includes("east")) {
      inferredLane = "EAST";
    } else if (locLower.includes("west")) {
      inferredLane = "WEST";
    }

    // Determine type and severity
    const isAccident = selectedVehicles.length > 0 || locLower.includes("accident") || locLower.includes("crash") || locLower.includes("collision");
    const inferredType = isAccident ? "Accident" : "Weather Hazard";
    
    let inferredSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
    if (peopleHurt === "Yes") {
      inferredSeverity = "CRITICAL";
    } else if (selectedVehicles.length > 2 || locLower.includes("heavy") || locLower.includes("blocked")) {
      inferredSeverity = "HIGH";
    } else if (selectedVehicles.length <= 1) {
      inferredSeverity = "LOW";
    }

    // Format rich description for Admin Console
    const structuredDescription = `
[ENVIRONMENT]
Date: ${date}
Time: ${time}
Weather/Condition: ${environmentalCondition}
Location: ${locationDescription}

[PARTIES INVOLVED]
Vehicles: ${selectedVehicles.length > 0 ? selectedVehicles.join(", ") : "None"}
Count: ${numberOfVehicles || "1"}
Injuries: ${peopleHurt}

[NARRATIVE]
${detailedNarrative}
`.trim();

    onAddReport({
      lane: inferredLane,
      type: inferredType as any,
      reporterName: nameOfReportingParty,
      reporterContact: "Online Portal",
      status: "ACTIVE",
      description: structuredDescription,
      severity: inferredSeverity,
    });

    setSuccess(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Reset Form Fields
    setSelectedVehicles([]);
    setNumberOfVehicles("");
    setPeopleHurt(null);
    setDetailedNarrative("");
    setNameOfReportingParty("");
    setEnvironmentalCondition("");
    setLocationDescription("");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="public-incident-report">
      {/* Header Area exactly matching Screenshot 1 */}
      <div className="flex justify-between items-start pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Incident / Accident Report</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Use this form to report a traffic incident or accident around{" "}
            <span className="font-bold text-slate-700">Mayor Gil Fernando Avenue / Sumulong Highway</span>.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {headerDateString}
          </span>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-start gap-3.5 shadow-sm transition-all animate-fadeIn">
          <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Report Submitted Successfully!</h4>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Thank you for lodging this report. The details have been dispatched to the STAP Admin Center. Marikina Traffic Operations has been alerted to review the incident.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="text-xs font-bold text-emerald-800 underline hover:text-emerald-900 mt-2 block"
            >
              Submit another report
            </button>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 01 FUNDAMENTAL INFORMATION */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#0F172A] text-white text-[10px] font-black h-5 w-5 rounded flex items-center justify-center shrink-0">
              01
            </div>
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              FUNDAMENTAL INFORMATION
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                DATE <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                TIME <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                ENVIRONMENTAL CONDITION <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={environmentalCondition}
                onChange={(e) => setEnvironmentalCondition(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-all font-medium appearance-none"
              >
                <option value="">Select condition</option>
                <option value="Clear / Dry">Clear / Dry</option>
                <option value="Rainy / Wet">Rainy / Wet</option>
                <option value="Foggy / Low Visibility">Foggy / Low Visibility</option>
                <option value="Cloudy / Overcast">Cloudy / Overcast</option>
                <option value="High Winds">High Winds</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              LOCATION DESCRIPTION <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Near Petron station along Mayor Gil Fernando Ave., Marikina"
              value={locationDescription}
              onChange={(e) => setLocationDescription(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-all font-medium"
            />
          </div>
        </div>

        {/* 02 PARTIES INVOLVED */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#0F172A] text-white text-[10px] font-black h-5 w-5 rounded flex items-center justify-center shrink-0">
              02
            </div>
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              PARTIES INVOLVED <span className="text-slate-400 font-normal lowercase italic">(if applicable)</span>
            </h3>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              VEHICLE TYPE
            </label>
            <div className="flex flex-wrap gap-2">
              {vehicleTypes.map((type) => {
                const isSelected = selectedVehicles.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleVehicleType(type)}
                    className={`px-4 py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#0F172A] text-white border-[#0F172A]"
                        : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                NUMBER OF VEHICLES
              </label>
              <input
                type="text"
                placeholder="e.g. 2"
                value={numberOfVehicles}
                onChange={(e) => setNumberOfVehicles(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                ARE THERE PEOPLE HURT? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {(["Yes", "No"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPeopleHurt(option)}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      peopleHurt === option
                        ? "bg-[#0F172A] text-white border-[#0F172A] shadow-xs"
                        : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 03 DESCRIPTION */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#0F172A] text-white text-[10px] font-black h-5 w-5 rounded flex items-center justify-center shrink-0">
              03
            </div>
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              DESCRIPTION
            </h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              DETAILED NARRATIVE <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Describe what happened in detail — sequence of events, road conditions, any relevant observations..."
              value={detailedNarrative}
              onChange={(e) => setDetailedNarrative(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-all font-medium h-32 resize-none"
            />
            <div className="flex justify-end">
              <span
                className={`text-[10px] font-semibold ${
                  detailedNarrative.length >= 20 ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {detailedNarrative.length} characters (minimum 20)
              </span>
            </div>
          </div>
        </div>

        {/* 04 WITNESS & AUTHORITIES */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#0F172A] text-white text-[10px] font-black h-5 w-5 rounded flex items-center justify-center shrink-0">
              04
            </div>
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              WITNESS & AUTHORITIES
            </h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              NAME OF REPORTING PARTY <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Full name"
              value={nameOfReportingParty}
              onChange={(e) => setNameOfReportingParty(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-all font-medium"
            />
          </div>
        </div>

        {/* Submit Button exactly matching the screenshot */}
        <div className="flex justify-start pt-2">
          <button
            type="submit"
            className="bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs px-6 py-3.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-sm cursor-pointer"
          >
            Submit Report
          </button>
        </div>
      </form>
    </div>
  );
}
