import React, { useState, useEffect } from "react";
import { Lane, LightState, User, Role } from "../types";
import { Server, Wifi, WifiOff, CloudSun, RefreshCw, Sliders, Check, Database, Key, HelpCircle, ShieldAlert, Users, UserPlus, Trash2, Shield, Settings, Mail, X } from "lucide-react";
import { getFirebaseConfig, saveFirebaseConfig, getFirebaseInstances, handleFirestoreError, OperationType, STAPDatabaseManager } from "../firebase";
import { collection, onSnapshot, doc, addDoc, setDoc, deleteDoc } from "firebase/firestore";

interface SettingsTabProps {
  nodeIp: string;
  setNodeIp: (ip: string) => void;
  isNodeConnected: boolean;
  setIsNodeConnected: (connected: boolean) => void;
  setLanes: React.Dispatch<React.SetStateAction<Record<Lane, { count: number; density: number; light: LightState; los: string }>>>;
  weather: "SUNNY" | "RAINY";
  setWeather: (weather: "SUNNY" | "RAINY") => void;
  isAdmin: boolean;
  weatherLocation: string;
  onUpdateWeatherLocation: (location: string) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

export default function SettingsTab({
  nodeIp,
  setNodeIp,
  isNodeConnected,
  setIsNodeConnected,
  setLanes,
  weather,
  setWeather,
  isAdmin,
  weatherLocation,
  onUpdateWeatherLocation,
  users,
  setUsers
}: SettingsTabProps) {
  const [inputValue, setInputValue] = useState(nodeIp || "192.168.1.100");
  const [isConnecting, setIsConnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Sub-tabs navigation state
  const [activeSubTab, setActiveSubTab] = useState<"general" | "users">("general");

  // User Management state
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>("");
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<Role>("Inspector");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);

  // Firebase configuration state
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);

