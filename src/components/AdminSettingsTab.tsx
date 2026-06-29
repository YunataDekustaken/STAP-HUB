import React, { useState } from "react";
import { Mail, CheckCircle2, Info } from "lucide-react";

interface AdminSettingsTabProps {}

export default function AdminSettingsTab({}: AdminSettingsTabProps) {
  const [notification, setNotification] = useState<string | null>(null);

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errorText.substring(0, 50)}`);
      }
      
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, "google_auth_popup", "width=600,height=700");
      } else {
        setNotification(data.error || "Google Auth configuration is incomplete.");
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (err: any) {
      console.error("Failed to get Google Auth URL:", err);
      setNotification(`Error: ${err.message || "Failed to initiate Google connection."}`);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto" id="admin-settings-tab">
      
      {/* Alert banner */}
      {notification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex gap-3 text-emerald-200 text-xs shadow">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 animate-bounce" />
          <p className="font-semibold">{notification}</p>
        </div>
      )}

      {/* Google Workspace API Bridge */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Mail className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Google Workspace API Bridge
            </h2>
            <p className="text-xs text-slate-400">
              Direct integration for Footage Requests & Video Archive
            </p>
          </div>
        </div>
        
        <p className="text-xs text-slate-400 mb-8 leading-relaxed">
          Connect your Gmail and Drive accounts to reply to footage requests and access video files directly from the STAP interface. This connection is used for secure correspondence with public requesters.
        </p>

        <div className="space-y-6">
          <button
            type="button"
            onClick={handleConnectGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 px-6 py-4 rounded-2xl transition-all active:scale-95 text-sm font-bold shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" className="h-5 w-5" alt="Google" />
            Connect Google Account
          </button>

          <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-blue-400 font-bold uppercase tracking-wider">
              <Info className="h-3.5 w-3.5" /> Setup Instructions
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-400 leading-normal">
                1. Authorize via the button above.<br />
                2. Copy the <b>Refresh Token</b> shown in the new window.<br />
                3. Add it to <b>GOOGLE_REFRESH_TOKEN</b> in AI Studio Secrets.<br />
                4. Also ensure <b>GOOGLE_CLIENT_ID</b> and <b>SECRET</b> are configured.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
