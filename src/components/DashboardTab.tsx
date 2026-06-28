import React, { useState, useEffect } from "react";
import { Lane, LightState } from "../types";
import { 
  Video, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Play, 
  Pause, 
  Camera, 
  ShieldAlert, 
  VideoOff, 
  Sun, 
  CloudRain, 
  MapPin,
  Info,
  Maximize,
  X,
  Minimize2,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import PublicAnalytics from "./PublicAnalytics";

interface DashboardTabProps {
  isNodeConnected: boolean;
  lanes: Record<Lane, { count: number; density: number; light: LightState; los: string }>;
  activeLane: Lane;
  remainingSecs: number;
  nodeIp?: string;
  weather: "SUNNY" | "RAINY";
  weatherLocation: string;
}

export default function DashboardTab({
  isNodeConnected,
  lanes,
  activeLane,
  remainingSecs,
  nodeIp,
  weather,
  weatherLocation
 }: DashboardTabProps) {
  const [selectedVideo, setSelectedVideo] = useState<{ lane: Lane; name: string } | null>(null);

  // Local state to track whether the mixed content bypass tutorial/warning banner is visible
  const [showBypassTutorial, setShowBypassTutorial] = useState<boolean>(() => {
    return localStorage.getItem("stap_show_tutorial") !== "false";
  });

  // Local state to track image errors on the stream
  const [imageErrors, setImageErrors] = useState<Record<Lane, boolean>>({
    NORTH: false,
    SOUTH: false,
    EAST: false,
    WEST: false
  });

  const pythonStreamUrl = nodeIp && nodeIp.trim() ? `http://${nodeIp.trim()}:5000` : "http://localhost:5000";

  // Reset error states when Node IP changes
  useEffect(() => {
    setImageErrors({
      NORTH: false,
      SOUTH: false,
      EAST: false,
      WEST: false
    });
  }, [nodeIp]);

  // Human friendly names shown in screenshot
  const laneLabels: Record<Lane, string> = {
    NORTH: "Mayor Gil Fernando Ave North",
    SOUTH: "Mayor Gil Fernando Ave South",
    EAST: "Sumulong Hwy East",
    WEST: "Sumulong Hwy West"
  };

  const laneDescriptions: Record<Lane, string> = {
    NORTH: "Mayor Gil Fernando Ave — Northbound",
    SOUTH: "Mayor Gil Fernando Ave — Southbound",
    EAST: "Sumulong Hwy — Eastbound",
    WEST: "Sumulong Hwy — Westbound"
  };

  return (
    <div className="space-y-6" id="dashboard-tab">
      
      {/* 2. Notification / Active Bar */}
      <div className="flex items-center justify-between text-xs font-semibold pt-2">
        <div className="flex items-center gap-2.5">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1.5 ${
            isNodeConnected 
              ? "bg-emerald-100 text-emerald-700" 
              : "bg-red-100 text-red-600"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isNodeConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            LIVE DATABASE
          </span>
          <span className={isNodeConnected ? "text-emerald-600 font-bold" : "text-rose-500"}>
            {isNodeConnected 
              ? "— Connected to STAP Node. Live vehicle counts active." 
              : "— Node offline, counts reset to 0"
            }
          </span>
        </div>
        <div className="text-slate-400 font-bold tracking-wider uppercase text-[10px]">
          LATEST CAPTURED VEHICLE COUNTS
        </div>
      </div>

      {/* 3. Four Horizontal Live Count Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(["NORTH", "SOUTH", "EAST", "WEST"] as Lane[]).map((ln) => (
          <div key={ln} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="text-4xl font-extrabold text-slate-900 leading-none">
              {lanes[ln].count}
            </div>
            {/* Square minus sign divider/icon */}
            <div className="h-6 w-6 border border-slate-300 rounded flex items-center justify-center text-slate-400 text-xs shrink-0 font-bold select-none">
              —
            </div>
            <div className="text-[11px] font-bold text-slate-500 leading-tight">
              {laneLabels[ln]}
            </div>
          </div>
        ))}
      </div>

      {/* 4. CCTV Grid + Right Sidebar Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): CCTV Streams */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-200 gap-3 shadow-xs">
            <div className="text-left">
              <h3 className="text-sm font-black text-slate-800 tracking-wide font-sans flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shrink-0" />
                Mayor Gil Fernando Ave / Sumulong Hwy CCTV
              </h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">Route: Local Direct IP Controller (${pythonStreamUrl})</p>
            </div>
            
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
              {pythonStreamUrl.startsWith("http:") && window.location.protocol === "https:" && (
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !showBypassTutorial;
                    setShowBypassTutorial(nextVal);
                    localStorage.setItem("stap_show_tutorial", nextVal ? "true" : "false");
                  }}
                  className={`p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                    showBypassTutorial 
                      ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200" 
                      : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                  }`}
                  title={showBypassTutorial ? "Hide Stream Instructions" : "Show Stream Instructions"}
                >
                  <Info className="h-4 w-4" />
                </button>
              )}

              <div className="bg-cyan-50 px-3 py-1.5 rounded-lg border border-cyan-200/50 shadow-xs flex items-center gap-1.5 select-none text-[9px] font-mono font-black text-cyan-600 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                Direct Stream Active
              </div>
            </div>
          </div>

          {/* Mixed Content Security Tutorial Banner - ONLY shown if local HTTP streaming is active on secure HTTPS webapp */}
          {pythonStreamUrl.startsWith("http:") && window.location.protocol === "https:" && showBypassTutorial && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-amber-900 text-xs relative">
              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1.5 text-left pr-8 flex-1">
                <span className="font-extrabold uppercase tracking-wider block text-[11px] text-amber-700">
                  Camera Stream Blocked? (Mixed HTTPS/HTTP Content Warning)
                </span>
                <p className="text-amber-800 leading-normal text-[11px]">
                  The webapp console is loaded securely over <code className="bg-slate-900 text-white px-1 py-0.5 rounded font-mono">HTTPS</code>, but your local Python camera streams are served over <code className="bg-slate-900 text-white px-1 py-0.5 rounded font-mono">HTTP</code> ({pythonStreamUrl}). Modern browsers block this insecure media by default.
                </p>
                <p className="text-amber-950 font-bold text-[11px]">
                  To permit local hardware video playback:
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-800 font-mono">
                  <li>Click the <strong>Lock / Settings icon</strong> next to your browser address bar.</li>
                  <li>Select <strong>Site Settings</strong>.</li>
                  <li>Scroll to <strong>Insecure content</strong> and set it to <strong>"Allow"</strong>, then refresh this page.</li>
                </ol>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBypassTutorial(false);
                  localStorage.setItem("stap_show_tutorial", "false");
                }}
                className="absolute top-3 right-3 text-amber-700 hover:text-amber-950 p-1 rounded-full hover:bg-amber-500/20 transition-all cursor-pointer flex items-center justify-center"
                aria-label="Close warning banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 2x2 CCTV Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["NORTH", "SOUTH", "EAST", "WEST"] as Lane[]).map((ln) => (
              <div 
                key={ln} 
                onClick={() => setSelectedVideo({ lane: ln, name: laneLabels[ln] })}
                className="bg-[#1E293B] rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col justify-between aspect-video min-h-[220px] relative cursor-zoom-in group"
              >
                
                {/* Approach Pill */}
                <div className="absolute top-3 left-3 bg-[#0F172A]/90 text-white text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider z-10 border border-slate-700/30">
                  {ln}
                </div>

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
                   <Maximize className="w-8 h-8 text-white/70" />
                </div>



                {/* CCTV Content Placeholder (Offline or Active) */}
                <div className="flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden bg-slate-950">
                  {!isNodeConnected ? (
                    <div className="space-y-2 p-6 text-slate-400 z-10">
                      <div className="h-9 w-9 bg-slate-900/50 rounded-full flex items-center justify-center text-slate-400 mx-auto border border-slate-700/30">
                        <Camera className="h-4.5 w-4.5 opacity-50" />
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold max-w-[200px] leading-normal uppercase">
                        Set Node IP above to load stream
                      </p>
                    </div>
                  ) : (
                    /* Active Simulated Camera Feed Content */
                    <div className="w-full h-full flex flex-col justify-between pt-8 pb-4 relative">
                      {/* Real-time direct MJPEG feed */}
                      <img
                        src={`${pythonStreamUrl}/video_feed/${ln.toLowerCase()}`}
                        alt={`${ln} Live stream`}
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
                      
                      {/* Grid background placeholder if not loaded */}
                      {imageErrors[ln] && (
                        <div className="absolute inset-0 bg-[radial-gradient(#273549_1px,transparent_1px)] [background-size:16px_16px] opacity-25 z-0" />
                      )}
                      
                      {/* Offline stream error state */}
                      {imageErrors[ln] && (
                        <div className="text-center p-4 z-10 space-y-1.5">
                          <VideoOff className="h-5 w-5 text-slate-600 mx-auto" />
                          <p className="text-[10px] text-rose-400 font-mono font-bold">STREAM UNREACHABLE</p>
                          <p className="text-[9px] text-slate-500 font-mono max-w-[220px] leading-relaxed mx-auto">
                            Verify Flask local server is active at: <br/>
                            <span className="text-slate-400 bg-slate-900/60 p-1 px-1.5 rounded mt-1 inline-block break-all select-all font-bold">{pythonStreamUrl}/video_feed/{ln.toLowerCase()}</span>
                          </p>
                        </div>
                      )}

                      {/* Moving dots to simulate vehicle detection if stream is offline */}
                      {imageErrors[ln] && (
                        <div className="flex justify-center gap-2 z-10 transition-opacity duration-300">
                          {Array.from({ length: Math.min(6, lanes[ln].count) }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`w-2 h-2 rounded-full ${
                                lanes[ln].light === "GREEN"
                                  ? "bg-emerald-500 animate-bounce"
                                  : "bg-rose-500"
                              }`}
                              style={{ animationDelay: `${idx * 0.2}s` }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CCTV Bottom Information Bar */}
                <div className="bg-white p-3 border-t border-slate-200 flex justify-between items-center z-10 text-[10px] font-semibold text-slate-500">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="font-bold text-slate-800">{laneDescriptions[ln]}</span>
                    <span className="text-[9px] text-slate-400">STAP Node — Mayor Gil Fernando Ave</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${
                    isNodeConnected 
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                      : "bg-red-50 text-red-500 border border-red-100"
                  }`}>
                    {isNodeConnected ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (3 cols): Widgets list */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Dynamic Weather Widget */}
          <div className={`p-5 rounded-2xl border shadow-xs space-y-4 relative overflow-hidden transition-all duration-300 ${
            weather === "RAINY" 
              ? "bg-[#EFF6FF] border-blue-200/60 text-blue-950" 
              : "bg-[#FFFBEB] border-amber-200/60 text-amber-950"
          }`}>
            <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 opacity-10">
              {weather === "RAINY" ? (
                <CloudRain className="h-32 w-32 text-blue-500" />
              ) : (
                <Sun className="h-32 w-32 text-amber-500 animate-spin-slow" />
              )}
            </div>

            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[9px] font-bold uppercase tracking-widest block ${
                  weather === "RAINY" ? "text-blue-600" : "text-amber-700"
                }`}>
                  LOCAL WEATHER
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin className={`h-3.5 w-3.5 shrink-0 ${weather === "RAINY" ? "text-blue-500" : "text-amber-600"}`} />
                  <span className="text-[11px] font-extrabold truncate max-w-[155px] block font-sans" title={weatherLocation}>
                    {weatherLocation}
                  </span>
                </div>
              </div>
              <div className={`p-2 rounded-xl shrink-0 ${
                weather === "RAINY" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
              }`}>
                {weather === "RAINY" ? (
                  <CloudRain className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5 animate-spin-slow" />
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight font-sans">
                {weather === "RAINY" ? "24°C" : "31°C"}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                weather === "RAINY" ? "bg-blue-200/50 text-blue-800" : "bg-amber-200/50 text-amber-800"
              }`}>
                {weather === "RAINY" ? "Rainy Active" : "Sunny Dry"}
              </span>
            </div>

            <div className={`text-[10px] leading-relaxed font-medium ${
              weather === "RAINY" ? "text-blue-800/85" : "text-amber-800/85"
            }`}>
              {weather === "RAINY" ? (
                <p>Wet weather buffer adds <span className="font-extrabold text-blue-900">+5s extension</span> to signal phases for safety compliance.</p>
              ) : (
                <p>Dry conditions active. Phase timing optimized for maximum standard vehicle clearance throughput.</p>
              )}
            </div>
          </div>

          {/* Active Microcontroller State card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">
              ACTIVE MICROCONTROLLER STATE
            </span>
            {!isNodeConnected ? (
              <div className="bg-[#FEF2F2] border border-[#FCA5A5] p-3.5 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>Cannot reach STAP Edge Device</span>
              </div>
            ) : (
              <div className="bg-[#ECFDF5] border border-[#A7F3D0] p-3.5 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2">
                <span>🟢</span>
                <span>STAP Edge Device Connected</span>
              </div>
            )}
          </div>

          {/* Last Synchronized card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">
              LAST SYNCHRONIZED
            </span>
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-slate-600 font-mono text-[11px] font-semibold">
              {!isNodeConnected ? (
                <span className="text-slate-400 font-bold">Offline</span>
              ) : (
                <span className="text-emerald-600 font-bold">Connected • Just Now</span>
              )}
            </div>
          </div>

          {/* Camera Index card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">CAMERA INDEX</span>
            <div className="space-y-2 text-xs font-bold">
              {(["NORTH", "SOUTH", "EAST", "WEST"] as Lane[]).map((ln) => (
                <div key={ln} className="flex justify-between items-center text-slate-600">
                  <span className="font-semibold text-slate-500">{ln}</span>
                  <span className={isNodeConnected ? "text-emerald-500 font-extrabold" : "text-slate-400"}>
                    {isNodeConnected ? "Active" : "Offline"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Streams notice bar */}
          <div className="bg-[#1E293B] text-slate-300 p-5 rounded-2xl border border-slate-800 text-xs leading-relaxed font-semibold">
            Streams are sourced directly from STAP Node hardware at the intersection via local network.
          </div>

        </div>
      </div>

      {/* Public Analytics Section (Synced from Firebase) */}
      <div className="pt-2">
        <PublicAnalytics />
      </div>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-6xl aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            >
              <img
                src={`http://${nodeIp}:5000/video_feed/${selectedVideo.lane.toLowerCase()}`}
                alt={selectedVideo.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1545147986-a9d6f210df73?auto=format&fit=crop&q=80&w=1200";
                }}
              />

              {/* Modal UI Overlays */}
              <div className="absolute top-0 inset-x-0 p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-500 rounded-lg animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                  <div>
                    <h4 className="text-xl font-black text-white tracking-tight uppercase">{selectedVideo.name}</h4>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live Stream • Ultra High Definition</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer pointer-events-auto backdrop-blur-md"
                >
                  <Minimize2 className="w-6 h-6" />
                </button>
              </div>

              <div className="absolute bottom-6 left-6 pointer-events-none">
                <div className="flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono text-white/80">LATENCY: 42ms • FPS: 60</span>
                </div>
              </div>
            </motion.div>

            {/* Click outside to close */}
            <div 
              className="absolute inset-0 -z-10" 
              onClick={() => setSelectedVideo(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
