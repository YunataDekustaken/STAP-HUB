// Dynamic client-side Firebase manager that integrates with user's personal Firebase project
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc,
  getDocFromServer
} from "firebase/firestore";
import { FirebaseConnectionConfig, TrafficHistoryLog, User, Role } from "./types";

interface FirebaseSavedSettings {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function saveFirebaseConfig(config: FirebaseSavedSettings) {
  localStorage.setItem("stap_firebase_config", JSON.stringify(config));
}

// HARDCODED FIREBASE INTEGRATION VALUES
// You can:
// 1. Paste your Firebase Web App configuration credentials directly in this object.
// 2. Or configure them as Environment Variables on Vercel with a "VITE_FIREBASE_" prefix (e.g., VITE_FIREBASE_API_KEY).
const HARDCODED_FIREBASE_CREDENTIALS = {
  apiKey: "AIzaSyDoX-your-hardcoded-api-key", // REPLACE WITH YOUR ACTUAL FIREBASE API KEY (e.g. "AIzaSy...")
  authDomain: "stap-est-manila.firebaseapp.com", // REPLACE WITH YOUR ACTUAL AUTH DOMAIN
  projectId: "stap-est-manila", // REPLACE WITH YOUR ACTUAL PROJECT ID
  storageBucket: "stap-est-manila.appspot.com", // REPLACE WITH YOUR ACTUAL STORAGE BUCKET
  messagingSenderId: "895471203058", // REPLACE WITH YOUR ACTUAL MESSAGING SENDER ID
  appId: "1:895471203058:web:b1d8f1d5e6b7c8d9e0a1f2" // REPLACE WITH YOUR ACTUAL APP ID
};

export function getFirebaseConfig(): FirebaseConnectionConfig {
  // 1. Check if environment variables are provided (e.g. in Vercel deployment)
  const metaEnv = (import.meta as any).env || {};
  const envApiKey = metaEnv.VITE_FIREBASE_API_KEY;
  const envAuthDomain = metaEnv.VITE_FIREBASE_AUTH_DOMAIN;
  const envProjectId = metaEnv.VITE_FIREBASE_PROJECT_ID;
  const envStorageBucket = metaEnv.VITE_FIREBASE_STORAGE_BUCKET;
  const envMessagingSenderId = metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const envAppId = metaEnv.VITE_FIREBASE_APP_ID;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: envAuthDomain || "",
      projectId: envProjectId,
      storageBucket: envStorageBucket || "",
      messagingSenderId: envMessagingSenderId || "",
      appId: envAppId || "",
      connected: true
    };
  }

  // 2. Check if hardcoded values are filled and are NOT default placeholders
  const hc = HARDCODED_FIREBASE_CREDENTIALS;
  const isHcValid = hc.apiKey && 
                    hc.apiKey.trim() !== "" && 
                    !hc.apiKey.includes("your-hardcoded-api-key") && 
                    !hc.apiKey.startsWith("YOUR_");

  if (isHcValid) {
    return {
      apiKey: hc.apiKey.trim(),
      authDomain: hc.authDomain?.trim() || "",
      projectId: hc.projectId.trim(),
      storageBucket: hc.storageBucket?.trim() || "",
      messagingSenderId: hc.messagingSenderId?.trim() || "",
      appId: hc.appId?.trim() || "",
      connected: true
    };
  }

  // 3. Fallback to localStorage (manually entered settings)
  const saved = localStorage.getItem("stap_firebase_config");
  if (!saved) {
    return {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: "",
      connected: false
    };
  }
  try {
    const parsed = JSON.parse(saved);
    return {
      ...parsed,
      connected: !!parsed.apiKey && !!parsed.projectId
    };
  } catch {
    return {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: "",
      connected: false
    };
  }
}

// Global Firebase Instance Holders
let firebaseAppInitialized = false;
let dbInstance: any = null;
let authInstance: any = null;
const googleProviderInstance = new GoogleAuthProvider();

