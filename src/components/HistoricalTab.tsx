import React, { useState } from "react";
import { TrafficHistoryLog } from "../types";
import { Download, Search, Trash2, Calendar, FileSpreadsheet, RefreshCw, AlertCircle } from "lucide-react";

interface HistoricalTabProps {
  logs: TrafficHistoryLog[];
  onClearLogs: () => void;
  onRefresh: () => void;
}

export default function HistoricalTab({ logs, onClearLogs, onRefresh }: HistoricalTabProps) {
  const [filterLane, setFilterLane] = useState<string>("ALL");
  const [filterLos, setFilterLos] = useState<string>("ALL");
  const [filterWeather, setFilterWeather] = useState<string>("ALL");

  const filteredLogs = logs.filter((log) => {
    // Lane check
    if (filterLane !== "ALL") {
      if (filterLane === "NORTH" && log.north.count === 0) return false;
      if (filterLane === "SOUTH" && log.south.count === 0) return false;
      if (filterLane === "EAST" && log.east.count === 0) return false;
      if (filterLane === "WEST" && log.west.count === 0) return false;
    }
    // Level of Service check
    if (filterLos !== "ALL") {
      const matchNorth = log.north.los === filterLos;
      const matchSouth = log.south.los === filterLos;
      const matchEast = log.east.los === filterLos;
      const matchWest = log.west.los === filterLos;
      if (!matchNorth && !matchSouth && !matchEast && !matchWest) return false;
    }
    // Weather check
    if (filterWeather !== "ALL" && log.weather !== filterWeather) {
      return false;
    }
    return true;
  });

  // Dynamic CSV generator matching user request
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    // Headers
    const headers = [
      "Record ID",
      "Timestamp",
      "System Mode",
      "Active Lane",
      "Weather Conditions",
      "Trigger Type",
      "North Count", "North Density %", "North LOS",
      "South Count", "South Density %", "South LOS",
      "East Count", "East Density %", "East LOS",
      "West Count", "West Density %", "West LOS"
    ];

    // Map rows to CSV strings
    const rows = filteredLogs.map((log) => [
      log.id,
      new Date(log.timestamp).toLocaleString(),
      log.mode,
      log.activeLane,
      log.weather,
      log.triggeredBy,
      log.north.count, `${log.north.density}%`, log.north.los,
      log.south.count, `${log.south.density}%`, log.south.los,
      log.east.count, `${log.east.density}%`, log.east.los,
      log.west.count, `${log.west.density}%`, log.west.los
    ]);

    // Construct full content mapping
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    // Browser dynamic file launch hook
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `STAP_Corridor_Report_${dateStr}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="historical-tab">
      
      {/* Search Filter Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              Ledger Filters:
            </span>

            {/* Approach select */}
            <select
              id="filter-lane"
              value={filterLane}
              onChange={(e) => setFilterLane(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Approaches</option>
              <option value="NORTH">North Active</option>
              <option value="SOUTH">South Active</option>
              <option value="EAST">East Active</option>
              <option value="WEST">West Active</option>
            </select>

            {/* Level of service select */}
            <select
              id="filter-los"
              value={filterLos}
              onChange={(e) => setFilterLos(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL font-mono">All Levels (LOS)</option>
              <option value="A">Grade A (Flowing)</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
              <option value="D">Grade D</option>
              <option value="E">Grade E</option>
              <option value="F">Grade F (Congested)</option>
            </select>

            {/* Weather condition select */}
            <select
              id="filter-weather"
              value={filterWeather}
              onChange={(e) => setFilterWeather(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Weathers</option>
              <option value="SUNNY">Sunny (Standard)</option>
              <option value="RAINY">Rain (Wet Road)</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              id="btn-refresh-history"
              onClick={onRefresh}
              className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl transition-all active:scale-95 text-xs flex items-center gap-1.5"
              title="Poll latest log changes from database sync"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
              <span>Sync Status</span>
            </button>

            <button
              id="btn-export-csv"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-xl transition-all active:scale-95 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              id="btn-clear-logs"
              onClick={onClearLogs}
              className="bg-slate-950 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 border border-slate-850 px-3 py-1.5 rounded-xl transition-all active:scale-95 text-[11px] font-mono"
              title="Clear all logs"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* Main Ledger Database Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
        {filteredLogs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4 self-center">
            <AlertCircle className="h-10 w-10 text-slate-600 mb-3" />
            <span className="text-sm font-semibold text-slate-300">No matching logs registered</span>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Verify your active filters or generate device snapshot mock signals via the Hardware Simulator tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
                  <th className="py-4.5 px-5">Timestamp</th>
                  <th className="py-4.5 px-3 uppercase">Trigger</th>
                  <th className="py-4.5 px-3">Mode</th>
                  <th className="py-4.5 px-3">NORTH Queue (LOS / Dens)</th>
                  <th className="py-4.5 px-3">SOUTH Queue (LOS / Dens)</th>
                  <th className="py-4.5 px-3">EAST Queue (LOS / Dens)</th>
                  <th className="py-4.5 px-3">WEST Queue (LOS / Dens)</th>
                  <th className="py-4.5 px-3 text-right pr-5">Climate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-xs font-sans text-slate-300">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/30 transition-colors">
                    <td className="py-4 px-5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-650 shrink-0" />
                        {new Date(log.timestamp).toLocaleTimeString()}{" "}
                        <span className="text-[9px] text-slate-600">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                      </span>
                    </td>
                    <td className="py-4 px-3 font-mono text-[11px] text-emerald-400/90 whitespace-nowrap">
                      {log.triggeredBy}
                    </td>
                    <td className="py-4 px-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        log.mode === "AUTO"
                          ? "bg-slate-800 text-slate-300 border border-slate-700/60"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {log.mode}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${log.activeLane === "NORTH" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="font-bold text-slate-200 font-mono">{log.north.count}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          (LOS {log.north.los} / {log.north.density}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${log.activeLane === "SOUTH" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="font-bold text-slate-200 font-mono">{log.south.count}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          (LOS {log.south.los} / {log.south.density}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${log.activeLane === "EAST" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="font-bold text-slate-200 font-mono">{log.east.count}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          (LOS {log.east.los} / {log.east.density}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${log.activeLane === "WEST" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="font-bold text-slate-200 font-mono">{log.west.count}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          (LOS {log.west.los} / {log.west.density}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-right pr-5 whitespace-nowrap">
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                        log.weather === "SUNNY"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      }`}>
                        {log.weather}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
