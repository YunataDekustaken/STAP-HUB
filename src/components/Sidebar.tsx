import React from "react";
import { LayoutDashboard, Video, FileText, ShieldAlert, Megaphone, User, AlertTriangle, Settings, BarChart3 } from "lucide-react";

export type SidebarTab =
  | "DASHBOARD"
  | "TRAFFIC_LIGHTS"
  | "FOOTAGE_REQUESTS"
  | "INCIDENT_REPORTS"
  | "ANNOUNCEMENTS"
  | "ANALYTICS"
  | "DATA_REQUEST"
  | "INCIDENT_REPORT"
  | "SETTINGS";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  isAdmin: boolean;
  onLoginClick: () => void;
}

export default function Sidebar({ activeTab, onTabChange, isAdmin, onLoginClick }: SidebarProps) {
  // Navigation tabs for Admin mode
  const adminTabs = [
    {
      id: "DASHBOARD" as const,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "TRAFFIC_LIGHTS" as const,
      label: "Traffic Control",
      icon: Video,
    },
    {
      id: "FOOTAGE_REQUESTS" as const,
      label: "Footage Requests",
      icon: FileText,
    },
    {
      id: "INCIDENT_REPORTS" as const,
      label: "Incident Reports",
      icon: ShieldAlert,
    },
    {
      id: "ANNOUNCEMENTS" as const,
      label: "Announcements",
      icon: Megaphone,
    },
    {
      id: "ANALYTICS" as const,
      label: "Analytics",
      icon: BarChart3,
    },
    {
      id: "SETTINGS" as const,
      label: "Settings",
      icon: Settings,
    },
  ];

  // Navigation tabs for Public mode matching the user's screenshot
  const publicTabs = [
    {
      id: "DASHBOARD" as const,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "DATA_REQUEST" as const,
      label: "Data Request",
      icon: FileText,
    },
    {
      id: "INCIDENT_REPORT" as const,
      label: "Incident Report",
      icon: AlertTriangle,
    },
  ];

  const currentTabs = isAdmin ? adminTabs : publicTabs;

  return (
    <aside
      id="stap-sidebar"
      className="bg-[#4E6290] w-64 text-white flex flex-col justify-between shrink-0 h-full select-none"
    >
      <div className="flex flex-col">
        {/* Brand/Logo Section matching screenshots */}
        <div className="p-6 pb-2">
          <div className="flex items-center gap-2">
            {/* STAP Logo with custom traffic light letter 'T' */}
            <div className="flex items-center font-black tracking-tight text-3xl font-sans text-white">
              <span>S</span>
              {/* Traffic Light graphic inside the letter T */}
              <span className="relative flex items-center justify-center mx-0.5" style={{ minWidth: "1.4rem" }}>
                <span className="font-extrabold text-3xl">T</span>
                <span className="absolute -right-1 top-[20%] flex flex-col gap-0.5 bg-black p-0.5 rounded-full border border-slate-700/50 scale-75">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-xs shadow-red-500/80 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-xs shadow-yellow-500/80" />
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-xs shadow-green-500/80" />
                </span>
              </span>
              <span>A</span>
              <span>P</span>
            </div>
          </div>
          <div className="text-[8px] text-slate-200/80 font-bold uppercase tracking-wider mt-1 leading-tight">
            Smart Traffic Automation Program
          </div>
        </div>

        {/* Section Heading - Show only for admin or use a subtle heading */}
        {isAdmin && (
          <div className="px-6 pt-6 pb-2 text-[10px] text-slate-200/60 font-bold uppercase tracking-widest">
            ADMIN PANEL
          </div>
        )}
        {!isAdmin && (
          <div className="px-6 pt-6 pb-2 text-[10px] text-slate-200/60 font-bold uppercase tracking-widest">
            PUBLIC PORTAL
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex flex-col gap-1 px-4">
          {currentTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                id={`sidebar-tab-${tab.id.toLowerCase()}`}
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-xs font-semibold text-left select-none outline-none ${
                  active
                    ? "bg-white/15 text-white shadow-inner font-bold"
                    : "hover:bg-white/5 text-slate-200 hover:text-white"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-white" : "text-slate-300"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Details */}
      <div className="border-t border-white/5">
        {!isAdmin ? (
          <button
            onClick={onLoginClick}
            className="w-full flex items-center gap-3 px-6 py-5 text-xs text-slate-200 hover:text-white font-semibold transition-all hover:bg-white/5 text-left outline-none"
          >
            <User className="h-4.5 w-4.5 text-slate-300" />
            <span>Log in as Admin</span>
          </button>
        ) : (
          <div className="p-6 text-[10px] text-slate-200/50 font-mono flex flex-col gap-0.5">
            <div>STAP Hub • Active</div>
            <div>v17.2 Live Control</div>
          </div>
        )}
      </div>
    </aside>
  );
}

