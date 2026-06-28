import { Activity, Cpu, Wifi, WifiOff, Sun, Moon, CloudRain, ShieldCheck, LogOut, Database, CloudLightning } from "lucide-react";
import { User, SystemMode } from "../types";

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  nodeOnline: boolean;
  weather: "SUNNY" | "RAINY";
  mode: SystemMode;
  onToggleWeather: () => void;
  firebaseConnected: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export default function Header({
  currentUser,
  onLogout,
  nodeOnline,
  weather,
  mode,
  onToggleWeather,
  firebaseConnected,
  theme,
  onToggleTheme
}: HeaderProps) {
  return (
    <header id="stap-header" className="bg-slate-900 border-b border-slate-800 text-white py-3 px-6 flex flex-wrap justify-between items-center gap-4">
      {/* Visual Identity Title */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500 text-slate-950 p-2 rounded-lg flex items-center justify-center font-bold tracking-wider">
          <Activity className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-100">STAP Traffic Portal</h1>
            <span className="text-[10px] bg-slate-800 text-emerald-400 font-mono px-2 py-0.5 rounded border border-slate-700/60">
              v17.2.2 Live
            </span>
          </div>
          <p className="text-xs text-slate-400">Smart Traffic Automation Program</p>
        </div>
      </div>

      {/* Center Adaptive State Overviews */}
      <div className="flex items-center gap-5 bg-slate-950/80 rounded-xl px-4 py-2 border border-slate-800 text-xs font-mono">
        {/* Core Mode Indicator */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">MODE:</span>
          {mode === "AUTO" ? (
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">AUTO (SMART AI)</span>
          ) : mode === "MANUAL" ? (
            <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded font-mono">MANUAL OVERRIDE</span>
          ) : (
            <span className="text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded animate-pulse">HAZARD OVERRIDE</span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-slate-800" />

        {/* Python Camera Node Status */}
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500">LAN PORT 5000:</span>
          {nodeOnline ? (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="text-emerald-400 text-[11px] font-semibold">LINK ACTIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-slate-600 rounded-full" />
              <span className="text-slate-500 text-[11px]">OFFLINE (SIM)</span>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-slate-800" />

        {/* Database Storage Sync */}
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500">SYNC:</span>
          {firebaseConnected ? (
            <span className="text-cyan-400 font-bold text-[11px] bg-cyan-500/10 px-2 py-0.5 rounded flex items-center gap-1">
              FIREBASE LIVE
            </span>
          ) : (
            <span className="text-slate-400 text-[11px] bg-slate-800 px-2 py-0.5 rounded">
              LOCAL EMULATION
            </span>
          )}
        </div>
      </div>

      {/* User Status and Quick Settings */}
      <div className="flex items-center gap-4">
        {/* Weather Conditions Switcher */}
        <button
          id="toggle-weather"
          onClick={onToggleWeather}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-xs rounded-xl border border-slate-700/50"
          title="Toggle Weather Mode to simulate adaptive timing adjustments"
        >
          {weather === "SUNNY" ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span>Dry Road (Sunny)</span>
            </>
          ) : (
            <>
              <CloudRain className="h-3.5 w-3.5 text-cyan-400 animate-bounce" />
              <span>Wet Roads (Rain)</span>
            </>
          )}
        </button>

        {/* Theme Switcher Toggle */}
        <button
          id="toggle-theme"
          onClick={onToggleTheme}
          className="flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-xs rounded-xl border border-slate-700/50"
          title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
          )}
        </button>

        {/* User Identity Frame */}
        <div className="bg-slate-800/80 border border-slate-700/40 rounded-xl px-3 py-1 flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-200">{currentUser.name}</span>
            <span className="text-[10px] text-slate-400 uppercase font-mono flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-400 inline" /> {currentUser.role}
            </span>
          </div>
          <button
            id="stap-logout"
            onClick={onLogout}
            className="text-slate-400 hover:text-red-400 p-1 rounded-lg hover:bg-slate-700/50 transition-all"
            title="Switch User / Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
