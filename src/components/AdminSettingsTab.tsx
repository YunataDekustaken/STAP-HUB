import React, { useState } from "react";
import { User, FirebaseConnectionConfig, Role } from "../types";
import { Shield, Key, Database, RefreshCw, CheckCircle2, UserCheck, Play, HelpCircle, Mail, HardDrive, ExternalLink, Info } from "lucide-react";

interface AdminSettingsTabProps {
  currentUser: User;
  onUserSwitch: (role: Role) => void;
  firebaseConnection: FirebaseConnectionConfig;
  onUpdateFirebase: (config: Omit<FirebaseConnectionConfig, "connected">) => void;
  onResetFirebase: () => void;
  pythonStreamUrl: string;
  onUpdateStreamUrl: (url: string) => void;
}

export default function AdminSettingsTab({
  currentUser,
  onUserSwitch,
  firebaseConnection,
  onUpdateFirebase,
  onResetFirebase,
  pythonStreamUrl,
  onUpdateStreamUrl
}: AdminSettingsTabProps) {
  const [apiKey, setApiKey] = useState(firebaseConnection.apiKey);
  const [authDomain, setAuthDomain] = useState(firebaseConnection.authDomain);
  const [projectId, setProjectId] = useState(firebaseConnection.projectId);
  const [storageBucket, setStorageBucket] = useState(firebaseConnection.storageBucket);
  const [messagingSenderId, setMessagingSenderId] = useState(firebaseConnection.messagingSenderId);
  const [appId, setAppId] = useState(firebaseConnection.appId);

  const [streamUrl, setStreamUrl] = useState(pythonStreamUrl);
  const [notification, setNotification] = useState<string | null>(null);

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      const { url } = await res.json();
      window.open(url, "google_auth_popup", "width=600,height=700");
    } catch (err) {
      console.error("Failed to get Google Auth URL:", err);
      setNotification("Failed to initiate Google connection.");
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Default credentials documentation
  const officialRolesList: { name: string; email: string; role: Role; desc: string }[] = [
    { name: "Super Admin", email: "admin@stap.gov", role: "Administrator", desc: "Unrestricted read/write command rights" },
    { name: "Commissioner Carter", email: "commissioner@stap.gov", role: "Traffic Commissioner", desc: "Review planner graphs and force signals" },
    { name: "Inspector Martinez", email: "martinez@stap.gov", role: "Inspector", desc: "Operational inspector with signal override privileges" },
    { name: "Analyst Chen", email: "chen@stap.gov", role: "Operations Analyst", desc: "Read-only access to historic analytics" }
  ];

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateFirebase({
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId
    });
    setNotification("Firebase connection parameters updated! Synchronizing dynamic streams...");
    setTimeout(() => setNotification(null), 4000);
  };

  const handleReset = () => {
    onResetFirebase();
    setApiKey("");
    setAuthDomain("");
    setProjectId("");
    setStorageBucket("");
    setMessagingSenderId("");
    setAppId("");
    setNotification("Reset to self-contained sandboxed emulator database.");
    setTimeout(() => setNotification(null), 4500);
  };

  return (
    <div className="space-y-6" id="admin-settings-tab">
      
      {/* Alert banner */}
      {notification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex gap-3 text-emerald-200 text-xs shadow">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 animate-bounce" />
          <p className="font-semibold">{notification}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: User Auth Roles Manager */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              Role Authenticate Simulator
            </h2>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              STAP implements full role-based access control (RBAC). Swap between city official profiles to review restrictive views and clearances.
            </p>

            {/* Selector list of officers */}
            <div className="space-y-3">
              {officialRolesList.map((officer) => {
                const isActive = currentUser.role === officer.role;
                return (
                  <button
                    id={`auth-${officer.role.toLowerCase().replace(" ", "-")}`}
                    key={officer.role}
                    onClick={() => onUserSwitch(officer.role)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-98 flex items-center justify-between group ${
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-semibold"
                        : "bg-slate-950 hover:bg-slate-850 border-slate-850 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block">{officer.name}</span>
                      <span className="text-[10px] text-slate-500 block font-mono">{officer.email}</span>
                      <span className="text-[10px] text-slate-400 block mt-1.5 font-normal">
                        {officer.desc}
                      </span>
                    </div>

                    {isActive ? (
                      <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> ACTIVE
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-all font-mono">
                        SWAP
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Python Stream IP Base URL Bridge */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-2">
              <Play className="h-4.5 w-4.5 text-emerald-400" />
              Python Camera Stream Port Bridge
            </h2>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Define the LAN IP and port of the host machine running your YOLOv8 Python Flask file. This mounts direct MJPEG CCTV frames on your dashboard.
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
                  Flask Stream Server URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="python-stream-url"
                    type="text"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="http://localhost:5000"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateStreamUrl(streamUrl);
                      setNotification("Python Camera Stream URL bound successfully!");
                      setTimeout(() => setNotification(null), 3500);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl transition-all active:scale-95 text-xs font-bold font-sans shadow"
                  >
                    Bind IP
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850/60 space-y-1 text-[10px] font-mono text-slate-400 leading-relaxed">
                <span className="text-emerald-400 font-bold block uppercase text-[8px] mb-1">MAPPED FLASK CLOCK FEED LINKS:</span>
                <div>• North: <span className="text-slate-500 select-all">{streamUrl}/video_feed/north</span></div>
                <div>• South: <span className="text-slate-500 select-all">{streamUrl}/video_feed/south</span></div>
                <div>• East: <span className="text-slate-500 select-all">{streamUrl}/video_feed/east</span></div>
                <div>• West: <span className="text-slate-500 select-all">{streamUrl}/video_feed/west</span></div>
              </div>
            </div>
          </div>

          {/* Google Workspace API Bridge */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-2">
              <Mail className="h-4.5 w-4.5 text-blue-400" />
              Google Workspace API Bridge
            </h2>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Connect your Gmail and Drive accounts to reply to footage requests and access video files directly from the STAP interface.
            </p>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-900 px-4 py-3 rounded-xl transition-all active:scale-95 text-xs font-bold shadow-sm"
              >
                <img src="https://www.google.com/favicon.ico" className="h-4 w-4" alt="Google" />
                Connect Google Account
              </button>

              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                  <Info className="h-3 w-3" /> Setup Instructions
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  1. Authorize via the button above.<br />
                  2. Copy the <b>Refresh Token</b> shown in the new window.<br />
                  3. Add it to <b>GOOGLE_REFRESH_TOKEN</b> in AI Studio Secrets.<br />
                  4. Also ensure <b>GOOGLE_CLIENT_ID</b> and <b>SECRET</b> are set.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Firebase Credentials Form */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-400" />
                Custom Firebase Real-Time DB Settings
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Connect your own physical Firebase project securely. Paste your client parameters below to enable real-time synchronization blocks with Firestore or real Realtime Database buckets. Cleared browser cache falls back to client sandbox.
            </p>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* API Key */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
                    API Key
                  </label>
                  <input
                    id="fb-api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSyA..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Project ID */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
                    Project ID
                  </label>
                  <input
                    id="fb-project-id"
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="stap-traffic-hub"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Auth Domain */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
                    Auth Domain
                  </label>
                  <input
                    id="fb-auth-domain"
                    type="text"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    placeholder="stap-traffic-hub.firebaseapp.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Storage Bucket */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
                    Storage Bucket
                  </label>
                  <input
                    id="fb-storage-bucket"
                    type="text"
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                    placeholder="stap-traffic-hub.appspot.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Messaging Sender ID */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
                    Messaging Sender ID
                  </label>
                  <input
                    id="fb-messaging-sender"
                    type="text"
                    value={messagingSenderId}
                    onChange={(e) => setMessagingSenderId(e.target.value)}
                    placeholder="2510239103"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* App ID */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
                    App ID
                  </label>
                  <input
                    id="fb-app-id"
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1:25102:web:a97e4c"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-800/80">
                <button
                  id="btn-dynamic-fb-reset"
                  type="button"
                  onClick={handleReset}
                  className="bg-slate-950 hover:bg-slate-850 hover:text-slate-300 border border-slate-850 text-slate-500 px-4 py-2 rounded-xl transition-all active:scale-95 text-xs font-mono"
                >
                  Disconnect & Use Sandbox
                </button>

                <button
                  id="btn-dynamic-fb-save"
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-5 py-2.5 rounded-xl transition-all active:scale-95 text-xs font-bold font-sans shadow shadow-cyan-500/10"
                >
                  Save & Bind Firebase
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