  useEffect(() => {
    const config = getFirebaseConfig();
    setFirebaseConnected(config.connected);
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionError(null);
    setUserActionSuccess(null);
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setUserActionError("Name and email are required to register a system user.");
      return;
    }

    const { db } = getFirebaseInstances();
    if (db && firebaseConnected) {
      try {
        await addDoc(collection(db, "users"), {
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole
        });
        setUserActionSuccess(`Successfully registered user "${newUserName}" in Firestore!`);
        setShowAddUserModal(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserRole("Inspector");
      } catch (err: any) {
        console.error("Error adding user to Firestore:", err);
        setUserActionError(err.message || "Failed to add user to Firestore.");
      }
    } else {
      // Local fallback
      const newUser: User = {
        id: `u-${Math.random().toString(36).substring(2, 9)}`,
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole
      };
      const updated = [newUser, ...users];
      setUsers(updated);
      STAPDatabaseManager.saveUsers(updated);
      setUserActionSuccess(`Successfully registered user "${newUserName}" in local session!`);
      setShowAddUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("Inspector");
    }
  };

  const handleRemoveUser = async () => {
    if (!userToDelete) return;
    setUserActionError(null);
    setUserActionSuccess(null);

    const { db } = getFirebaseInstances();
    if (db && firebaseConnected) {
      try {
        await deleteDoc(doc(db, "users", userToDelete.id));
        setUserActionSuccess(`Successfully removed user "${userToDelete.name}" from Firestore.`);
        setUserToDelete(null);
      } catch (err: any) {
        console.error("Error removing user from Firestore:", err);
        setUserActionError(err.message || "Failed to remove user from Firestore.");
        setUserToDelete(null);
      }
    } else {
      // Local fallback
      const updated = users.filter((u) => u.id !== userToDelete.id);
      setUsers(updated);
      STAPDatabaseManager.saveUsers(updated);
      setUserActionSuccess(`Successfully removed user "${userToDelete.name}" from local session.`);
      setUserToDelete(null);
    }
  };

  const handleUpdateRole = async (userId: string, nextRole: Role) => {
    setUserActionError(null);
    setUserActionSuccess(null);

    const { db } = getFirebaseInstances();
    if (db && firebaseConnected) {
      try {
        await setDoc(doc(db, "users", userId), { role: nextRole }, { merge: true });
        setUserActionSuccess("User role assignment updated successfully in Firestore!");
      } catch (err: any) {
        console.error("Error updating user role in Firestore:", err);
        setUserActionError(err.message || "Failed to update user role in Firestore.");
      }
    } else {
      // Local fallback
      const updated = users.map((u) => (u.id === userId ? { ...u, role: nextRole } : u));
      setUsers(updated);
      STAPDatabaseManager.saveUsers(updated);
      setUserActionSuccess("User role assignment updated successfully!");
    }
  };



  const [presetLocation, setPresetLocation] = useState<string>(() => {
    const presets = [
      "Marikina City, Metro Manila, Philippines",
      "Quezon City, Metro Manila, Philippines",
      "Pasig City, Metro Manila, Philippines",
      "Manila City, Metro Manila, Philippines"
    ];
    return presets.includes(weatherLocation) ? weatherLocation : "CUSTOM";
  });
  const [customLocationInput, setCustomLocationInput] = useState<string>(weatherLocation);

  // Sync internal input value with prop if it changes
  useEffect(() => {
    if (nodeIp) {
      setInputValue(nodeIp);
    }
  }, [nodeIp]);

  useEffect(() => {
    const presets = [
      "Marikina City, Metro Manila, Philippines",
      "Quezon City, Metro Manila, Philippines",
      "Pasig City, Metro Manila, Philippines",
      "Manila City, Metro Manila, Philippines"
    ];
    setPresetLocation(presets.includes(weatherLocation) ? weatherLocation : "CUSTOM");
    setCustomLocationInput(weatherLocation);
  }, [weatherLocation]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    setIsConnecting(true);
    setSuccessMessage("");
    setErrorMessage("");
    setNodeIp(inputValue);
    
    try {
      // 1. Check direct reachability to local Python Flask endpoint
      const controllerUrl = `http://${inputValue.trim()}:5000/status?hub_origin=${encodeURIComponent(window.location.origin)}`;
      
      const pingPromise = fetch(controllerUrl, { mode: "cors" });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 1500)
      );
      
      await Promise.race([pingPromise, timeoutPromise]);
      
      setIsConnecting(false);
      setIsNodeConnected(true);
      setSuccessMessage(`Successfully connected locally to STAP controller at ${inputValue}!`);
    } catch (err) {
      // 2. Fallback check: check if our cloud proxy server shows the node is online
      try {
        const res = await fetch("/api/v1/status");
        if (res.ok) {
          const data = await res.json();
          if (data.nodeOnline) {
            setIsConnecting(false);
            setIsNodeConnected(true);
            setSuccessMessage("STAP controller connected successfully via Cloud Proxy tunnel!");
            return;
          }
        }
      } catch (cloudErr) {
        console.error("Cloud status error:", cloudErr);
      }

      setIsConnecting(false);
      setIsNodeConnected(false);
      setErrorMessage(
        `Unable to reach STAP Edge Controller. Please ensure 'stap_yolo_controller.py' is running on your machine and that its Flask API on port 5000 is accessible.`
      );
      
      // Reset lanes to 0 to show offline state
      setLanes({
        NORTH: { count: 0, density: 0, light: "RED", los: "—" },
        SOUTH: { count: 0, density: 0, light: "RED", los: "—" },
        EAST: { count: 0, density: 0, light: "RED", los: "—" },
        WEST: { count: 0, density: 0, light: "RED", los: "—" }
      });
    }
  };

  const handleDisconnect = async () => {
    setIsNodeConnected(false);
    setSuccessMessage("Disconnected STAP link.");
    setErrorMessage("");
    setLanes({
      NORTH: { count: 0, density: 0, light: "RED", los: "—" },
      SOUTH: { count: 0, density: 0, light: "RED", los: "—" },
      EAST: { count: 0, density: 0, light: "RED", los: "—" },
      WEST: { count: 0, density: 0, light: "RED", los: "—" }
    });

    // Notify cloud server of manual disconnect
    try {
      await fetch("/api/v1/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lanes: {
            NORTH: { count: 0, density: 0, light: "RED", los: "—" },
            SOUTH: { count: 0, density: 0, light: "RED", los: "—" },
            EAST: { count: 0, density: 0, light: "RED", los: "—" },
            WEST: { count: 0, density: 0, light: "RED", los: "—" }
          }
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSetWeather = async (newWeather: "SUNNY" | "RAINY") => {
    setWeather(newWeather);
    try {
      await fetch("/api/v1/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weather: newWeather })
      });
    } catch (e) {
      console.error("Failed to sync weather to server:", e);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="settings-tab">
      
      {/* Sub-tab navigation menu */}
      <div className="flex border-b border-slate-200 gap-1 select-none overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab("general")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer -mb-px rounded-t-xl whitespace-nowrap ${
            activeSubTab === "general"
              ? "border-slate-800 text-slate-800 bg-white"
              : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Settings className="h-4 w-4" />
          General & Weather
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("users")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer -mb-px rounded-t-xl whitespace-nowrap ${
            activeSubTab === "users"
              ? "border-slate-800 text-slate-800 bg-white"
              : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Users className="h-4 w-4" />
          User Management
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold font-mono">
            {users.length}
          </span>
        </button>
      </div>

      {activeSubTab === "general" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">STAP Edge Controller Connection</h3>
                <p className="text-xs text-slate-500 font-medium">Configure network link to the physical hardware node at the intersection</p>
              </div>
            </div>

            {/* Info card */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs text-slate-600 leading-relaxed font-medium">
              The Smart Traffic Automation Program (STAP) connects to an on-site edge microcontroller that handles real-time computer vision analysis. This node registers vehicle density and controls regional traffic lights.
            </div>

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <span className="text-rose-500">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">STAP Node IP Address</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setSuccessMessage("");
                    }}
                    placeholder="e.g. 192.168.1.100"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 outline-none font-mono focus:border-slate-400 focus:bg-white disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">Connection Status</label>
                  <div className="flex items-center h-[38px]">
                    {isNodeConnected ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold font-mono">
                        <Wifi className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                        CONNECTED (IP: {nodeIp})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold font-mono">
                        <WifiOff className="h-3.5 w-3.5 text-rose-500" />
                        DISCONNECTED / OFFLINE
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isAdmin && (
                <p className="text-[10px] text-amber-600 font-bold italic pt-1 flex items-center gap-1.5">
                  ⚠️ Settings are read-only. Please log in as Admin to alter the STAP node configuration.
                </p>
              )}

              {isAdmin && (
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isConnecting || !inputValue.trim()}
                    className="bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isConnecting ? "Connecting..." : "Apply Settings"}
                  </button>

                  {isNodeConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="bg-white hover:bg-slate-50 border border-slate-200 text-rose-600 hover:text-rose-700 font-bold text-xs px-5 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                    >
                      Disconnect Link
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Weather Settings Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                <CloudSun className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Weather Settings</h3>
                <p className="text-xs text-slate-500 font-medium">Configure weather tracking locations and localized atmospheric profiles</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                    Active Weather Location
                  </label>
                  
                  <div className="flex flex-col gap-3">
                    <select
                      disabled={!isAdmin}
                      value={presetLocation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPresetLocation(val);
                        if (val !== "CUSTOM") {
                          setCustomLocationInput(val);
                          onUpdateWeatherLocation(val);
                          setSuccessMessage(`Weather location updated to "${val}" successfully.`);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white disabled:opacity-60"
                    >
                      <option value="Marikina City, Metro Manila, Philippines">Marikina City, Metro Manila, Philippines</option>
                      <option value="Quezon City, Metro Manila, Philippines">Quezon City, Metro Manila, Philippines</option>
                      <option value="Pasig City, Metro Manila, Philippines">Pasig City, Metro Manila, Philippines</option>
                      <option value="Manila City, Metro Manila, Philippines">Manila City, Metro Manila, Philippines</option>
                      <option value="CUSTOM">Custom Address Specified Below...</option>
                    </select>

                    {presetLocation === "CUSTOM" && (
                      <div className="space-y-2 animate-slideDown">
                        <label className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Custom Geographical Address</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            disabled={!isAdmin}
                            value={customLocationInput}
                            onChange={(e) => setCustomLocationInput(e.target.value)}
                            placeholder="e.g. Cebu City, Philippines"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={!isAdmin || !customLocationInput.trim()}
                            onClick={() => {
                              onUpdateWeatherLocation(customLocationInput.trim());
                              setSuccessMessage(`Geographical reference bound to custom location: "${customLocationInput.trim()}"`);
                            }}
                            className="bg-slate-850 hover:bg-slate-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                    Localized Precipitation Profile
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3 h-[42px]">
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => handleSetWeather("SUNNY")}
                      className={`flex items-center justify-center gap-2 text-xs font-bold border rounded-lg transition-all cursor-pointer ${
                        weather === "SUNNY"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-700"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-500"
                      }`}
                    >
                      ☀️ SUNNY / CLEAR
                    </button>
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => handleSetWeather("RAINY")}
                      className={`flex items-center justify-center gap-2 text-xs font-bold border rounded-lg transition-all cursor-pointer ${
                        weather === "RAINY"
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-700"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-500"
                      }`}
                    >
                      🌧️ RAINY / STORMY
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <RefreshCw className="h-4 w-4 text-slate-500" />
                      Live Count Refresher
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                      Specifies how frequently the simulation updates counts when connected to the live database feed.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 h-9">
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
                      1.00 Hz (Every 1 second)
                    </span>
                    <span className="text-[11px] text-slate-400 italic">Auto-throttled</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "users" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Alert */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Registered System Users</h3>
                  <p className="text-xs text-slate-500 font-medium">Manage access profiles, roles, and administrative levels for STAP operators</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUserActionError(null);
                  setUserActionSuccess(null);
                  setShowAddUserModal(true);
                }}
                className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm shrink-0 justify-center"
              >
                <UserPlus className="h-4 w-4" />
                Add New User
              </button>
            </div>

            {/* Error & Success Messages */}
            {userActionError && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-xs font-bold flex items-start gap-2.5 animate-fadeIn leading-relaxed">
                <span className="text-rose-500 shrink-0 text-sm">⚠️</span>
                <span>{userActionError}</span>
              </div>
            )}

            {userActionSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>{userActionSuccess}</span>
              </div>
            )}

            {/* Loading / Empty / Table view */}
            {isLoadingUsers ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 font-medium">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
                <span className="text-xs font-mono">Synchronizing live user catalog...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                <p className="text-xs text-slate-500 font-bold">No registered users found</p>
                <p className="text-[11px] text-slate-400 font-medium">Click "Add New User" to register the first system account.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-5 py-3.5">User Profile</th>
                      <th className="px-5 py-3.5">System Role Assignment</th>
                      <th className="px-5 py-3.5">Database Pipe</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-extrabold text-indigo-700 uppercase select-none overflow-hidden shrink-0">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                u.name.slice(0, 2)
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {u.isOnline && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/80 animate-pulse" title="Active Now" />
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[180px]">{u.email}</span>
                              </div>
                              {u.lastLogin && (
                                <div className="text-[9px] text-slate-400 font-semibold italic mt-0.5">
                                  Last Login: {u.lastLogin}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="relative max-w-[220px]">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value as Role)}
                              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold outline-none focus:border-slate-400 focus:bg-white transition-colors cursor-pointer"
                            >
                              <option value="Administrator">Administrator (Admin)</option>
                              <option value="Traffic Commissioner">Traffic Commissioner (Operator)</option>
                              <option value="Inspector">Inspector (Operator)</option>
                              <option value="Operations Analyst">Operations Analyst (Viewer)</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {firebaseConnected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-md text-[10px] font-bold font-mono">
                              <Database className="h-2.5 w-2.5 text-cyan-500" />
                              CLOUD (Firestore)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-250 rounded-md text-[10px] font-bold font-mono">
                              <Server className="h-2.5 w-2.5 text-slate-400" />
                              LOCAL SANDBOX
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100/80 text-rose-600 rounded-lg border border-rose-100/50 transition-all hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center justify-center"
                            title="Remove User"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New User Dialog Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-5 text-left animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-500" />
                Register New System User
              </h3>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Inspector Alejandro"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. alejandro@stap.gov"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Access Role Level</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as Role)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-semibold cursor-pointer"
                >
                  <option value="Administrator">Administrator (Admin)</option>
                  <option value="Traffic Commissioner">Traffic Commissioner (Operator)</option>
                  <option value="Inspector">Inspector (Operator)</option>
                  <option value="Operations Analyst">Operations Analyst (Viewer)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer text-center"
                >
                  Create User Account
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer text-center"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Step Dialog Modal for Removing User */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-4 text-left animate-scaleIn">
            <div className="text-center space-y-2">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-base font-bold text-slate-800">Confirm User Removal</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Are you sure you want to remove user <span className="font-bold text-slate-700">"{userToDelete.name}"</span> ({userToDelete.email})? This action cannot be undone and will immediately revoke all operational credentials.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleRemoveUser}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer text-center"
              >
                Yes, Remove User
              </button>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer text-center"
              >
                No, Keep Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
