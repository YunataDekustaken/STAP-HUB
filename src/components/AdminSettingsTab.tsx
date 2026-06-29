import React, { useState, useEffect } from "react";
import { Mail, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, LogOut } from "lucide-react";

export default function AdminSettingsTab() {
  const [notification, setNotification] = useState<string | null>(null);
  const [status, setStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/google/status");
      const data = await res.json();
      if (data.success) {
        setStatus({ connected: data.connected, email: data.email });
      }
    } catch (err) {
      console.error("Failed to fetch auth status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errorText.substring(0, 50)}`);
      }
      
      const data = await res.json();
      if (data.success && data.url) {
        const authWindow = window.open(data.url, "google_auth_popup", "width=600,height=700");
        
        // Simple poll to check if window closed
        const timer = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(timer);
            fetchStatus();
          }
        }, 1000);
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
    <div className="flex flex-col items-center justify-center p-4 min-h-[400px] animate-fadeIn">
      {notification && (
        <div className="fixed top-4 right-4 bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 animate-bounce text-sm font-bold flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {notification}
        </div>
      )}

      <div className="max-w-2xl w-full bg-[#0F172A] rounded-[32px] p-10 border border-slate-800 shadow-2xl space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl">
              <Mail className="h-6 w-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Google Workspace API Bridge</h2>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed font-medium">
            Connect your Gmail and Drive accounts to reply to footage requests and access video files directly from the STAP interface. This connection is used for secure correspondence with public requesters.
          </p>
        </div>

        {isLoading ? (
          <div className="bg-slate-900/50 rounded-2xl p-12 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Verifying Connection...</p>
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Gmail API Authorized Channel</h3>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded-full uppercase tracking-widest">Connected</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Authorized sender account: <span className="text-blue-400">{status.email}</span></p>
                </div>
              </div>
              <button 
                onClick={handleConnectGoogle}
                className="p-2.5 hover:bg-slate-800 text-slate-500 hover:text-white rounded-xl transition-all"
                title="Refresh Connection"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bearer Token Live</span>
              </div>
              <button className="text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest flex items-center gap-1 transition-all">
                <LogOut className="h-3 w-3" />
                Disconnect Account
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleConnectGoogle}
            className="w-full py-5 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-blue-500/10 group"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 group-hover:rotate-12 transition-transform" alt="Google" />
            Connect Google Account
          </button>
        )}

        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800/50 space-y-4">
          <div className="flex items-center gap-2 text-blue-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Setup Instructions</span>
          </div>
          <div className="space-y-2">
            {[
              "Authorize via the button above using the stap.est2526@gmail.com account.",
              "Ensure the Refresh Token is issued and saved to the cloud vault.",
              "This account will be used globally for all system communications.",
              "Verify GOOGLE_CLIENT_ID and SECRET are set in System Secrets."
            ].map((step, i) => (
              <div key={i} className="flex gap-3 text-[11px] text-slate-500 font-medium leading-relaxed">
                <span className="text-blue-500/50 font-black">{i + 1}.</span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

