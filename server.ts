import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

dotenv.config();

// Global crash protection for unhandled exceptions & promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("[STAP HUB] Unhandled Promise Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[STAP HUB] Uncaught Exception occurred:", error);
});

// Robust Promise timeout wrapper to prevent hanging client SDK calls in serverless environments
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000, contextName: string = "Firestore operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${contextName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Helper to wrap async routes and forward errors to Express global middleware
const asyncHandler = (fn: (req: Request, res: Response, next: any) => Promise<any>) => {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Helper to resolve the correct uploads folder. On Vercel, we must write to /tmp.
function getUploadsDir(): string {
  const isVercel = !!process.env.VERCEL;
  const dir = isVercel ? "/tmp/uploads" : path.join(process.cwd(), "uploads");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.warn(`[STAP HUB] Failed to create uploads directory at ${dir}:`, err);
    }
  }
  return dir;
}

// Set up server-side type and state structures to track physical hardware node status
interface LaneData {
  count: number;
  density: number;
  light: "RED" | "YELLOW" | "GREEN";
  los: string;
}

interface WebAppSharedState {
  mode: "AUTO" | "MANUAL" | "HAZARD" | "EMERGENCY";
  activeLane: "NORTH" | "SOUTH" | "EAST" | "WEST";
  weather: "SUNNY" | "RAINY";
  heartbeatTime: number; // last heartbeat
  remainingSecs: number;
  greenDuration: number;
  lanes: {
    NORTH: LaneData;
    SOUTH: LaneData;
    EAST: LaneData;
    WEST: LaneData;
  };
}

let systemState: WebAppSharedState = {
  mode: "AUTO",
  activeLane: "NORTH",
  weather: "SUNNY",
  heartbeatTime: 0,
  remainingSecs: 45,
  greenDuration: 50,
  lanes: {
    NORTH: { count: 3, density: 15, light: "GREEN", los: "B" },
    SOUTH: { count: 12, density: 47, light: "RED", los: "D" },
    EAST: { count: 4, density: 22, light: "RED", los: "B" },
    WEST: { count: 9, density: 38, light: "RED", los: "C" },
  },
};

const CAMERA_ID_TO_LANE: Record<number, "NORTH" | "SOUTH" | "EAST" | "WEST"> = {
  1: "NORTH",
  2: "SOUTH",
  3: "EAST",
  4: "WEST",
};

const AUTHORIZATION_TOKEN = "node_alpha_J7FVxdRBqwCBWQSdiKBN742lMHuEPX5A";

// Initialize Firebase App & Firestore if credentials are provided in the environment
const FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID
};

let db: any = null;
if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId) {
  try {
    const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
    db = getFirestore(app);
    console.log(`[STAP HUB] Firebase initialized on server for project: ${FIREBASE_CONFIG.projectId}`);
  } catch (err) {
    console.error("[STAP HUB] Failed to initialize Firebase on server:", err);
  }
} else {
  console.log("[STAP HUB] Firebase server-side sync disabled (credentials missing in environment variables)");
}

// Sync the local memory state to Firestore Cloud Database
async function syncStateToFirestore() {
  if (!db) return;
  try {
    await withTimeout(
      setDoc(doc(db, "system", "state"), {
        ...systemState,
        updatedAt: new Date().toISOString()
      }),
      5000,
      "syncStateToFirestore setDoc"
    );
  } catch (err) {
    console.error("[STAP HUB] Error syncing state to Firestore:", err);
  }
}

// Load the state from Firestore Cloud Database to synchronize stateless containers
async function loadStateFromFirestore() {
  if (!db) return;
  try {
    const snap = await withTimeout(
      getDoc(doc(db, "system", "state")),
      5000,
      "loadStateFromFirestore getDoc"
    );
    if (snap.exists()) {
      const data = snap.data();
      systemState = {
        mode: data.mode || systemState.mode,
        activeLane: data.activeLane || systemState.activeLane,
        weather: data.weather || systemState.weather,
        heartbeatTime: data.heartbeatTime || systemState.heartbeatTime,
        remainingSecs: data.remainingSecs !== undefined ? data.remainingSecs : systemState.remainingSecs,
        greenDuration: data.greenDuration !== undefined ? data.greenDuration : systemState.greenDuration,
        lanes: data.lanes || systemState.lanes
      };
    }
  } catch (err) {
    console.error("[STAP HUB] Error loading state from Firestore:", err);
  }
}

