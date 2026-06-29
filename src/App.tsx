import React, { useState, useEffect, useRef } from "react";
import { Menu, X, ShieldAlert, Clock } from "lucide-react";
import Sidebar, { SidebarTab } from "./components/Sidebar";
import DashboardTab from "./components/DashboardTab";
import ControlTab from "./components/ControlTab";
import FootageRequestsTab, { FootageRequest } from "./components/FootageRequestsTab";
import IncidentReportsTab, { IncidentReport } from "./components/IncidentReportsTab";
import AnnouncementsTab, { Announcement } from "./components/AnnouncementsTab";
import AnalyticsTab from "./components/AnalyticsTab";
import GoogleDriveTab from "./components/GoogleDriveTab";
import PublicDataRequest from "./components/PublicDataRequest";
import PublicIncidentReport from "./components/PublicIncidentReport";
import SettingsTab from "./components/SettingsTab";
import { Lane, LightState, SystemMode, User } from "./types";
import { getFirebaseInstances, getFirebaseConfig, handleFirestoreError, OperationType, STAPDatabaseManager } from "./firebase";
import { collection, addDoc, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import stapLogo from "../assets/stap-logo.png";

// Initial seed data for Footage Requests
const INITIAL_FOOTAGE_REQUESTS: FootageRequest[] = [
  {
    id: "14",
    requesterName: "Crissel",
    email: "crisselzapatero21@gmail.com",
    organization: "PUP",
    contact: "09610864177",
    address: "Secret",
    nature: "Academic",
    handledBy: "—",
    footageDate: "2026-06-11T00:00:00.000000Z → 2026-06-17T00:00:00.000000Z",
    camera: "Camera #1",
    timeRange: "21:57:00 - 22:36:00",
    description: "crissel",
    status: "PENDING",
    dateSubmitted: "6/17/2026"
  },
  {
    id: "5",
    requesterName: "CRISSEL ANN GALANG ZAPATERO",
    email: "crisselzapatero21@gmail.com",
    organization: "PUP",
    contact: "09610864177",
    address: "Secret",
    nature: "Academic",
    handledBy: "—",
    footageDate: "2026-06-01T00:00:00.000000Z → 2026-06-05T00:00:00.000000Z",
    camera: "Camera #3",
    timeRange: "09:00:00 - 10:15:00",
    description: "Academic study on traffic build-up and intersection clearing times near Sumulong Highway.",
    status: "PENDING",
    dateSubmitted: "4/9/2026"
  }
];

// Initial seed data for Incident Reports
const INITIAL_INCIDENT_REPORTS: IncidentReport[] = [
  {
    id: "102",
    lane: "EAST",
    type: "Accident",
    reporterName: "Officer Rivera",
    reporterContact: "0917-123-4567",
    timeReported: "6/27/2026, 10:24 AM",
    status: "ACTIVE",
    description: "Minor fender bender between a hatchback and a motorcycle. East approach lane partially blocked.",
    severity: "MEDIUM"
  },
  {
    id: "101",
    lane: "SOUTH",
    type: "Gridlock",
    reporterName: "CCTV Automator",
    reporterContact: "System Autonomics",
    timeReported: "6/27/2026, 09:15 AM",
    status: "RESOLVED",
    description: "Extreme congestion buildup due to flash downpour. Cleared after signal timing auto-adaptation.",
    severity: "HIGH"
  }
];

// Initial seed data for Announcements
const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a1",
    title: "Sumulong Highway Lane Closures",
    category: "Road Closure",
    content: "Lanes on Sumulong Highway Westbound will experience partial closures from 10:00 PM to 4:00 AM on June 28-30 for road paving. Detours are active.",
    datePublished: "June 26, 2026",
    author: "STAP Maintenance Team"
  },
  {
    id: "a2",
    title: "Adaptive Signals Weather Calibration Active",
    category: "Safety Advisory",
    content: "With heavy rain forecasted across Metro Manila, STAP smart signals are dynamically extending green times (+5s safety buffers) on high-density lanes. Please drive safely.",
    datePublished: "June 25, 2026",
    author: "Commissioner's Office"
  }
];

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<SidebarTab>("DASHBOARD");

  // Admin access control state (defaults to false for the requested public portal)
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  // Firebase auth user
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; avatarUrl?: string; role?: string } | null>(null);
  const userUpdatedRef = useRef<string | null>(null);

  // Synced Users list (with local sandbox default)
  const [users, setUsers] = useState<User[]>(() => STAPDatabaseManager.getUsers());

  // Firestore sync error handler state
  const [firebaseSyncError, setFirebaseSyncError] = useState<string | null>(null);

  // STAP Node Connection state
  const [nodeIp, setNodeIp] = useState<string>(() => localStorage.getItem("stap_node_ip") || "192.168.1.100");
  const [isNodeConnected, setIsNodeConnected] = useState<boolean>(false);

  // Core Traffic State
  const [systemMode, setSystemMode] = useState<SystemMode>("AUTO");
  const [activeLane, setActiveLane] = useState<Lane>("NORTH");
  const [weather, setWeather] = useState<"SUNNY" | "RAINY">("SUNNY");
  const [weatherLocation, setWeatherLocation] = useState<string>(() => {
    return localStorage.getItem("stap_weather_location") || "Marikina City, Metro Manila, Philippines";
  });
  const [remainingSecs, setRemainingSecs] = useState<number>(35);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lanes structure initialized with offline defaults (0 counts, red lights, offline LOS)
  const [lanes, setLanes] = useState<Record<Lane, { count: number; density: number; light: LightState; los: string }>>({
    NORTH: { count: 0, density: 0, light: "RED", los: "—" },
    SOUTH: { count: 0, density: 0, light: "RED", los: "—" },
    EAST: { count: 0, density: 0, light: "RED", los: "—" },
    WEST: { count: 0, density: 0, light: "RED", los: "—" }
  });

  // Dynamic lists states
  const [footageRequests, setFootageRequests] = useState<FootageRequest[]>(INITIAL_FOOTAGE_REQUESTS);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>(INITIAL_INCIDENT_REPORTS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);

  // Helper function to update system settings in Firestore
  const updateSystemSettingsInFirestore = async (updatedFields: {
    nodeIp?: string;
    weather?: "SUNNY" | "RAINY";
    weatherLocation?: string;
    systemMode?: SystemMode;
  }) => {
    const { db } = getFirebaseInstances();
    if (!db) return;
    try {
      await setDoc(doc(db, "settings", "system"), updatedFields, { merge: true });
    } catch (e) {
      console.error("Error saving system settings to Firestore:", e);
    }
  };

  const handleSetNodeIp = async (ip: string) => {
    setNodeIp(ip);
    localStorage.setItem("stap_node_ip", ip);
    await updateSystemSettingsInFirestore({ nodeIp: ip });
  };

  const handleSetWeather = async (w: "SUNNY" | "RAINY") => {
    setWeather(w);
    await updateSystemSettingsInFirestore({ weather: w });
  };

  const handleUpdateWeatherLocation = async (loc: string) => {
    setWeatherLocation(loc);
    localStorage.setItem("stap_weather_location", loc);
    await updateSystemSettingsInFirestore({ weatherLocation: loc });
  };

  // Consolidated logout routine updating active registry status
  const handleLogout = async () => {
    const { auth, db } = getFirebaseInstances();
    if (currentUser) {
      const emailLower = currentUser.email?.toLowerCase() || "";
      const matchedUser = users.find(u => u.email?.toLowerCase() === emailLower);
      const userDocId = matchedUser?.id || "u-owner";

      if (db) {
        try {
          await setDoc(doc(db, "users", userDocId), {
            isOnline: false
          }, { merge: true });
        } catch (err) {
          console.error("Error setting isOnline: false on logout:", err);
        }
      } else {
        const updated = users.map(u => u.id === userDocId ? { ...u, isOnline: false } : u);
        setUsers(updated);
        STAPDatabaseManager.saveUsers(updated);
      }
    }

    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    userUpdatedRef.current = null;
    setCurrentUser(null);
    setIsAdmin(false);
    setActiveTab("DASHBOARD");
  };

  // Sync Google Auth State & Live Profile Metadata to Database Registry
  useEffect(() => {
    const { auth, db } = getFirebaseInstances();
    if (!auth) return;

    const unsubAuth = onAuthStateChanged(auth, async (user: any) => {
      if (user) {
        const userEmail = user.email || "";
        const lowerEmail = userEmail.toLowerCase().trim();
        
        // Check registry matches
        const matchedUser = users.find(u => u.email?.toLowerCase()?.trim() === lowerEmail);
        const isOwner = lowerEmail === "stap.est2526@gmail.com";
        
        let userRole = matchedUser?.role;
        let isNewUser = false;
        
        if (!matchedUser && !isOwner) {
          isNewUser = true;
          userRole = "Pending";
        } else if (isOwner) {
          userRole = matchedUser?.role || "Administrator";
        }

        const allowed = userRole !== undefined; // Any role, including Pending, is allowed to stay authenticated (but UI will restrict access)
        
        if (allowed) {
          const userName = matchedUser?.name || user.displayName || "System Owner";
          const userAvatar = user.photoURL || undefined;

          setCurrentUser({
            name: userName,
            email: userEmail,
            avatarUrl: userAvatar,
            role: userRole
          });
          
          if (userRole === "Pending") {
            setIsAdmin(false);
          } else {
            setIsAdmin(true);
          }
          
          setLoginError("");
          setShowLoginModal(false);
          setActiveTab("DASHBOARD");

          // Prevent redundant database upserts in the same session loop
          if (userUpdatedRef.current !== user.uid) {
            userUpdatedRef.current = user.uid;
            
            const formattedDate = new Date().toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "numeric",
              hour12: true
            });

            if (db) {
              try {
                if (isNewUser) {
                  const newUserId = "u-" + Date.now();
                  await setDoc(doc(db, "users", newUserId), {
                    email: lowerEmail,
                    name: userName,
                    avatarUrl: userAvatar || "",
                    role: "Pending",
                    isOnline: true,
                    lastLogin: formattedDate
                  });
                } else {
                  const userDocId = matchedUser?.id || "u-owner";
                  await setDoc(doc(db, "users", userDocId), {
                    name: userName,
                    email: userEmail,
                    role: userRole,
                    avatarUrl: userAvatar || "",
                    isOnline: true,
                    lastLogin: formattedDate
                  }, { merge: true });
                }
              } catch (err) {
                console.error("Failed to sync user login details in Firestore:", err);
              }
            } else {
              // Local state sandbox backup (simplified)
            }
          }
        } else {
          setCurrentUser(null);
          setIsAdmin(false);
          setLoginError(`Access Denied: ${userEmail} is not registered in the STAP Operator registry.`);
          
          try {
            await signOut(auth);
          } catch (err) {
            console.error("SignOut error:", err);
          }
        }
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
      }
    });

    return () => unsubAuth();
  }, [users]);

  // Reactively sync currentUser details (like role/name changes) with live registry updates
  useEffect(() => {
    if (!currentUser) return;

    const matched = users.find(u => u.email?.toLowerCase()?.trim() === currentUser.email?.toLowerCase()?.trim());
    if (matched) {
      if (currentUser.role !== matched.role || currentUser.name !== matched.name) {
        setCurrentUser(prev => prev ? {
          ...prev,
          name: matched.name,
          role: matched.role
        } : null);
        
        // Also sync isAdmin state immediately when role changes
        if (matched.role === "Pending") {
          setIsAdmin(false);
        } else {
          setIsAdmin(true);
        }
      }
    } else {
      // If their account was removed from the registry, automatically trigger logout
      if (currentUser?.email?.toLowerCase()?.trim() !== "stap.est2526@gmail.com") {
        handleLogout();
      }
    }
  }, [users]);

  // Sync Database Snapshots when custom Firebase is bound
  useEffect(() => {
    const { db } = getFirebaseInstances();
    if (!db) return;

    // 1. Live Sync Footage Requests
    const unsubFootage = onSnapshot(collection(db, "footage_requests"), (snapshot) => {
      const list: FootageRequest[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as FootageRequest);
      });
      if (list.length > 0) {
        setFootageRequests(list);
      }
      setFirebaseSyncError(null);
    }, (error) => {
      console.error("Firestore Footage Sync Error:", error);
      setFirebaseSyncError(error.message || String(error));
    });

    // 2. Live Sync Incident Reports
    const unsubIncidents = onSnapshot(collection(db, "incident_reports"), (snapshot) => {
      const list: IncidentReport[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as IncidentReport);
      });
      if (list.length > 0) {
        setIncidentReports(list);
      }
      setFirebaseSyncError(null);
    }, (error) => {
      console.error("Firestore Incident Sync Error:", error);
      setFirebaseSyncError(error.message || String(error));
    });

    // 3. Live Sync Announcements
    const unsubAnnouncements = onSnapshot(collection(db, "announcements"), (snapshot) => {
      const list: Announcement[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Announcement);
      });
      if (list.length > 0) {
        setAnnouncements(list);
      }
      setFirebaseSyncError(null);
    }, (error) => {
      console.error("Firestore Announcements Sync Error:", error);
      setFirebaseSyncError(error.message || String(error));
    });

    // 4. Live Sync System Settings
    const unsubSettings = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.nodeIp !== undefined) {
          setNodeIp(data.nodeIp);
          localStorage.setItem("stap_node_ip", data.nodeIp);
        }
        if (data.weather !== undefined) {
          setWeather(data.weather);
        }
        if (data.weatherLocation !== undefined) {
          setWeatherLocation(data.weatherLocation);
          localStorage.setItem("stap_weather_location", data.weatherLocation);
        }
        if (data.systemMode !== undefined) {
          setSystemMode(data.systemMode);
        }
      }
    }, (error) => {
      console.error("Firestore Settings Sync Error:", error);
    });

    // 5. Live Sync Users with Firestore/Local Seeding fallback
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: User[] = [];
      const seenEmails = new Set<string>();
      const duplicatesToDelete: string[] = [];

      // Sort by lastLogin or id so we prefer keeping the one that has been logged into
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
      docs.sort((a, b) => {
        if (a.lastLogin && !b.lastLogin) return -1;
        if (!a.lastLogin && b.lastLogin) return 1;
        return 0;
      });

      docs.forEach((u) => {
        const lowerEmail = u.email?.toLowerCase() || "";
        if (lowerEmail) {
          if (seenEmails.has(lowerEmail)) {
            duplicatesToDelete.push(u.id);
            return; // Skip adding to list
          }
          seenEmails.add(lowerEmail);
        }
        list.push(u);
      });

      if (list.length > 0) {
        setUsers(list);
        
        // Clean up duplicates from Firestore silently
        duplicatesToDelete.forEach(id => {
          deleteDoc(doc(db, "users", id)).catch(e => console.error("Error auto-deleting duplicate user:", e));
        });
      } else {
        // Seeding the empty collection in Firestore
        const initialUsers = STAPDatabaseManager.getUsers();
        initialUsers.forEach(async (u) => {
          try {
            await setDoc(doc(db, "users", u.id), {
              name: u.name,
              email: u.email,
              role: u.role
            });
          } catch (seedErr) {
            console.error("Failed to seed user in Firestore:", seedErr);
          }
        });
      }
    }, (error) => {
      console.error("Firestore Users Sync Error:", error);
    });

    return () => {
      unsubFootage();
      unsubIncidents();
      unsubAnnouncements();
      unsubSettings();
      unsubUsers();
    };
  }, []);

  // Dynamic mixed content bypass trigger to force secure tunnel dynamic config on Python node
  const [mixedContentTrigger, setMixedContentTrigger] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setMixedContentTrigger(Date.now());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Active, real-time status polling with hybrid local-direct and cloud-proxy fallback
  useEffect(() => {
    const fetchStatus = async () => {
      let dataFetched = false;

      // 1. Prioritize querying local Python controller directly if nodeIp is set
      if (nodeIp && nodeIp.trim()) {
        try {
          const controllerUrl = `http://${nodeIp.trim()}:5000/status?hub_origin=${encodeURIComponent(window.location.origin)}`;
          
          const controllerFetch = fetch(controllerUrl, { mode: "cors" });
          const timeoutPromise = new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error("Local fetch timeout")), 1200)
          );

          const localRes = await Promise.race([controllerFetch, timeoutPromise]);
          if (localRes.ok) {
            const contentType = localRes.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              throw new Error("Local node returned non-JSON content");
            }
            const localData = await localRes.json();
            
            setIsNodeConnected(true);
            
            // Map the Flask status format into our React types
            const rawMode = localData.mode?.toUpperCase();
            const mappedMode: SystemMode = 
              rawMode === "MANUAL" ? "MANUAL" : 
              rawMode === "HAZARD" ? "HAZARD" : 
              rawMode === "EMERGENCY" ? "EMERGENCY" : "AUTO";
            const mappedActiveLane = (localData.active_lane?.toUpperCase() || "NORTH") as Lane;
            const mappedWeather = localData.rain ? "RAINY" : "SUNNY";
            const mappedRemainingSecs = localData.remaining_secs || 0;
            
            setSystemMode(mappedMode);
            setActiveLane(mappedActiveLane);
            setWeather(mappedWeather);
            setRemainingSecs(mappedRemainingSecs);

            if (localData.lanes) {
              setLanes(localData.lanes);
            } else {
              const counts = localData.vehicle_counts || {};
              const statuses = localData.lane_statuses || {};
              const los = localData.los || {};

              setLanes({
                NORTH: {
                  count: counts.NORTH ?? counts.north ?? 0,
                  density: Math.min(100, Math.round((counts.NORTH ?? counts.north ?? 0) * 8.5)),
                  light: ((statuses.NORTH ?? statuses.north)?.toUpperCase() || "RED") as LightState,
                  los: los.NORTH ?? los.north ?? "—"
                },
                SOUTH: {
                  count: counts.SOUTH ?? counts.south ?? 0,
                  density: Math.min(100, Math.round((counts.SOUTH ?? counts.south ?? 0) * 8.5)),
                  light: ((statuses.SOUTH ?? statuses.south)?.toUpperCase() || "RED") as LightState,
                  los: los.SOUTH ?? los.south ?? "—"
                },
                EAST: {
                  count: counts.EAST ?? counts.east ?? 0,
                  density: Math.min(100, Math.round((counts.EAST ?? counts.east ?? 0) * 8.5)),
                  light: ((statuses.EAST ?? statuses.east)?.toUpperCase() || "RED") as LightState,
                  los: los.EAST ?? los.east ?? "—"
                },
                WEST: {
                  count: counts.WEST ?? counts.west ?? 0,
                  density: Math.min(100, Math.round((counts.WEST ?? counts.west ?? 0) * 8.5)),
                  light: ((statuses.WEST ?? statuses.west)?.toUpperCase() || "RED") as LightState,
                  los: los.WEST ?? los.west ?? "—"
                }
              });
            }

            dataFetched = true;
          }
        } catch (localErr) {
          // Fall back gracefully to cloud check if we cannot reach local IP
          // Silencing debug logs as per user request to avoid notification clutter
        }
      }

      // 2. Fallback check: Poll the cloud server for remote/NATed traffic data
      if (!dataFetched) {
        try {
          const res = await fetch(`/api/v1/status?t=${Date.now()}`);
          if (res.ok) {
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              throw new Error("Cloud server returned non-JSON content");
            }
            const data = await res.json();
            setIsNodeConnected(data.nodeOnline);
            
            if (data.nodeOnline) {
              setSystemMode(data.mode);
              setActiveLane(data.activeLane);
              setWeather(data.weather);
              setRemainingSecs(data.remainingSecs);
              setLanes(data.lanes);
            } else {
              // Revert back to 0-count offline structure if Python node is not active on Cloud Hub either
              setLanes({
                NORTH: { count: 0, density: 0, light: "RED", los: "—" },
                SOUTH: { count: 0, density: 0, light: "RED", los: "—" },
                EAST: { count: 0, density: 0, light: "RED", los: "—" },
                WEST: { count: 0, density: 0, light: "RED", los: "—" }
              });
            }
          }
        } catch (err) {
          console.error("STAP Live status sync error:", err);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [nodeIp]);

  // Handle footage request state adjustments
  const handleUpdateRequestStatus = async (id: string, nextStatus: FootageRequest["status"], handledBy?: string) => {
    const { db } = getFirebaseInstances();
    if (db) {
      try {
        await setDoc(doc(db, "footage_requests", id), { 
          status: nextStatus, 
          ...(handledBy ? { handledBy } : {}) 
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `footage_requests/${id}`);
      }
    } else {
      setFootageRequests((prev) =>
        prev.map((req) =>
          req.id === id
            ? { ...req, status: nextStatus, handledBy: handledBy || req.handledBy }
            : req
        )
      );
    }
  };

  // Handle incident report state additions and updates
  const handleAddIncidentReport = async (newRep: Omit<IncidentReport, "id" | "timeReported">) => {
    const timeStr = new Date().toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    const { db } = getFirebaseInstances();
    if (db) {
      try {
        await addDoc(collection(db, "incident_reports"), {
          ...newRep,
          timeReported: timeStr
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "incident_reports");
      }
    } else {
      const report: IncidentReport = {
        ...newRep,
        id: String(Math.floor(Math.random() * 900) + 200),
        timeReported: timeStr
      };
      setIncidentReports((prev) => [report, ...prev]);
    }
  };

  const handleUpdateIncidentReportStatus = async (id: string, nextStatus: IncidentReport["status"]) => {
    const { db } = getFirebaseInstances();
    if (db) {
      try {
        await setDoc(doc(db, "incident_reports", id), { status: nextStatus }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `incident_reports/${id}`);
      }
    } else {
      setIncidentReports((prev) =>
        prev.map((rep) => (rep.id === id ? { ...rep, status: nextStatus } : rep))
      );
    }
  };

  // Handle public footage request additions
  const handleAddFootageRequestPublic = async (newReq: Omit<FootageRequest, "id" | "dateSubmitted" | "status" | "handledBy">) => {
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric"
    });

    const { db } = getFirebaseInstances();
    if (db) {
      try {
        await addDoc(collection(db, "footage_requests"), {
          ...newReq,
          status: "PENDING",
          handledBy: "—",
          dateSubmitted: dateStr
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "footage_requests");
      }
    } else {
      const request: FootageRequest = {
        ...newReq,
        id: String(Math.floor(Math.random() * 90) + 15),
        status: "PENDING",
        handledBy: "—",
        dateSubmitted: dateStr
      };
      setFootageRequests((prev) => [request, ...prev]);
    }
  };

  // Handle announcement state adjustments
  const handleAddAnnouncement = async (newAnn: Omit<Announcement, "id" | "datePublished">) => {
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });

    const { db } = getFirebaseInstances();
    if (db) {
      try {
        await addDoc(collection(db, "announcements"), {
          ...newAnn,
          datePublished: dateStr
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "announcements");
      }
    } else {
      const announcement: Announcement = {
        ...newAnn,
        id: `a-${Math.random().toString(36).substring(2, 6)}`,
        datePublished: dateStr
      };
      setAnnouncements((prev) => [announcement, ...prev]);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const { db } = getFirebaseInstances();
    if (db) {
      try {
        await deleteDoc(doc(db, "announcements", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
      }
    } else {
      setAnnouncements((prev) => prev.filter((ann) => ann.id !== id));
    }
  };

  // Get screen titles to match screenshots
  const getTabTitle = () => {
    switch (activeTab) {
      case "DASHBOARD":
        return "System Dashboard";
      case "TRAFFIC_LIGHTS":
        return "Traffic Control";
      case "FOOTAGE_REQUESTS":
        return "Footage Requests";
      case "INCIDENT_REPORTS":
        return "Incident Reports";
      case "ANNOUNCEMENTS":
        return "Announcements";
      case "ANALYTICS":
        return "System Traffic Analytics";
      case "DATA_REQUEST":
        return "Footage Data Petition Portal";
      case "INCIDENT_REPORT":
        return "Public Incident Reporter";
      case "SETTINGS":
        return "Global System Settings";
      default:
        return "STAP Hub";
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#EBF0F6] text-slate-800 overflow-hidden font-sans">
      
      {/* 1. Sidebar Panel on Left (with Mobile Slide-out Drawer) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#4E6290] flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shrink-0 h-full ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Mobile Close Button */}
        <div className="absolute top-4 right-4 lg:hidden z-50">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 outline-none transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setIsMobileMenuOpen(false);
          }}
          isAdmin={isAdmin}
          onLoginClick={() => {
            setShowLoginModal(true);
            setLoginPassword("");
            setLoginError("");
            setIsMobileMenuOpen(false);
          }}
        />
      </div>

      {/* 2. Main Workflow Container on Right */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header integrated section matching screenshots */}
        <header className="bg-white border-b border-slate-200/80 px-4 py-4 md:px-8 md:py-5 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            {/* Hamburger button shown only on mobile/tablet */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden text-slate-600 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 outline-none transition-all cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h1 className="text-sm sm:text-base md:text-xl font-black text-slate-800 tracking-tight leading-none truncate">
              {getTabTitle()}
            </h1>
            {isAdmin ? (
              /* ADMIN PANEL green-dot badge */
              <span className="bg-[#1E293B] text-white text-[8px] sm:text-[9px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 sm:gap-1.5 shadow-sm shrink-0">
                <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
                <span className="hidden sm:inline">ADMIN PANEL</span>
                <span className="sm:hidden">ADMIN</span>
              </span>
            ) : (
              /* PUBLIC PORTAL blue-dot badge */
              <span className="bg-[#4E6290] text-white text-[8px] sm:text-[9px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 sm:gap-1.5 shadow-sm shrink-0">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="hidden sm:inline">PUBLIC PORTAL</span>
                <span className="sm:hidden">PUBLIC</span>
              </span>
            )}
          </div>

          {/* Right actions: user identity and navigation */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0">
            {currentUser ? (
              <div className="hidden md:flex text-xs font-semibold text-slate-500 items-center gap-1.5 select-none">
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} className="w-5 h-5 rounded-full object-cover shadow-xs border border-slate-200" referrerPolicy="no-referrer" alt="" />
                ) : (
                  <span className="text-slate-400">👤</span>
                )}
                <span className="font-bold text-slate-700">{currentUser?.name || "Crissel Ann G. Zapatero"}</span>
                {currentUser.role === "Pending" && (
                  <span className="bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold ml-1 uppercase">Pending</span>
                )}
                <span className="text-slate-300 ml-1">|</span>
                <span className="font-mono text-[11px] tracking-wider text-slate-400">JUNE 27, 2026</span>
              </div>
            ) : (
              <div className="hidden md:flex text-xs font-semibold text-slate-500 items-center gap-1.5 select-none">
                <span className="text-slate-400">👥</span>
                <span className="font-bold text-slate-700">Guest Citizen Access</span>
                <span className="text-slate-300">|</span>
                <span className="font-mono text-[11px] tracking-wider text-slate-400">JUNE 27, 2026</span>
              </div>
            )}

            {currentUser ? (
              <div className="flex gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[10px] sm:text-xs px-2 sm:px-3.5 py-1.5 rounded-lg transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <span className="hidden sm:inline">← PUBLIC SIDE</span>
                  <span className="sm:hidden">← PUB</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-[10px] sm:text-xs px-2.5 sm:px-3.5 py-1.5 rounded-lg transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  LOG OUT
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(true);
                  setLoginPassword("");
                  setLoginError("");
                }}
                className="bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-[10px] sm:text-xs px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                ADMIN LOGIN
              </button>
            )}
          </div>
        </header>

        {/* 3. Main Workspace Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {firebaseSyncError && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex gap-3 items-start">
                  <div className="p-2.5 bg-amber-100/60 border border-amber-200/80 text-amber-800 rounded-xl mt-0.5 md:mt-0">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Firestore Rules Setup Required (Missing Permissions)</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Your app is connected to custom project <span className="font-mono text-[10px] bg-slate-150 px-1 py-0.5 rounded text-slate-700 font-bold">{getFirebaseConfig().projectId}</span>, but reads/writes are blocked. To enable real-time features, copy the contents of the <span className="font-mono text-[10px] bg-slate-150 px-1 py-0.5 rounded text-slate-700 font-bold">firestore.rules</span> file in this workspace into the <strong>Firestore Database &rarr; Rules</strong> tab of your Firebase Console.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("SETTINGS")}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  Configure Firebase Rules
                </button>
              </div>
            )}

            {currentUser?.role === "Pending" ? (
              <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-6 animate-fadeIn">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mb-2">
                  <Clock className="w-10 h-10 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Account Approval Pending</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Your request to access the STAP Operator Dashboard has been submitted successfully and is currently under review by system administrators. 
                  <br/><br/>
                  You will be able to access the dashboard once your request is approved.
                </p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-6 py-3 rounded-xl transition-all cursor-pointer shadow-sm mt-4"
                >
                  Return to Public View
                </button>
              </div>
            ) : (
              <>
                {activeTab === "DASHBOARD" && (
                  <DashboardTab
                    isNodeConnected={isNodeConnected}
                    lanes={lanes}
                    activeLane={activeLane}
                    remainingSecs={remainingSecs}
                    nodeIp={nodeIp}
                    weather={weather}
                    weatherLocation={weatherLocation}
                  />
                )}

                {/* Admin-only Tabs with safeguards */}
                {activeTab === "TRAFFIC_LIGHTS" && isAdmin && (
              <ControlTab
                nodeIp={nodeIp}
                setNodeIp={handleSetNodeIp}
                isNodeConnected={isNodeConnected}
                setIsNodeConnected={setIsNodeConnected}
                mode={systemMode}
                lanes={lanes}
                onChangeMode={async (m) => {
                  setSystemMode(m);
                  await updateSystemSettingsInFirestore({ systemMode: m });
                  
                  // 1. Sync state to cloud server immediately
                  try {
                    await fetch("/api/v1/control", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ mode: m })
                    });
                  } catch (e) {
                    console.error("Cloud control sync error:", e);
                  }

                  // 2. Dispatch REST command to physical local Python node
                  if (nodeIp) {
                    try {
                      const pythonMode = m?.toLowerCase() || "auto";
                      await fetch(`http://${nodeIp.trim()}:5000/control/mode`, {
                        method: "POST",
                        mode: "cors",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mode: pythonMode })
                      });
                    } catch (e) {
                      console.warn("Could not sync directly with local STAP node IP. Will sync via cloud.", e);
                    }
                  }
                }}
                activeLane={activeLane}
                onSetLaneLight={async (lane, light) => {
                  setActiveLane(lane);
                  
                  // 1. Sync manual state to cloud server
                  try {
                    await fetch("/api/v1/control", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        mode: "MANUAL",
                        activeLane: lane,
                        ...(!isNodeConnected ? {
                          lanes: {
                            NORTH: { light: lane === "NORTH" ? "GREEN" : "RED" },
                            SOUTH: { light: lane === "SOUTH" ? "GREEN" : "RED" },
                            EAST: { light: lane === "EAST" ? "GREEN" : "RED" },
                            WEST: { light: lane === "WEST" ? "GREEN" : "RED" }
                          }
                        } : {})
                      })
                    });
                  } catch (e) {
                    console.error("Cloud light sync error:", e);
                  }

                  // 2. Sync to local physical Python controller
                  if (nodeIp) {
                    try {
                      // Ensure manual mode is selected
                      await fetch(`http://${nodeIp.trim()}:5000/control/mode`, {
                        method: "POST",
                        mode: "cors",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mode: "manual" })
                      });

                      // Trigger light override
                      await fetch(`http://${nodeIp.trim()}:5000/control/light`, {
                        method: "POST",
                        mode: "cors",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lane, state: (light || "RED").toLowerCase() })
                      });
                    } catch (e) {
                      console.warn("Could not directly contact local STAP node:", e);
                    }
                  }
                }}
                weather={weather}
                weatherLocation={weatherLocation}
                remainingSecs={remainingSecs}
              />
            )}

            {activeTab === "FOOTAGE_REQUESTS" && isAdmin && (
              <FootageRequestsTab
                requests={footageRequests}
                onUpdateRequestStatus={handleUpdateRequestStatus}
              />
            )}

            {activeTab === "INCIDENT_REPORTS" && isAdmin && (
              <IncidentReportsTab
                reports={incidentReports}
                onAddReport={handleAddIncidentReport}
                onUpdateReportStatus={handleUpdateIncidentReportStatus}
              />
            )}

            {activeTab === "ANNOUNCEMENTS" && isAdmin && (
              <AnnouncementsTab
                announcements={announcements}
                onAddAnnouncement={handleAddAnnouncement}
                onDeleteAnnouncement={handleDeleteAnnouncement}
              />
            )}

            {activeTab === "ANALYTICS" && isAdmin && (
              <AnalyticsTab />
            )}
            
            {activeTab === "CLOUD_ARCHIVE" && isAdmin && (
              <GoogleDriveTab />
            )}

            {/* Public-only Tabs */}
            {activeTab === "DATA_REQUEST" && !isAdmin && (
              <PublicDataRequest
                requests={footageRequests}
                onSubmitRequest={handleAddFootageRequestPublic}
              />
            )}

            {activeTab === "INCIDENT_REPORT" && !isAdmin && (
              <PublicIncidentReport
                reports={incidentReports}
                onAddReport={handleAddIncidentReport}
              />
            )}

            {activeTab === "SETTINGS" && isAdmin && (
              <SettingsTab
                nodeIp={nodeIp}
                setNodeIp={handleSetNodeIp}
                isNodeConnected={isNodeConnected}
                setIsNodeConnected={setIsNodeConnected}
                setLanes={setLanes}
                weather={weather}
                setWeather={handleSetWeather}
                isAdmin={isAdmin}
                weatherLocation={weatherLocation}
                onUpdateWeatherLocation={handleUpdateWeatherLocation}
                users={users}
                setUsers={setUsers}
              />
            )}
              </>
            )}

          </div>
        </main>
      </div>

      {/* 4. Administrator Authentication Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-5 text-left animate-scaleIn">
            <div className="text-center space-y-1.5">
              <div className="flex justify-center pb-2">
                <img 
                  src={stapLogo} 
                  alt="STAP Logo" 
                  className="h-14 w-auto object-contain" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                STAP Operator Authentication
              </h3>
              <p className="text-xs text-slate-400 font-semibold">
                Sign in with your Google Account to manage traffic signals
              </p>
            </div>

            <div className="space-y-4">
              {getFirebaseConfig().connected ? (
                <button
                  type="button"
                  onClick={async () => {
                    const { auth, provider, db } = getFirebaseInstances();
                    if (auth && provider && db) {
                      try {
                        setLoginError("");
                        await signInWithPopup(auth, provider);
                        // All auth flow logic, including checking for permissions and creating
                        // pending users, is now handled globally in the onAuthStateChanged listener.
                        // We do not close the modal here; onAuthStateChanged will handle it if successful.
                      } catch (err: any) {
                        console.error("Google auth error:", err);
                        setLoginError(err.message || "Failed to authenticate with Google Account.");
                      }
                    }
                  }}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2.5 shadow-xs outline-none"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-xs">Sign in with Google Account</span>
                </button>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-xs leading-relaxed font-semibold">
                  ⚠️ Firebase Connection Offline: Google Authentication is not configured. Please define your Firebase environment variables (e.g., VITE_FIREBASE_API_KEY) in your environment settings or hardcode them in 'src/firebase.ts' to enable secure sign-in.
                </div>
              )}
 
              {loginError && (
                <p className="text-[11px] font-bold text-red-500 bg-red-50 border border-red-100 p-3 rounded-lg leading-relaxed">
                  {loginError}
                </p>
              )}
 
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                }}
                className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Removed insecure heartbeat hack to prevent Mixed Content errors. Connection status is now derived from the primary STAP database. */}
    </div>
  );
}