export function getFirebaseInstances() {
  const config = getFirebaseConfig();
  if (!config.connected) {
    return { app: null, db: null, auth: null, provider: null };
  }

  try {
    if (!firebaseAppInitialized) {
      const app = getApps().length === 0 ? initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      }) : getApp();
      
      dbInstance = getFirestore(app);
      authInstance = getAuth(app);
      firebaseAppInitialized = true;

      // Validate connection to Firestore immediately as mandated by Firebase skill guidelines
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(dbInstance, 'test', 'connection'));
        } catch (error: any) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration: Client is offline.");
          }
        }
      };
      testConnection();
    }
    return {
      app: getApp(),
      db: dbInstance,
      auth: authInstance,
      provider: googleProviderInstance
    };
  } catch (err) {
    console.error("Failed to initialize custom Firebase configuration:", err);
    return { app: null, db: null, auth: null, provider: null };
  }
}

// Error diagnostic helper conforming strictly to security-spec format
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const { auth } = getFirebaseInstances();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('STAP Firestore Error Diagnostic Log: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Local Database Fallback Seed Generator
export class STAPDatabaseManager {
  private static STORAGE_KEY = "stap_traffic_logs_persistent";

  static getUsers(): User[] {
    const stored = localStorage.getItem("stap_users_persistent");
    if (!stored) {
      const initialUsers: User[] = [
        { id: "u-owner", name: "System Owner", email: "stap.est2526@gmail.com", role: "Administrator" },
        { id: "u-1", name: "Super Admin", email: "admin@stap.gov", role: "Administrator" },
        { id: "u-2", name: "Commissioner Carter", email: "commissioner@stap.gov", role: "Traffic Commissioner" },
        { id: "u-3", name: "Inspector Martinez", email: "martinez@stap.gov", role: "Inspector" },
        { id: "u-4", name: "Analyst Chen", email: "chen@stap.gov", role: "Operations Analyst" }
      ];
      localStorage.setItem("stap_users_persistent", JSON.stringify(initialUsers));
      return initialUsers;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  static saveUsers(users: User[]): void {
    localStorage.setItem("stap_users_persistent", JSON.stringify(users));
  }

  static getLogs(): TrafficHistoryLog[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      const initialLogs: TrafficHistoryLog[] = this.generateSeedLogs();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialLogs));
      return initialLogs;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  static addLog(log: Omit<TrafficHistoryLog, "id">): TrafficHistoryLog {
    const logs = this.getLogs();
    const newLog: TrafficHistoryLog = {
      ...log,
      id: Math.random().toString(36).substring(2, 11)
    };
    logs.unshift(newLog);
    if (logs.length > 100) {
      logs.pop();
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    return newLog;
  }

  static clearLogs(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
  }

  private static generateSeedLogs(): TrafficHistoryLog[] {
    const list: TrafficHistoryLog[] = [];
    const baseTime = Date.now();
    for (let i = 12; i >= 0; i--) {
      const timeOffset = i * 10 * 60 * 1000; 
      const time = new Date(baseTime - timeOffset).toISOString();
      list.push({
        id: `seed-${i}`,
        timestamp: time,
        north: { count: Math.floor(Math.random() * 8) + 1, density: Math.floor(Math.random() * 32) + 12, light: "RED", los: "B" },
        south: { count: Math.floor(Math.random() * 12) + 3, density: Math.floor(Math.random() * 45) + 20, light: "GREEN", los: "D" },
        east: { count: Math.floor(Math.random() * 6) + 1, density: Math.floor(Math.random() * 25) + 10, light: "RED", los: "B" },
        west: { count: Math.floor(Math.random() * 16) + 4, density: Math.floor(Math.random() * 65) + 35, light: "RED", los: "E" },
        activeLane: "SOUTH",
        mode: "AUTO",
        weather: "SUNNY",
        triggeredBy: "YOLO API"
      });
    }
    return list;
  }
}