const app = express();
const PORT = 3000;

// Let json body parser accept up to 15mb for carrying base64 image data from Python safely
app.use(express.json({ limit: "15mb" }));

// CORS Middleware for direct browser interactions
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// --- API ROUTE: Debug Version Info (No auth required) ---
app.get("/api/v1/debug-version", (req: Request, res: Response) => {
  res.json({
    success: true,
    buildMarker: "stap-hub-debug-v1",
    firebaseConfigured: !!db,
    nodeEnv: process.env.NODE_ENV || null,
    isVercel: !!process.env.VERCEL,
    timestamp: new Date().toISOString()
  });
});

// --- API ROUTE: Receive Real-Time YOLO Snapshot Postings ---
// Matches Python: STAP_HUB_URL = "https://<app-url>/api/v1/snapshots"
app.post("/api/v1/snapshots", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${AUTHORIZATION_TOKEN}`) {
    return res.status(401).json({ success: false, error: "Unauthorized Bearer Token" });
  }

  const {
    camera_id,
    cars,
    trucks,
    motorcycles,
    buses,
    emergency_vehicles,
    congestion,
  } = req.body;

  const laneKey = CAMERA_ID_TO_LANE[camera_id as number];
  if (!laneKey) {
    return res.status(400).json({ success: false, error: `Invalid camera_id: ${camera_id}` });
  }

  // Load existing cloud state first if stateless
  await loadStateFromFirestore();

  // Process snapshot counts & estimate occupancy percentage
  const combinedCount = (cars || 0) + (trucks || 0) + (motorcycles || 0) + (buses || 0) + (emergency_vehicles || 0);
  const estimatedDensity = Math.min(100, Math.round(combinedCount * 7.5 + Math.random() * 5));

  // Update internal server data in-memory
  systemState.lanes[laneKey] = {
    count: combinedCount,
    density: estimatedDensity,
    light: systemState.lanes[laneKey].light,
    los: congestion || "A",
  };

  systemState.heartbeatTime = Date.now();

  // Mirror to Cloud Firestore
  await syncStateToFirestore();

  res.json({ success: true, message: `Snapshot parsed successfully for ${laneKey}` });
}));

// --- API ROUTE: Hardware Node Heartbeat ---
// Matches Python: STAP_HEARTBEAT_URL = "https://<app-url>/api/v1/heartbeat"
app.post("/api/v1/heartbeat", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${AUTHORIZATION_TOKEN}`) {
    return res.status(401).json({ success: false, error: "Unauthorized Heartbeat Token" });
  }

  await loadStateFromFirestore();
  systemState.heartbeatTime = Date.now();
  await syncStateToFirestore();

  res.json({ success: true, status: "alive" });
}));

