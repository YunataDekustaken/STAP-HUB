import React, { useState, useMemo } from "react";
import {
  UploadCloud,
  TrendingUp,
  Activity,
  BarChart2,
  Sliders,
  Calendar,
  Clock,
  Car,
  AlertCircle,
  RefreshCw,
  MapPin,
  ChevronRight,
  Info
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { parseTrafficCSV, ParsedTrafficData, Snapshot } from "../utils/csvParser";
import { SAMPLE_TRAFFIC_CSV } from "../utils/sampleData";

// Helper to format vehicle types nicely for display
const formatVehicleType = (type: string): string => {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Car Sedan Suv", "Sedan / SUV")
    .replace("E Trike", "E-Trike")
    .replace("Modern Jeepney", "Modern Jeepney")
    .replace("Traditional Jeepney", "Traditional Jeepney");
};

export default function AnalyticsTab() {
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<"vol" | "dens" | "dist">("vol");
  
  // Interactive Explorer State
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number>(0);
  const [selectedDistLane, setSelectedDistLane] = useState<string>("ALL");

  // Parse current CSV text
  const parsedData = useMemo<ParsedTrafficData>(() => {
    if (!csvText) {
      return {
        sessionStart: "—",
        snapshots: [],
        finalSummary: null,
        allVehicleTypes: []
      };
    }
    try {
      const data = parseTrafficCSV(csvText);
      setUploadError(null);
      return data;
    } catch (err: any) {
      console.error(err);
      setUploadError("Failed to parse CSV. Please check that the file format matches the standard STAP output.");
      return {
        sessionStart: "—",
        snapshots: [],
        finalSummary: null,
        allVehicleTypes: []
      };
    }
  }, [csvText]);

  // Adjust selected index if snapshots count changes
  React.useEffect(() => {
    if (parsedData.snapshots.length > 0) {
      setSelectedSnapshotIndex(Math.min(selectedSnapshotIndex, parsedData.snapshots.length - 1));
    }
  }, [parsedData.snapshots]);

  // Handle file drop / select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setUploadError("Please upload a valid CSV or TXT text file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        setFileName(file.name);
      }
    };
    reader.onerror = () => {
      setUploadError("Error reading file.");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleResetToDefault = () => {
    setCsvText(SAMPLE_TRAFFIC_CSV);
    setFileName("default_ledger_log.csv");
    setUploadError(null);
  };

  // Extract metadata and summary calculations
  const totalVehiclesProcessed = parsedData.finalSummary?.corridorTotals?.grandUniqueCount || 
    (parsedData.snapshots.length > 0 ? parsedData.snapshots[parsedData.snapshots.length - 1].intersectionSum : 0);

  const sessionEndClock = parsedData.finalSummary?.timestamp || 
    (parsedData.snapshots.length > 0 ? parsedData.snapshots[parsedData.snapshots.length - 1].timestamp : "—");

  // Format progression data for line charts
  const volumeProgressionData = useMemo(() => {
    return parsedData.snapshots.map((snap) => {
      const shortTime = snap.timestamp.includes(" ") ? snap.timestamp.split(" ")[1] : snap.timestamp;
      const row: any = {
        time: shortTime,
        timestamp: snap.timestamp,
        "Total Count": snap.intersectionSum
      };
      snap.lanes.forEach((l) => {
        row[l.lane] = l.cumulativeTotal;
      });
      return row;
    });
  }, [parsedData.snapshots]);

  const densityProgressionData = useMemo(() => {
    return parsedData.snapshots.map((snap) => {
      const shortTime = snap.timestamp.includes(" ") ? snap.timestamp.split(" ")[1] : snap.timestamp;
      const row: any = {
        time: shortTime,
        timestamp: snap.timestamp
      };
      snap.lanes.forEach((l) => {
        row[l.lane] = l.densityOccupancy;
      });
      return row;
    });
  }, [parsedData.snapshots]);

  // Aggregate total vehicle distribution
  const vehicleDistributionData = useMemo(() => {
    const counts: { [type: string]: number } = {};
    
    if (selectedDistLane === "ALL") {
      // Use Final Summary corridor totals or sum from final snapshot
      if (parsedData.finalSummary?.corridorTotals) {
        Object.entries(parsedData.finalSummary.corridorTotals.vehicles).forEach(([type, countVal]) => {
          counts[type] = countVal as number;
        });
      } else if (parsedData.snapshots.length > 0) {
        const lastSnap = parsedData.snapshots[parsedData.snapshots.length - 1];
        lastSnap.lanes.forEach((l) => {
          Object.entries(l.vehicles).forEach(([type, countVal]) => {
            counts[type] = (counts[type] || 0) + (countVal as number);
          });
        });
      }
    } else {
      // Specific lane
      if (parsedData.finalSummary) {
        const laneData = parsedData.finalSummary.lanes.find((l) => l.lane === selectedDistLane);
        if (laneData) {
          Object.entries(laneData.vehicles).forEach(([type, countVal]) => {
            counts[type] = countVal as number;
          });
        }
      } else if (parsedData.snapshots.length > 0) {
        const lastSnap = parsedData.snapshots[parsedData.snapshots.length - 1];
        const laneData = lastSnap.lanes.find((l) => l.lane === selectedDistLane);
        if (laneData) {
          Object.entries(laneData.vehicles).forEach(([type, countVal]) => {
            counts[type] = countVal as number;
          });
        }
      }
    }

    return Object.entries(counts)
      .map(([name, value]) => ({
        rawName: name,
        displayName: formatVehicleType(name),
        value
      }))
      .sort((a, b) => b.value - a.value);
  }, [parsedData, selectedDistLane]);

  // Find most common vehicle type
  const topVehicleType = useMemo(() => {
    if (vehicleDistributionData.length > 0) {
      return vehicleDistributionData[0];
    }
    return { displayName: "—", value: 0 };
  }, [vehicleDistributionData]);

  // Find peak congestion lane & snapshot
  const peakCongestion = useMemo(() => {
    let maxDensity = 0;
    let maxLane = "—";
    let maxTime = "—";

    parsedData.snapshots.forEach((snap) => {
      snap.lanes.forEach((l) => {
        if (l.densityOccupancy > maxDensity) {
          maxDensity = l.densityOccupancy;
          maxLane = l.lane;
          maxTime = snap.timestamp.includes(" ") ? snap.timestamp.split(" ")[1] : snap.timestamp;
        }
      });
    });

    return { lane: maxLane, density: maxDensity, time: maxTime };
  }, [parsedData.snapshots]);

  // Current interactive snapshot details
  const currentSnapshot: Snapshot | undefined = parsedData.snapshots[selectedSnapshotIndex];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      
      {/* 1. TOP HEADER & LOG UPLOADER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs flex flex-col lg:flex-row gap-6 items-center justify-between">
        <div className="space-y-1.5 w-full lg:max-w-md">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#4E6290]/10 rounded-lg text-[#4E6290]">
              <Activity className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">STAP Intelligent Analytics</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Upload the real-time CSV ledger outputted directly by the Python YOLO controller to analyze intersection metrics, compare approaches, and visualize vehicle congestion.
          </p>
          {fileName && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200/60 rounded-full text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Active: {fileName}
            </div>
          )}
        </div>

        {/* DRAG AND DROP ZONE */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 lg:w-80 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]"
                : "border-slate-300 hover:border-[#4E6290]/70 bg-slate-50/50 hover:bg-slate-50"
            }`}
          >
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              id="analytics-csv-upload"
              onChange={handleFileChange}
            />
            <label htmlFor="analytics-csv-upload" className="cursor-pointer flex flex-col items-center justify-center">
              <UploadCloud className="h-7 w-7 text-slate-400 mb-1" />
              <span className="text-xs font-bold text-slate-700">Drag & Drop output file</span>
              <span className="text-[10px] text-slate-400 mt-0.5">or click to browse local PC (.csv, .txt)</span>
            </label>
          </div>

          <button
            onClick={handleResetToDefault}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
            title="Load sample demo ledger"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            <span>Load Demo Log</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-2.5 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Parsing Error:</span> {uploadError}
          </div>
        </div>
      )}

      {parsedData.snapshots.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-12 text-center max-w-2xl mx-auto my-8 space-y-6 shadow-xs">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-[#4E6290]">
            <UploadCloud className="h-8 w-8 animate-bounce text-[#4E6290]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-black text-slate-800 tracking-tight">No Active Traffic Log Loaded</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Upload the CSV/TXT log file generated on your PC by your local Python YOLO controller to visualize real-time congestion and lane performance metrics.
            </p>
          </div>
          <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 text-left space-y-2.5 max-w-md mx-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Log File Import Steps:</span>
            <div className="flex gap-2.5 items-start text-xs text-slate-600">
              <span className="flex items-center justify-center w-5 h-5 bg-[#4E6290]/10 text-[#4E6290] font-extrabold rounded-full text-[10px] shrink-0 mt-0.5">1</span>
              <p>Run your Python YOLO traffic detection software on your local PC.</p>
            </div>
            <div className="flex gap-2.5 items-start text-xs text-slate-600">
              <span className="flex items-center justify-center w-5 h-5 bg-[#4E6290]/10 text-[#4E6290] font-extrabold rounded-full text-[10px] shrink-0 mt-0.5">2</span>
              <p>The controller writes live interval snapshots directly to a log file on your PC.</p>
            </div>
            <div className="flex gap-2.5 items-start text-xs text-slate-600">
              <span className="flex items-center justify-center w-5 h-5 bg-[#4E6290]/10 text-[#4E6290] font-extrabold rounded-full text-[10px] shrink-0 mt-0.5">3</span>
              <p>Drag & drop or browse that file above to load full analytical charts and 2D replay visualizations.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={handleResetToDefault}
              className="px-5 py-2.5 bg-[#4E6290] hover:bg-[#3D4F75] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              Load Sample Demo Ledger
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. SUMMARY METRIC CARDS (Bento Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Unique Vehicles */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">CORRIDOR UNIQUE TOTAL</span>
            <div className="text-2xl font-black text-slate-800 tracking-tight">
              {totalVehiclesProcessed.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <span>★ Total intersection unique count</span>
            </div>
          </div>
          <div className="p-3.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Car className="h-6 w-6" />
          </div>
        </div>

        {/* Active Session duration */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">SESSION TIMEFRAME</span>
            <div className="text-sm font-black text-slate-800 tracking-tight leading-none pt-1">
              Start: {parsedData.sessionStart.split(" ")[1] || parsedData.sessionStart}
            </div>
            <div className="text-sm font-black text-slate-800 tracking-tight leading-none pt-1">
              End: {sessionEndClock.split(" ")[1] || sessionEndClock}
            </div>
            <div className="text-[10px] text-slate-400 font-bold mt-1">
              Date: {parsedData.sessionStart.split(" ")[0]}
            </div>
          </div>
          <div className="p-3.5 bg-amber-50 rounded-xl text-amber-600 flex flex-col gap-1 items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Peak Congestion Approach */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">PEAK APPROACH DENSITY</span>
            <div className="text-2xl font-black text-[#E11D48] tracking-tight">
              {peakCongestion.density.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 font-bold">
              Lane: <span className="text-slate-800 font-extrabold">{peakCongestion.lane}</span> approach at {peakCongestion.time}
            </div>
          </div>
          <div className="p-3.5 bg-rose-50 rounded-xl text-rose-600">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Most Frequent Class */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">PRIMARY VEHICLE TYPE</span>
            <div className="text-lg font-black text-slate-800 tracking-tight truncate max-w-[170px]" title={topVehicleType.displayName}>
              {topVehicleType.displayName}
            </div>
            <div className="text-xs text-slate-500 font-bold">
              Count: <span className="text-[#4E6290] font-extrabold">{topVehicleType.value.toLocaleString()}</span> units
            </div>
          </div>
          <div className="p-3.5 bg-teal-50 rounded-xl text-teal-600">
            <BarChart2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 3. MULTI-CHART GRAPH PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Tabs selectors */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveChartTab("vol")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === "vol"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Volume Growth
            </button>
            <button
              onClick={() => setActiveChartTab("dens")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === "dens"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Approach Density %
            </button>
            <button
              onClick={() => setActiveChartTab("dist")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === "dist"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Vehicle Classification
            </button>
          </div>

          {/* Conditional Dropdown for Classification tab */}
          {activeChartTab === "dist" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">Lane Focus:</span>
              <select
                value={selectedDistLane}
                onChange={(e) => setSelectedDistLane(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-2xs outline-none focus:ring-1 focus:ring-[#4E6290]"
              >
                <option value="ALL">All Intersection</option>
                <option value="NORTH">North Approach</option>
                <option value="SOUTH">South Approach</option>
                <option value="EAST">East Approach</option>
                <option value="WEST">West Approach</option>
              </select>
            </div>
          )}
        </div>

        {/* Chart Content Area */}
        <div className="p-5 md:p-6 h-[340px]">
          {volumeProgressionData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs">
              <Info className="h-8 w-8 text-slate-300 mb-2" />
              <span>No data points found to graph.</span>
            </div>
          ) : activeChartTab === "vol" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeProgressionData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                  }}
                  labelClassName="text-xs font-extrabold text-slate-700"
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: "600" }} />
                <Line type="monotone" dataKey="Total Count" name="Combined Sum" stroke="#0F172A" strokeWidth={3} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="NORTH" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="SOUTH" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="EAST" stroke="#F59E0B" strokeWidth={2} />
                <Line type="monotone" dataKey="WEST" stroke="#EC4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : activeChartTab === "dens" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={densityProgressionData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} />
                <YAxis unit="%" tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} domain={[0, 100]} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, "Density"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                  }}
                  labelClassName="text-xs font-extrabold text-slate-700"
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: "600" }} />
                <Line type="monotone" dataKey="NORTH" stroke="#3B82F6" strokeWidth={2} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="SOUTH" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="EAST" stroke="#F59E0B" strokeWidth={2} />
                <Line type="monotone" dataKey="WEST" stroke="#EC4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleDistributionData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="displayName" tick={{ fontSize: 9, fill: "#64748b", fontWeight: "600" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                  }}
                  labelClassName="text-xs font-extrabold text-slate-700"
                />
                <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                  {vehicleDistributionData.map((entry, idx) => {
                    // Assign colors based on index or vehicle class
                    const colors = [
                      "#4E6290", "#3B82F6", "#10B981", "#F59E0B", 
                      "#EC4899", "#8B5CF6", "#06B6D4", "#14B8A6",
                      "#6366F1", "#A855F7", "#F43F5E", "#10B981"
                    ];
                    return <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. INTERACTIVE INTERVAL EXPLORER & 2D INTERSECTION SIMULATOR */}
      {currentSnapshot && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SLIDER TIMELINE PANEL (Left cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <Sliders className="h-4.5 w-4.5" />
                </span>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Interval Explorer</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Drag the slider to select a specific timestamp and see the lane approaches snapshot at that exact time.
              </p>

              {/* Slider Input */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Snapshot #{selectedSnapshotIndex + 1}</span>
                  <span className="flex items-center gap-1 text-indigo-600"><Clock className="h-3 w-3" /> {currentSnapshot.timestamp}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={parsedData.snapshots.length - 1}
                  value={selectedSnapshotIndex}
                  onChange={(e) => setSelectedSnapshotIndex(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-extrabold">
                  <span>START</span>
                  <span>MIDPOINT</span>
                  <span>END OF LOG</span>
                </div>
              </div>

              {/* Interactive Snapshot stats */}
              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Intersection Total Cumulative:</span>
                  <span className="text-slate-800 font-extrabold text-sm">{currentSnapshot.intersectionSum} units</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {currentSnapshot.lanes.map((l) => (
                    <div key={l.lane} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex flex-col">
                      <span className="text-[9px] text-slate-400 font-black uppercase">{l.lane} Approach</span>
                      <span className="text-sm font-black text-slate-700 mt-0.5">{l.cumulativeTotal} <span className="text-[10px] text-slate-400 font-normal">units</span></span>
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="bg-[#4E6290] h-full rounded-full"
                          style={{ width: `${l.densityOccupancy}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold mt-1 text-right">{l.densityOccupancy.toFixed(1)}% density</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 mt-4 font-bold bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">
              💡 Use this to replay how traffic built up during the recorded session. Ideal for checking localized peak times!
            </div>
          </div>

          {/* 2D INTERSECTION VISUAL MAP (Right cols) */}
          <div className="lg:col-span-7 bg-[#1E293B] rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden min-h-[380px]">
            {/* Visual Header */}
            <div className="flex justify-between items-center z-10">
              <div className="space-y-0.5">
                <div className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">STAP 2D JUNCTION OCCUPANCY REPLAY</div>
                <div className="text-xs text-white font-extrabold flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  <span>Real-time Density Occupancy Map • {currentSnapshot.timestamp.split(" ")[1] || currentSnapshot.timestamp}</span>
                </div>
              </div>
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-emerald-400 font-mono">
                SUM: {currentSnapshot.intersectionSum}
              </div>
            </div>

            {/* Custom 2D CSS Intersection Layout */}
            <div className="relative w-full h-48 md:h-56 mt-4 flex items-center justify-center">
              
              {/* Intersection Center Hub */}
              <div className="absolute w-12 h-12 bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
              </div>

              {/* Approach Roads */}
              {/* NORTH Approach */}
              {(() => {
                const lane = currentSnapshot.lanes.find((l) => l.lane === "NORTH");
                return (
                  <div className="absolute top-0 bottom-[50%] w-10 border-l border-r border-slate-700/80 bg-slate-900 flex flex-col items-center justify-end pb-3">
                    <span className="text-[8px] text-slate-500 font-black">N</span>
                    <div className="w-1.5 h-16 bg-slate-800 rounded-full flex items-end overflow-hidden mt-1 border border-slate-800">
                      <div
                        className="bg-sky-500 w-full rounded-full"
                        style={{ height: `${lane ? lane.densityOccupancy : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white font-bold mt-1 leading-none">{lane ? lane.cumulativeTotal : 0}</span>
                  </div>
                );
              })()}

              {/* SOUTH Approach */}
              {(() => {
                const lane = currentSnapshot.lanes.find((l) => l.lane === "SOUTH");
                return (
                  <div className="absolute bottom-0 top-[50%] w-10 border-l border-r border-slate-700/80 bg-slate-900 flex flex-col items-center justify-start pt-3">
                    <span className="text-[10px] text-white font-bold mb-1 leading-none">{lane ? lane.cumulativeTotal : 0}</span>
                    <div className="w-1.5 h-16 bg-slate-800 rounded-full flex items-start overflow-hidden border border-slate-800">
                      <div
                        className="bg-emerald-500 w-full rounded-full"
                        style={{ height: `${lane ? lane.densityOccupancy : 0}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 font-black mt-1">S</span>
                  </div>
                );
              })()}

              {/* EAST Approach */}
              {(() => {
                const lane = currentSnapshot.lanes.find((l) => l.lane === "EAST");
                return (
                  <div className="absolute right-0 left-[50%] h-10 border-t border-b border-slate-700/80 bg-slate-900 flex items-center justify-start pl-3 gap-1">
                    <span className="text-[8px] text-slate-500 font-black leading-none">E</span>
                    <div className="h-1.5 w-16 bg-slate-800 rounded-full flex items-center justify-start overflow-hidden border border-slate-800">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${lane ? lane.densityOccupancy : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white font-bold leading-none">{lane ? lane.cumulativeTotal : 0}</span>
                  </div>
                );
              })()}

              {/* WEST Approach */}
              {(() => {
                const lane = currentSnapshot.lanes.find((l) => l.lane === "WEST");
                return (
                  <div className="absolute left-0 right-[50%] h-10 border-t border-b border-slate-700/80 bg-slate-900 flex items-center justify-end pr-3 gap-1">
                    <span className="text-[10px] text-white font-bold leading-none">{lane ? lane.cumulativeTotal : 0}</span>
                    <div className="h-1.5 w-16 bg-slate-800 rounded-full flex items-center justify-end overflow-hidden border border-slate-800">
                      <div
                        className="bg-pink-500 h-full rounded-full"
                        style={{ width: `${lane ? lane.densityOccupancy : 0}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 font-black leading-none">W</span>
                  </div>
                );
              })()}
            </div>

            {/* Visual Footer labels */}
            <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-mono mt-2 z-10">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /> N approach</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> S approach</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> E approach</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-pink-500 rounded-full" /> W approach</span>
              </div>
              <span className="text-slate-500 text-[9px]">Heights/Widths represent density occupancy %</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. RAW LEDGER SPREADSHEET TABLE VIEW */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Ledger Interval Logs</h3>
            <p className="text-xs text-slate-500">Full structured matrix of parsed snapshots from the ledger CSV.</p>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3">Timestamp / Interval</th>
                <th className="px-5 py-3">Approach</th>
                <th className="px-5 py-3">Vehicle Breakdown Details (Cumulative Totals)</th>
                <th className="px-5 py-3 text-right">Cumulative Total</th>
                <th className="px-5 py-3 text-right">Road Occupancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {parsedData.snapshots.map((snap) => (
                <React.Fragment key={snap.timestamp}>
                  {/* First Lane Approach row with Timestamp */}
                  {snap.lanes.map((l, lIdx) => {
                    const vehiclesStr = Object.entries(l.vehicles)
                      .filter(([_, count]) => (count as number) > 0)
                      .map(([type, count]) => `${formatVehicleType(type)}: ${count}`)
                      .join(" • ");

                    return (
                      <tr key={`${snap.timestamp}-${l.lane}`} className="hover:bg-slate-50">
                        {lIdx === 0 ? (
                          <td className="px-5 py-3 font-extrabold text-slate-800 border-r border-slate-100/60" rowSpan={4}>
                            <div className="flex flex-col">
                              <span>{snap.timestamp.split(" ")[1] || snap.timestamp}</span>
                              <span className="text-[10px] text-slate-400 font-normal mt-0.5">{snap.timestamp.split(" ")[0]}</span>
                              <span className="text-[9px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 mt-2 font-mono w-max">
                                Sum: {snap.intersectionSum}
                              </span>
                            </div>
                          </td>
                        ) : null}
                        <td className="px-5 py-3">
                          <span className="font-extrabold text-slate-700">{l.lane}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-[11px] max-w-sm md:max-w-md lg:max-w-xl truncate" title={vehiclesStr}>
                          {vehiclesStr || "No vehicles recorded"}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-700 font-mono">
                          {l.cumulativeTotal}
                        </td>
                        <td className="px-5 py-3 text-right font-mono">
                          <div className="flex items-center justify-end gap-2">
                            <span>{l.densityOccupancy.toFixed(1)}%</span>
                            <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                              <div
                                className="bg-[#4E6290] h-full"
                                style={{ width: `${l.densityOccupancy}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )}
</div>
  );
}
