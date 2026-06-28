import React, { useState, useEffect, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  Activity, 
  BarChart2, 
  Clock, 
  Car, 
  Database,
  ArrowUpRight,
  Info
} from "lucide-react";
import { getFirebaseInstances } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { parseTrafficCSV, ParsedTrafficData } from "../utils/csvParser";

const formatVehicleType = (type: string): string => {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Car Sedan Suv", "Sedan / SUV")
    .replace("E Trike", "E-Trike")
    .replace("Modern Jeepney", "Modern Jeepney")
    .replace("Traditional Jeepney", "Traditional Jeepney");
};

export default function PublicAnalytics() {
  const [latestLedger, setLatestLedger] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { db } = getFirebaseInstances();
    if (!db) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, "ledgers"), orderBy("uploadedAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLatestLedger(snapshot.docs[0].data());
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore public analytics error:", error);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const parsedData = useMemo<ParsedTrafficData | null>(() => {
    if (!latestLedger?.csvData) return null;
    try {
      return parseTrafficCSV(latestLedger.csvData);
    } catch (err) {
      console.error("Failed to parse latest ledger:", err);
      return null;
    }
  }, [latestLedger]);

  const stats = useMemo(() => {
    if (!parsedData) return null;

    const totalVehicles = parsedData.finalSummary?.corridorTotals?.grandUniqueCount || 
      (parsedData.snapshots.length > 0 ? parsedData.snapshots[parsedData.snapshots.length - 1].intersectionSum : 0);

    const vehicleCounts: { [type: string]: number } = {};
    if (parsedData.finalSummary?.corridorTotals) {
      Object.entries(parsedData.finalSummary.corridorTotals.vehicles).forEach(([type, count]) => {
        vehicleCounts[type] = count as number;
      });
    } else if (parsedData.snapshots.length > 0) {
      const lastSnap = parsedData.snapshots[parsedData.snapshots.length - 1];
      lastSnap.lanes.forEach((l) => {
        Object.entries(l.vehicles).forEach(([type, count]) => {
          vehicleCounts[type] = (vehicleCounts[type] || 0) + (count as number);
        });
      });
    }

    const distributionData = Object.entries(vehicleCounts)
      .map(([name, value]) => ({
        name: formatVehicleType(name),
        value
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    let maxDensity = 0;
    let peakLane = "—";
    if (parsedData.snapshots.length > 0) {
      parsedData.snapshots.forEach((snap) => {
        snap.lanes.forEach((l) => {
          if (l.densityOccupancy > maxDensity) {
            maxDensity = l.densityOccupancy;
            peakLane = l.lane;
          }
        });
      });
    }

    return {
      totalVehicles,
      distributionData,
      peakLane,
      maxDensity: maxDensity.toFixed(1),
      lastUpdated: latestLedger?.uploadedAt ? new Date(latestLedger.uploadedAt).toLocaleString() : "—"
    };
  }, [parsedData, latestLedger]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center space-y-4">
        <Database className="h-8 w-8 text-slate-300 animate-pulse" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Historical Analytics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <BarChart2 className="h-8 w-8 text-slate-200 mx-auto" />
        <h4 className="text-sm font-bold text-slate-700">No Historical Data Available</h4>
        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">Analytics will appear here once the first STAP node ledger is synced to the cloud database.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#4E6290]" />
            <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">Historical Traffic Analytics</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium">Aggregated traffic metrics from the latest synchronized node ledger.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Sync: {stats.lastUpdated}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        {/* Key Metrics */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-1">Total Vehicles Logged</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalVehicles}</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <ArrowUpRight className="h-3 w-3" />
                  Captured
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-1">Peak Congestion Point</span>
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-800">{stats.peakLane}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-medium">Max Density:</span>
                  <span className="text-[10px] font-black text-rose-600">{stats.maxDensity}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-rose-500 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.min(100, parseFloat(stats.maxDensity))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex gap-3">
            <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
              These metrics represent the absolute traffic matrix compiled during the most recent operational session of the STAP edge controller.
            </p>
          </div>
        </div>

        {/* Chart Visualization */}
        <div className="lg:col-span-2 p-6 flex flex-col">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-4">Vehicle Type Distribution</span>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.distributionData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={110}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
                          <p className="text-[10px] font-black text-slate-700">{payload[0].name}</p>
                          <p className="text-xs font-black text-[#4E6290]">{payload[0].value} Units</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                  {stats.distributionData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? '#4E6290' : index === 1 ? '#6366f1' : '#94a3b8'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-[#4E6290] rounded-sm" />
              <span>Primary</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-[#6366f1] rounded-sm" />
              <span>Secondary</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-[#94a3b8] rounded-sm" />
              <span>Others</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