// --- API ROUTE: Upload CSV Ledger Data ---
// Save finalized CSV ledger data to server directory and/or Firebase Firestore Cloud
app.post("/api/v1/upload-ledger", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${AUTHORIZATION_TOKEN}`) {
    return res.status(401).json({ success: false, error: "Unauthorized Bearer Token" });
  }

  const { filename, csvData } = req.body;
  if (!filename || typeof csvData !== "string") {
    return res.status(400).json({ success: false, error: "Missing filename or valid csvData string in request body." });
  }

  // Normalize path separators (convert all Windows \ to Linux /)
  const normalizedFilename = filename.replace(/\\/g, "/");
  const safeFilename = path.basename(normalizedFilename);
  const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");

  try {
    const isVercel = !!process.env.VERCEL;
    let savedLocally = false;

    // 1. Save locally as fallback if NOT running on Vercel
    if (!isVercel) {
      try {
        const uploadsDir = getUploadsDir();
        const filePath = path.join(uploadsDir, safeFilename);

        fs.writeFileSync(filePath, csvData, "utf8");
        savedLocally = true;
        console.log(`[STAP HUB] Ledger saved locally: ${safeFilename}`);
      } catch (fsErr) {
        console.warn("[STAP HUB] Local write bypassed:", fsErr);
      }
    } else {
      console.log(`[STAP HUB] Running on Vercel. Bypassing local filesystem write for ${safeFilename}.`);
    }

    // 2. Upload directly to Firestore Cloud Database if connected (best-effort, max 5s timeout)
    let savedToCloud = false;
    if (db) {
      try {
        await withTimeout(
          setDoc(doc(db, "ledgers", safeDocId), {
            filename: safeFilename,
            size: Buffer.byteLength(csvData, "utf8"),
            uploadedAt: new Date().toISOString(),
            csvData: csvData,
            syncedAt: new Date().toISOString()
          }),
          5000,
          "upload-ledger Firestore setDoc"
        );
        savedToCloud = true;
        console.log(`[STAP HUB] Ledger saved to Firestore Cloud successfully: ${safeFilename}`);
      } catch (cloudErr) {
        console.error("[STAP HUB] Firestore upload failed or timed out:", cloudErr);
      }
    }

    if (savedLocally || savedToCloud) {
      return res.json({
        success: true,
        message: `Ledger ${safeFilename} uploaded and processed successfully.`,
        savedLocally,
        savedToCloud
      });
    }

    throw new Error(
      isVercel
        ? "Firebase Cloud is not configured or failed to save on Vercel environment."
        : "Local filesystem is write-protected and Firebase Cloud is not configured."
    );
  } catch (err: any) {
    console.error("[STAP HUB] Failed to save ledger upload:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save file on server." });
  }
}));

// --- API ROUTE: List all uploaded ledgers ---
app.get("/api/v1/ledgers", asyncHandler(async (req: Request, res: Response) => {
  try {
    const ledgersMap = new Map<string, any>();

    // 1. Load local logs if any
    const uploadsDir = getUploadsDir();
    if (fs.existsSync(uploadsDir)) {
      try {
        const files = fs.readdirSync(uploadsDir);
        files
          .filter((file) => file.endsWith(".csv") || file.endsWith(".txt"))
          .forEach((file) => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            ledgersMap.set(file, {
              filename: file,
              size: stats.size,
              uploadedAt: stats.mtime.toISOString(),
              source: "local"
            });
          });
      } catch (fsErr) {
        console.warn("[STAP HUB] Failed to read local logs folder:", fsErr);
      }
    }

    // 2. Load Firestore logs if configured
    if (db) {
      try {
        const { getDocs, collection } = await import("firebase/firestore");
        const querySnapshot = await withTimeout(
          getDocs(collection(db, "ledgers")),
          5000,
          "list ledgers getDocs"
        );
        querySnapshot.forEach((docSnap: any) => {
          const data = docSnap.data();
          const existing = ledgersMap.get(data.filename);
          ledgersMap.set(data.filename, {
            filename: data.filename,
            size: data.size,
            uploadedAt: data.uploadedAt,
            source: existing ? "synced" : "cloud"
          });
        });
      } catch (dbErr) {
        console.error("[STAP HUB] Failed to fetch ledger logs from Firestore:", dbErr);
      }
    }

    const ledgers = Array.from(ledgersMap.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return res.json({ success: true, ledgers });
  } catch (err: any) {
    console.error("[STAP HUB] Failed to list ledgers:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to list files." });
  }
}));

// --- API ROUTE: Get a specific ledger's content ---
app.get("/api/v1/ledgers/:filename", asyncHandler(async (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(getUploadsDir(), safeFilename);

    if (fs.existsSync(filePath)) {
      const csvData = fs.readFileSync(filePath, "utf8");
      return res.json({ success: true, filename: safeFilename, csvData });
    }

    // Fallback to Firestore Cloud
    if (db) {
      try {
        const { getDoc, doc } = await import("firebase/firestore");
        const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");
        const docSnap = await withTimeout(
          getDoc(doc(db, "ledgers", safeDocId)),
          5000,
          "get ledger getDoc"
        );
        if (docSnap.exists()) {
          const data = docSnap.data();
          return res.json({ success: true, filename: safeFilename, csvData: data.csvData });
        }
      } catch (dbErr) {
        console.error("[STAP HUB] Failed to retrieve ledger from Firestore:", dbErr);
      }
    }

    return res.status(404).json({ success: false, error: "Ledger file not found locally or in Cloud Firestore database." });
  } catch (err: any) {
    console.error("[STAP HUB] Failed to retrieve ledger content:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to retrieve file content." });
  }
}));

// --- API ROUTE: Delete a specific ledger ---
app.delete("/api/v1/ledgers/:filename", asyncHandler(async (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(getUploadsDir(), safeFilename);

    let deletedLocal = false;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deletedLocal = true;
    }

    let deletedCloud = false;
    if (db) {
      try {
        const { deleteDoc, doc } = await import("firebase/firestore");
        const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");
        await withTimeout(
          deleteDoc(doc(db, "ledgers", safeDocId)),
          5000,
          "delete ledger deleteDoc"
        );
        deletedCloud = true;
      } catch (dbErr) {
        console.error("[STAP HUB] Failed to delete ledger from Firestore:", dbErr);
      }
    }

    console.log(`[STAP HUB] Ledger deleted: ${safeFilename} (local: ${deletedLocal}, cloud: ${deletedCloud})`);
    return res.json({
      success: true,
      message: `Ledger ${safeFilename} deleted successfully.`,
      deletedLocal,
      deletedCloud
    });
  } catch (err: any) {
    console.error("[STAP HUB] Failed to delete ledger:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to delete file." });
  }
}));

// --- API ROUTE: Integrated Hub Status State getter ---
app.get("/api/v1/status", asyncHandler(async (req: Request, res: Response) => {
  await loadStateFromFirestore();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  // Be generous: 20 seconds. If any packet has been parsed in the last 20 seconds
  const nodeOnline = Date.now() - systemState.heartbeatTime < 20000;
  res.json({
    ...systemState,
    nodeOnline,
    serverTime: new Date().toISOString(),
  });
}));

// --- API ROUTE: Force Set Intersection Mode or Lights (Used by Web Console/Dashboard) ---
app.post("/api/v1/control", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const userAgent = req.headers["user-agent"] || "";
  const isFromPython = (authHeader === `Bearer ${AUTHORIZATION_TOKEN}`) || userAgent.toLowerCase().includes("python");

  const { mode, activeLane, weather, lanes, remainingSecs, greenDuration } = req.body;

  await loadStateFromFirestore();

  if (isFromPython) {
    systemState.heartbeatTime = Date.now();
  }

  if (mode !== undefined) systemState.mode = mode;
  if (activeLane !== undefined) systemState.activeLane = activeLane;
  if (weather !== undefined) systemState.weather = weather;
  if (remainingSecs !== undefined) systemState.remainingSecs = remainingSecs;
  if (greenDuration !== undefined) systemState.greenDuration = greenDuration;

  if (lanes) {
    systemState.lanes = {
      ...systemState.lanes,
      ...lanes,
    };
  }

  // Direct automated updates on active lights matching the state
  if (!isFromPython) {
    if (systemState.mode === "AUTO") {
      Object.keys(systemState.lanes).forEach((l) => {
        const lane = l as "NORTH" | "SOUTH" | "EAST" | "WEST";
        systemState.lanes[lane].light = lane === systemState.activeLane ? "GREEN" : "RED";
      });
    } else if (systemState.mode === "HAZARD") {
      Object.keys(systemState.lanes).forEach((l) => {
        const lane = l as "NORTH" | "SOUTH" | "EAST" | "WEST";
        systemState.lanes[lane].light = "YELLOW";
      });
    } else if (systemState.mode === "EMERGENCY") {
      Object.keys(systemState.lanes).forEach((l) => {
        const lane = l as "NORTH" | "SOUTH" | "EAST" | "WEST";
        systemState.lanes[lane].light = "RED";
      });
    }
  }

  await syncStateToFirestore();

  res.json({ success: true, state: systemState });
}));

// Global Express error-handling middleware registered after all routes to prevent Vercel 500 overrides
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("[STAP HUB] Global error caught:", err);
  res.status(500).json({
    success: false,
    error: err.message || "An unexpected server error occurred."
  });
});

// Configure Vite or serve static files
async function configureFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// In standard dev or custom production runner, set up Vite/Static and start listening
if (!process.env.VERCEL) {
  configureFrontend().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`STAP Traffic Hub Express server online at http://0.0.0.0:${PORT}`);
    });
  });
} else {
  // If running in Vercel environment, let standard routing work without the custom Vite middleware server
  console.log("[STAP HUB] Running on Vercel Serverless Platform.");
}

export default app;
