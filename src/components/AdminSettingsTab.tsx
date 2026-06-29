import React, { useState, useEffect } from "react";
import { Mail, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, LogOut, CloudSun, MapPin, Save, Info } from "lucide-react";

export default function AdminSettingsTab() {
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [status, setStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [weatherLoc, setWeatherLoc] = useState("Marikina City");
  const [isSavingWeather, setIsSavingWeather] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const [authRes, weatherRes] = await Promise.all([
        fetch("/api/auth/google/status"),
        fetch("/api/weather/config")
      ]);
      
      const authData = await authRes.json();
      if (authData.success) {
        setStatus({ connected: authData.connected, email: authData.email });
      }

      const weatherData = await weatherRes.json();
      if (weatherData.success) {
        setWeatherLoc(weatherData.location);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSaveWeather = async () => {
    setIsSavingWeather(true);
    try {
      const res = await fetch("/api/weather/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: weatherLoc })
      });
      const data = await res.json();
      if (data.success) {
        showNotification("Weather location updated successfully.");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      showNotification(err.message || "Failed to update weather location", "error");
    } finally {
      setIsSavingWeather(false);
    }
  };

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
    <div className="flex flex-col items-center justify-start p-4 min-h-screen animate-fadeIn space-y-6 pt-10">
      {notification && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-2xl shadow-2xl z-50 animate-bounce text-sm font-bold flex items-center gap-2 ${
          notification.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        }`}>
          {notification.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notification.message}
        </div>
      )}

      {/* Google Workspace API Bridge */}
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

      {/* Weather API Settings */}
      <div className="max-w-2xl w-full bg-[#0F172A] rounded-[32px] p-10 border border-slate-800 shadow-2xl space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl">
              <CloudSun className="h-6 w-6 text-amber-400" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Weather Service Configuration</h2>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed font-medium">
            Configure the regional weather source for the STAP Dashboard. This utilizes the WeatherAPI.com forecast service for regional climate monitoring.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Default Monitoring Location</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <MapPin className="h-4 w-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
              </div>
              <input 
                type="text" 
                value={weatherLoc}
                onChange={(e) => setWeatherLoc(e.target.value)}
                placeholder="City, Country"
                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-bold focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all"
              />
            </div>
          </div>

          <button 
            onClick={handleSaveWeather}
            disabled={isSavingWeather}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-amber-500/10 group"
          >
            {isSavingWeather ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSavingWeather ? "Saving Configuration..." : "Save Weather Settings"}
          </button>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800/50 space-y-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Info className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Weather Service Notes</span>
          </div>
          <div className="space-y-2">
            {[
              "Regional weather provides long-term forecasts and humidity tracking.",
              "This is separate from the STAP Node local precipitation sensors.",
              "Ensure WEATHER_API_KEY is configured in AI Studio Secrets.",
              "Valid locations include 'City, Country' or zip codes."
            ].map((step, i) => (
              <div key={i} className="flex gap-3 text-[11px] text-slate-500 font-medium leading-relaxed">
                <span className="text-amber-500/50 font-black">•</span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

