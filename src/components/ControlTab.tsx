import React, { useState, useEffect } from "react";
import { Lane, LightState, SystemMode } from "../types";
import { 
  Clock, 
  FileText, 
  AlertTriangle, 
  AlertOctagon, 
  Sliders, 
  Play, 
  Camera, 
  Sun, 
  CloudRain, 
  Activity, 
  Terminal, 
  Flame, 
  ShieldAlert,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  ArrowLeft
} from "lucide-react";

interface ControlTabProps {
  nodeIp: string;
  setNodeIp: (ip: string) => void;
  isNodeConnected: boolean;
  setIsNodeConnected: (connected: boolean) => void;
  mode: SystemMode;
  onChangeMode: (newMode: SystemMode) => void;
  activeLane: Lane;
  onSetLaneLight: (lane: Lane, state: LightState) => void;
  weather: "SUNNY" | "RAINY";
  lanes: Record<Lane, { count: number; density: number; light: LightState; los: string }>;
  weatherLocation: string;
  remainingSecs?: number;
}

export default function ControlTab({
  nodeIp,
  setNodeIp,
  isNodeConnected,
  setIsNodeConnected,
  mode,
  onChangeMode,
  activeLane,
  onSetLaneLight,
  weather,
  lanes,
  weatherLocation,
  remainingSecs = 0
}: ControlTabProps) {
  const [inputValue, setInputValue] = useState(nodeIp || "192.168.1.100");
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentDate, setCurrentDate] = useState("");

  // Local state to track image errors on video streams
  const [imageErrors, setImageErrors] = useState<Record<Lane, boolean>>({
    NORTH: false,
    SOUTH: false,
    EAST: false,
    WEST: false
  });

  const [trafficLogs, setTrafficLogs] = useState<string[]>(() => {
    const initialMsgs = [
      "STAP NODE: Local camera link speed optimal, frame rate stable at 24fps",
      "STAP NODE: Local camera link speed optimal, frame rate stable at 24fps",
      "STAP NODE: Local camera link speed optimal, frame rate stable at 24fps",
      "WEST: Queue length reached 65 meters; density rating 76%"
    ];
    return initialMsgs.map((msg, idx) => {
      const d = new Date(Date.now() - idx * 5000);
      const timeStr = d.toLocaleTimeString(undefined, { hour12: false });
      return `[${timeStr}] ${msg}`;
    });
  });

  const [lightLogs, setLightLogs] = useState<string[]>([]);

  const pythonStreamUrl = nodeIp && nodeIp.trim() ? `http://${nodeIp.trim()}:5000` : "http://localhost:5000";

  // Dynamic ticking date and clock
  useEffect(() => {
    const updateDate = () => {
      const d = new Date();
      setCurrentDate(d.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }) + " — " + d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }));
    };
    updateDate();
    const timer = setInterval(updateDate, 1000);
    return () => clearInterval(timer);
  }, []);

  // Soft trigger for image errors reset when IP changes
  useEffect(() => {
    setImageErrors({
      NORTH: false,
      SOUTH: false,
      EAST: false,
      WEST: false
    });
  }, [nodeIp]);

  // Seed initial traffic light logs & append on transition
  useEffect(() => {
    const time = new Date().toLocaleTimeString(undefined, { hour12: false });
    let text = "";
    if (mode === "HAZARD") {
      text = `[${time}] HAZARD: Flashing yellow warning lights activated.`;
    } else if (mode === "EMERGENCY") {
      text = `[${time}] EMERGENCY Override Active - Clearing all intersections for priority vehicle.`;
    } else {
      text = `[${time}] PHASE SWITCH: ${activeLane} lane signal set to GREEN (LOS: ${lanes[activeLane]?.los || "A"}).`;
    }
    setLightLogs(prev => [text, ...prev.slice(0, 15)]);
  }, [activeLane, mode, weather]);

  // Simulate real-time computer vision detection logs
  useEffect(() => {
    const messages = [
      "NORTH: Passenger sedan detected moving northbound at 42 km/h",
      "EAST: Continuous free-flow detected; standard clearance maintained",
      "SOUTH: Queue detected (9 vehicles); requesting signal priority",
      "WEST: Queue length reached 65 meters; density rating 76%",
      "NORTH: Lane occupancy dropped below 15%; queue cleared",
      "WEST: Standard delivery van registered moving westbound",
      "EAST: Level of Service A verified via background contour subtraction",
      "AI ENGINE: Dynamic phase optimization recalculating green times",
      "STAP NODE: Local camera link speed optimal, frame rate stable at 24fps"
    ];
    const interval = setInterval(() => {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      const time = new Date().toLocaleTimeString(undefined, { hour12: false });
      setTrafficLogs(prev => [`[${time}] ${randomMsg}`, ...prev.slice(0, 15)]);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setIsConnecting(true);
    setNodeIp(inputValue);
    
    try {
      const targetUrl = `http://${inputValue.trim()}:5000/status?hub_origin=${encodeURIComponent(window.location.origin)}`;
      const proxyUrl = `/api/v1/proxy-python-status?url=${encodeURIComponent(targetUrl)}`;
      const pingPromise = fetch(proxyUrl);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );
      
      const res = await Promise.race([pingPromise, timeoutPromise]) as Response;
      if (!res.ok) throw new Error("Proxy response not OK");
      
      setIsConnecting(false);
      setIsNodeConnected(true);
    } catch (err) {
      try {
        const res = await fetch("/api/v1/status");
        if (res.ok) {
          const data = await res.json();
          if (data.nodeOnline) {
            setIsConnecting(false);
            setIsNodeConnected(true);
            return;
          }
        }
      } catch (cloudErr) {
        console.error("Cloud status error in ControlTab:", cloudErr);
      }
      setIsConnecting(false);
      setIsNodeConnected(false);
    }
  };

  const handleManualLaneOverride = (lane: Lane) => {
    if (mode !== "MANUAL") return;
    onSetLaneLight(lane, "GREEN");
  };

  const getLaneBtnStyle = (lane: Lane) => {
    if (mode !== "MANUAL") {
      return "bg-white/40 border-teal-100/50 text-teal-800/40 cursor-not-allowed";
    }
    const laneLight = lanes[lane]?.light;
    if (laneLight === "GREEN") {
      return "bg-emerald-600 text-white border-emerald-700 shadow-sm font-black ring-2 ring-emerald-600/30 cursor-pointer";
    }
    if (laneLight === "YELLOW") {
      return "bg-amber-500 animate-pulse text-white border-amber-600 font-black shadow-sm ring-2 ring-amber-500/30 cursor-pointer";
    }
    const isAnyOtherLaneGreen = Object.entries(lanes).some(
      ([key, val]) => key !== lane && val.light === "GREEN"
    );
    if (activeLane === lane && !isAnyOtherLaneGreen) {
      return "bg-amber-600/80 animate-pulse text-white border-amber-500 font-black shadow-sm ring-2 ring-amber-600/20 cursor-pointer";
    }
    return "bg-[#115E59] text-white border-teal-800 hover:bg-teal-800 cursor-pointer";
  };

  const getLaneDot = (lane: Lane) => {
    if (mode !== "MANUAL") return null;
    const laneLight = lanes[lane]?.light;
    if (laneLight === "GREEN") return " ● GO";
    if (laneLight === "YELLOW") return " ⚠️ CLR";
    const isAnyOtherLaneGreen = Object.entries(lanes).some(
      ([key, val]) => key !== lane && val.light === "GREEN"
    );
    if (activeLane === lane && !isAnyOtherLaneGreen) return " ⏳ WAIT";
    return " ●";
  };

  const isHazardEnabled = mode === "MANUAL" || mode === "HAZARD";
  const isHazardActive = mode === "HAZARD";

  const isEmergencyEnabled = mode === "MANUAL" || mode === "EMERGENCY";
  const isEmergencyActive = mode === "EMERGENCY";

  return (
    <div className="space-y-6" id="control-tab">
      
      {/* SECTION 1: Live intersection footage, logs, and analytics with inline Date/Time */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-200 gap-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest shrink-0">
          Live intersection footage, logs, and analytics
        </h3>
        <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-3xs flex items-center gap-2 self-stretch sm:self-auto justify-center">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-bold font-mono text-slate-600">
            {currentDate || "Loading timestamp..."}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 Columns: 2x2 Grid with exact sequence of NORTH, EAST, SOUTH, WEST footage */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["NORTH", "EAST", "SOUTH", "WEST"] as Lane[]).map((ln) => {
            let currentLightState: LightState = "RED";
            if (mode === "HAZARD") {
              currentLightState = "YELLOW";
            } else if (activeLane === ln && (mode === "AUTO" || mode === "MANUAL")) {
              currentLightState = "GREEN";
            }
            const isGreen = currentLightState === "GREEN";

            return (
              <div 
                key={ln} 
                className="bg-slate-900 aspect-video rounded-2xl relative flex flex-col items-center justify-center border border-slate-800 shadow-md overflow-hidden text-center bg-slate-950 select-none group"
              >
                {/* Visual Label Tag */}
                <div className="absolute top-3 left-3 bg-[#0F172A]/90 text-slate-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded border border-slate-700/30 z-10 shadow-sm flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isNodeConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                  }`} />
                  Footage {ln.charAt(0) + ln.slice(1).toLowerCase()}
                </div>

                {/* Info summary on hover */}
                {isNodeConnected && (
                  <div className="absolute bottom-3 left-3 bg-[#0F172A]/95 text-slate-300 text-[9px] font-mono px-2 py-1 rounded border border-slate-700/20 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Density: {lanes[ln]?.density}% | Count: {lanes[ln]?.count} | LOS: {lanes[ln]?.los}
                  </div>
                )}

                {/* CCTV Stream Container */}
                {!isNodeConnected ? (
                  <div className="space-y-1.5 z-10 p-6">
                    <div className="h-9 w-9 bg-slate-800/40 rounded-full flex items-center justify-center text-slate-500 mx-auto border border-slate-700/20">
                      <Camera className="h-4.5 w-4.5 opacity-40" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Camera Feed Offline</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center relative">
                    {/* Real-time direct MJPEG feed (without traffic light indicator over preview) */}
                    <img
                      src={`${pythonStreamUrl}/video_feed/${ln.toLowerCase()}`}
                      alt={`Footage ${ln}`}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                      style={{ display: imageErrors[ln] ? "none" : "block" }}
                      onError={() => {
                        setImageErrors(prev => ({ ...prev, [ln]: true }));
                      }}
                      onLoad={() => {
                        setImageErrors(prev => ({ ...prev, [ln]: false }));
                      }}
                    />

                    {/* Fallback visual state if stream cannot be directly reached */}
                    {imageErrors[ln] && (
                      <div className="z-10 p-6 text-center space-y-2">
                        <div className="text-[10px] font-black text-emerald-400 flex items-center justify-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-full border border-emerald-500/20 mx-auto w-fit">
                          <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
                          LIVE INGREST SECURE
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 bg-slate-950/90 p-2 rounded-xl border border-slate-800/50 max-w-[220px] mx-auto leading-relaxed">
                          Phase State:{" "}
                          <span className={`px-1.5 py-0.5 rounded font-black ${
                            isGreen
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {currentLightState}
                          </span>
                          <div className="text-[8px] text-slate-500 mt-1">Density index: {lanes[ln]?.density}% (LOS: {lanes[ln]?.los})</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right 4 Columns: System Status & Vehicle Counts */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* System Status & Vehicle Counts Block */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col gap-4 shadow-3xs">
            {/* Header: SYSTEM STATUS */}
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">
                System Status
              </div>
              
              {/* Status List */}
              <div className="space-y-2 text-[11px] font-sans">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">Active Lane</span>
                  <span className="font-extrabold text-slate-800">{activeLane}</span>
                </div>
                
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">Signal</span>
                  {(() => {
                    const currentLight = lanes[activeLane]?.light || "GREEN";
                    let bgCol = "bg-emerald-100 text-emerald-800 border-emerald-200";
                    if (currentLight === "YELLOW") bgCol = "bg-amber-100 text-amber-800 border-amber-200";
                    if (currentLight === "RED") bgCol = "bg-rose-100 text-rose-800 border-rose-200";
                    return (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border ${bgCol}`}>
                        {currentLight}
                      </span>
                    );
                  })()}
                </div>
                
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">Remaining</span>
                  <span className="font-extrabold text-slate-800">{remainingSecs}s</span>
                </div>
                
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">Mode</span>
                  <span className="font-extrabold text-slate-800">{mode}</span>
                </div>
                
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">Rain</span>
                  <span className="font-extrabold text-slate-800 flex items-center gap-1">
                    {weather === "RAINY" ? (
                      <>
                        <CloudRain className="h-3 w-3 text-blue-500 shrink-0" />
                        <span>Rain</span>
                      </>
                    ) : (
                      <>
                        <Sun className="h-3 w-3 text-amber-500 shrink-0" />
                        <span>Clear</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Header: VEHICLE COUNTS */}
            <div className="mt-2 border-t border-slate-100 pt-3">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Vehicle Counts
              </div>
              <div className="divide-y divide-slate-100/80">
                {(["NORTH", "SOUTH", "EAST", "WEST"] as Lane[]).map((ln) => {
                  const count = lanes[ln]?.count ?? 0;
                  const los = lanes[ln]?.los ?? "A";
                  
                  // Color-coding for LOS matches standard and screenshots
                  let losColor = "text-emerald-600";
                  if (los === "D") {
                    losColor = "text-[#B45309]"; // Amber/brown
                  } else if (los === "E" || los === "F") {
                    losColor = "text-[#B91C1C]"; // Red/rose
                  } else if (los === "C") {
                    losColor = "text-[#D97706]"; // Yellow-orange
                  }

                  return (
                    <div key={ln} className="flex items-center justify-between py-2 text-[11px] font-sans">
                      <span className="font-extrabold text-slate-500 tracking-wider">
                        {ln}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-slate-800">
                          {count} vehicles
                        </span>
                        <span className={`font-black ${losColor} w-[42px] text-right`}>
                          LOS {los}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* SECTION 2: Control */}
      <div className="flex items-center gap-4 my-6">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest shrink-0">
          Control
        </h3>
        <div className="flex-1 border-t border-slate-200"></div>
      </div>

      {/* Control row split into 2 massive functional blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 6 Columns: STAP Node control panel (Teal Theme) */}
        <div className="lg:col-span-6 bg-[#E2F1F1]/70 border border-teal-200/60 rounded-3xl p-6 shadow-3xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-black text-teal-900 uppercase tracking-widest">
                  STAP Node control panel
                </h4>
                <p className="text-[10px] text-teal-700 font-bold font-mono">System mode & direct manual lane override</p>
              </div>
              <span className="text-[8px] font-mono bg-teal-200/50 text-teal-800 px-2 py-0.5 rounded font-bold uppercase">
                Active Node: {nodeIp || "Simulated Node"}
              </span>
            </div>

            {/* 1x2 Grid of System Modes */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              
              {/* AI MODE */}
              <button
                type="button"
                onClick={() => onChangeMode("AUTO")}
                className={`p-3.5 rounded-xl flex items-center gap-2.5 border text-left transition-all cursor-pointer ${
                  mode === "AUTO"
                    ? "bg-blue-600 border-blue-700 text-white font-bold shadow-md scale-[1.02]"
                    : "bg-white border-teal-100 text-teal-800 hover:bg-teal-50/50"
                }`}
              >
                <Clock className={`h-4.5 w-4.5 ${mode === "AUTO" ? "text-blue-200" : "text-blue-600"}`} />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider">AI Mode</div>
                  <div className={`text-[8px] font-mono leading-tight ${mode === "AUTO" ? "text-blue-100/90" : "text-teal-600/70"}`}>YOLO Adaptive</div>
                </div>
              </button>

              {/* MANUAL MODE */}
              <button
                type="button"
                onClick={() => onChangeMode("MANUAL")}
                className={`p-3.5 rounded-xl flex items-center gap-2.5 border text-left transition-all cursor-pointer ${
                  mode === "MANUAL"
                    ? "bg-white border-teal-600 text-teal-900 font-black shadow-md scale-[1.02] ring-2 ring-teal-600/20"
                    : "bg-white/50 border-teal-100/70 text-teal-800/70 hover:bg-white hover:text-teal-800 hover:border-teal-200"
                }`}
              >
                <FileText className={`h-4.5 w-4.5 ${mode === "MANUAL" ? "text-teal-600 font-bold" : "text-teal-400"}`} />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider">Manual</div>
                  <div className={`text-[8px] font-mono leading-tight ${mode === "MANUAL" ? "text-teal-800/80 font-bold" : "text-teal-600/50"}`}>Direct Override</div>
                </div>
              </button>

            </div>

            {/* Lane Overrides Box */}
            <div className="border-t border-teal-200/50 pt-4">
              <span className="text-[9px] text-teal-800/80 font-black uppercase tracking-widest block text-center mb-4">
                Manual Overrides: Lane Controller & Safety Alerts (Manual Mode Only)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Left Side: Lane Controller */}
                <div className="space-y-3">

                  <div className="flex flex-col items-center gap-1.5">
                    {/* North Button */}
                    <button
                      type="button"
                      disabled={mode !== "MANUAL"}
                      onClick={() => handleManualLaneOverride("NORTH")}
                      className={`w-28 py-2 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${getLaneBtnStyle("NORTH")}`}
                    >
                      <ArrowUp className="h-3 w-3" />
                      North{getLaneDot("NORTH")}
                    </button>

                    {/* West / East Button Row */}
                    <div className="flex items-center gap-2 justify-center w-full">
                      <button
                        type="button"
                        disabled={mode !== "MANUAL"}
                        onClick={() => handleManualLaneOverride("WEST")}
                        className={`w-28 py-2 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${getLaneBtnStyle("WEST")}`}
                      >
                        <ArrowLeft className="h-3 w-3" />
                        West{getLaneDot("WEST")}
                      </button>

                      <div className="w-10 text-center text-[8px] text-teal-800 font-mono font-black uppercase select-none opacity-60">
                        LANE
                      </div>

                      <button
                        type="button"
                        disabled={mode !== "MANUAL"}
                        onClick={() => handleManualLaneOverride("EAST")}
                        className={`w-28 py-2 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${getLaneBtnStyle("EAST")}`}
                      >
                        East{getLaneDot("EAST")}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    {/* South Button */}
                    <button
                      type="button"
                      disabled={mode !== "MANUAL"}
                      onClick={() => handleManualLaneOverride("SOUTH")}
                      className={`w-28 py-2 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${getLaneBtnStyle("SOUTH")}`}
                    >
                      South{getLaneDot("SOUTH")}
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Right Side: Safety & Alert Overrides */}
                <div className="space-y-3">
                  
                  <div className="flex flex-col gap-3">
                    {/* HAZARD MODE */}
                    <button
                      type="button"
                      disabled={!isHazardEnabled}
                      onClick={() => {
                        if (isHazardActive) {
                          onChangeMode("MANUAL");
                        } else {
                          onChangeMode("HAZARD");
                        }
                      }}
                      className={`p-3.5 rounded-xl flex items-center gap-2.5 border text-left transition-all ${
                        isHazardActive
                          ? "bg-amber-600 border-amber-700 text-white font-bold shadow-sm scale-[1.02] cursor-pointer"
                          : !isHazardEnabled
                          ? "bg-white/40 border-teal-100/50 text-teal-800/40 cursor-not-allowed"
                          : "bg-white border-teal-100 text-teal-800 hover:bg-[#FFFDF5] hover:border-amber-200 cursor-pointer"
                      }`}
                    >
                      <AlertTriangle className={`h-4.5 w-4.5 shrink-0 ${
                        !isHazardEnabled ? "text-teal-600/30" : isHazardActive ? "text-amber-200" : "text-amber-600"
                      }`} />
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider">Hazard</div>
                        <div className={`text-[8px] font-mono leading-tight ${
                          !isHazardEnabled ? "text-teal-600/30" : isHazardActive ? "text-amber-100/90" : "text-teal-600/70"
                        }`}>Flashing Yellow</div>
                      </div>
                    </button>

                    {/* EMERGENCY MODE */}
                    <button
                      type="button"
                      disabled={!isEmergencyEnabled}
                      onClick={() => {
                        if (isEmergencyActive) {
                          onChangeMode("MANUAL");
                        } else {
                          onChangeMode("EMERGENCY" as SystemMode);
                        }
                      }}
                      className={`p-3.5 rounded-xl flex items-center gap-2.5 border text-left transition-all ${
                        isEmergencyActive
                          ? "bg-rose-600 border-rose-700 text-white font-bold animate-pulse shadow-sm scale-[1.02] cursor-pointer"
                          : !isEmergencyEnabled
                          ? "bg-white/40 border-teal-100/50 text-teal-800/40 cursor-not-allowed"
                          : "bg-white border-teal-100 text-teal-800 hover:bg-[#FFF5F5] hover:border-rose-200 cursor-pointer"
                      }`}
                    >
                      <AlertOctagon className={`h-4.5 w-4.5 shrink-0 ${
                        !isEmergencyEnabled ? "text-teal-600/30" : isEmergencyActive ? "text-rose-200" : "text-rose-600"
                      }`} />
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider">Emergency</div>
                        <div className={`text-[8px] font-mono leading-tight ${
                          !isEmergencyEnabled ? "text-teal-600/30" : isEmergencyActive ? "text-rose-100/90" : "text-teal-600/70"
                        }`}>Full Red Alert</div>
                      </div>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Connected stats metrics */}
          <div className="flex justify-between items-center text-[8px] text-teal-800/70 font-mono mt-4 pt-3 border-t border-teal-200/40">
            <span>Status: {isNodeConnected ? "Connected" : "Simulated Local"}</span>
            <span>Active Phase: {activeLane}</span>
          </div>
        </div>

        {/* Right 6 Columns: Traffic light logs (Slate Blue / Gray Theme) */}
        <div className="lg:col-span-6 bg-[#F1F5F9]/80 border border-slate-300/60 rounded-3xl p-6 shadow-3xs flex flex-col justify-between h-[320px] lg:h-auto">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-slate-700 animate-pulse" />
                  Traffic light logs
                </h4>
                <p className="text-[10px] text-slate-500 font-bold font-mono">Phase sequence records & mode transitions</p>
              </div>
              <span className="text-[8px] font-mono bg-slate-300/50 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">
                System Log
              </span>
            </div>

            {/* Scrollable logs box */}
            <div className="space-y-1.5 max-h-[190px] overflow-y-auto font-mono text-[9px] text-slate-700 pr-1 select-text scrollbar-thin">
              {lightLogs.length === 0 ? (
                <div className="text-slate-400 italic text-center py-8">No phase logs generated yet.</div>
              ) : (
                lightLogs.map((log, index) => (
                  <div key={index} className="pb-1 border-b border-slate-200/50 last:border-0 leading-relaxed font-bold">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-[8px] text-slate-500 font-mono pt-3 border-t border-slate-200/80 flex justify-between items-center mt-3">
            <span>Region: Mayor Gil Fernando Ave / Sumulong Hwy</span>
            <span>Logger Sync: Persistent</span>
          </div>
        </div>

      </div>

    </div>
  );
}
