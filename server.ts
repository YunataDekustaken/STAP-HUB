import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import * as admin from "firebase-admin";
import { google } from "googleapis";

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

// Helper to resolve the correct uploads folder. On Vercel, we bypass this entirely.
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

// Validate structure of uploaded or edited CSV ledger files
function validateCSV(csvText: string): { valid: boolean; error?: string } {
  if (!csvText || typeof csvText !== "string") {
    return { valid: false, error: "Empty or invalid text format." };
  }
  const lines = csvText.split(/\r?\n/).map(l => l.trim());
  
  let hasSessionStart = false;
  let hasInterval = false;
  let hasSummary = false;
  let hasLaneApproach = false;

  for (const line of lines) {
    if (line.includes("Session Start Initialization Time") || line.includes("Session Start")) hasSessionStart = true;
    if (line.startsWith("--- INTERVAL RECORDING SNAPSHOT")) hasInterval = true;
    if (line.includes("FINAL INTERSECTION REPORT SUMMARY MATRIX") || line.includes("FINAL INTERSECTION REPORT")) hasSummary = true;
    if (line.includes("Lane Approach") || line.includes("Approach Lane Name")) hasLaneApproach = true;
  }

  if (!hasSessionStart) {
    return { valid: false, error: "Missing 'Session Start' metadata header." };
  }
  if (!hasInterval && !hasSummary) {
    return { valid: false, error: "Ledger must contain at least one Interval Snapshot or a Final Summary." };
  }
  if (!hasLaneApproach) {
    return { valid: false, error: "Missing column headers row (e.g., 'Lane Approach' or 'Approach Lane Name')." };
  }

  try {
    let laneCount = 0;
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length > 0 && ["NORTH", "SOUTH", "EAST", "WEST"].includes(parts[0].trim())) {
        laneCount++;
      }
    }
    if (laneCount === 0) {
      return { valid: false, error: "No lane data rows (NORTH, SOUTH, EAST, or WEST) found." };
    }
  } catch (e) {
    return { valid: false, error: "Invalid CSV table structure." };
  }

  return { valid: true };
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

// --- GOOGLE WORKSPACE API SETUP ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || "";
const APP_URL = process.env.APP_URL || "";

function createOAuth2Client(req?: Request) {
  let redirectOrigin = APP_URL;
  
  if (!redirectOrigin && req) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    redirectOrigin = `${protocol}://${host}`;
  }

  if (!redirectOrigin) {
    redirectOrigin = "https://stap-hub.vercel.app";
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${redirectOrigin}/api/auth/google/callback`
  );
}

/**
 * Helper function to get an auto-refreshing Google Auth Client.
 * It prioritizes the refresh token from Firestore, falling back to process.env.
 */
async function getAutoRefreshingAuthClient() {
  let refreshToken = GOOGLE_REFRESH_TOKEN;

  // 1. Fetch the saved permanent refresh token from Firestore if available
  if (db) {
    try {
      const authSnap = await db.collection("system").doc("google_auth").get();
      if (authSnap.exists) {
        const data = authSnap.data();
        if (data?.refresh_token) {
          refreshToken = data.refresh_token;
        }
      }
    } catch (e) {
      console.warn("[STAP HUB] Failed to fetch refresh token from Firestore, falling back to environment variable.");
    }
  }

  if (!refreshToken) {
    throw new Error("Google Workspace not connected. Please connect your account in Admin Settings or set GOOGLE_REFRESH_TOKEN.");
  }

  // 2. Create a clean OAuth instance
  const authClient = createOAuth2Client();

  // 3. Set the refresh token
  authClient.setCredentials({
    refresh_token: refreshToken
  });

  // 4. Listen for token updates (e.g. if Google issues a new refresh token)
  authClient.on("tokens", async (newTokens) => {
    if (newTokens.refresh_token && db) {
      await db.collection("system").doc("google_auth").set({
        refresh_token: newTokens.refresh_token,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log("[STAP HUB] Google issued and updated a new refresh token in Firestore.");
    }
  });

  return authClient;
}

// Serverless safe Firebase Admin Initialization
const HAS_FIREBASE_CREDS = !!(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY);

let db: admin.firestore.Firestore | null = null;
if (HAS_FIREBASE_CREDS) {
  try {
    if (!admin.apps || !admin.apps.length) {
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
      });
    }
    db = admin.firestore();
    console.log(`[STAP HUB] Firebase Admin initialized for project: ${process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID}`);
  } catch (err) {
    console.error("[STAP HUB] Failed to initialize Firebase Admin SDK:", err);
  }
} else {
  console.log("[STAP HUB] Firebase server-side sync disabled (credentials missing in environment variables)");
}

// Sync the local memory state to Firestore Cloud Database using stateless Admin SDK
async function syncStateToFirestore() {
  if (!db) return;
  try {
    await withTimeout(
      db.collection("system").doc("state").set({
        ...systemState,
        updatedAt: new Date().toISOString()
      }),
      5000,
      "syncStateToFirestore set"
    );
  } catch (err) {
    console.error("[STAP HUB] Error syncing state to Firestore:", err);
  }
}

// Load the state from Firestore Cloud Database using stateless Admin SDK
async function loadStateFromFirestore() {
  if (!db) return;
  try {
    const snap = await withTimeout(
      db.collection("system").doc("state").get(),
      5000,
      "loadStateFromFirestore get"
    );
    if (snap.exists) {
      const data = snap.data();
      if (data) {
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
    }
  } catch (err) {
    console.error("[STAP HUB] Error loading state from Firestore:", err);
  }
}

const app = express();
const PORT = 3000;

// Let json body parser accept up to 15mb for carrying base64 image data safely
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
    buildMarker: "stap-hub-debug-v2-admin-sdk",
    firebaseConfigured: !!db,
    nodeEnv: process.env.NODE_ENV || null,
    isVercel: !!process.env.VERCEL,
    timestamp: new Date().toISOString()
  });
});

// --- API ROUTE: Receive Real-Time YOLO Snapshot Postings ---
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

  await loadStateFromFirestore();

  const combinedCount = (cars || 0) + (trucks || 0) + (motorcycles || 0) + (buses || 0) + (emergency_vehicles || 0);
  const estimatedDensity = Math.min(100, Math.round(combinedCount * 7.5 + Math.random() * 5));

  systemState.lanes[laneKey] = {
    count: combinedCount,
    density: estimatedDensity,
    light: systemState.lanes[laneKey].light,
    los: congestion || "A",
  };

  systemState.heartbeatTime = Date.now();

  await syncStateToFirestore();

  res.json({ success: true, message: `Snapshot parsed successfully for ${laneKey}` });
}));

// --- API ROUTE: Hardware Node Heartbeat ---
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
app.post("/api/v1/upload-ledger", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${AUTHORIZATION_TOKEN}`) {
    return res.status(401).json({ success: false, error: "Unauthorized Bearer Token" });
  }

  const { filename, csvData } = req.body;
  if (!filename || typeof csvData !== "string") {
    return res.status(400).json({ success: false, error: "Missing filename or valid csvData string in request body." });
  }

  const normalizedFilename = filename.replace(/\\/g, "/");
  const safeFilename = path.basename(normalizedFilename);
  const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");

  const isVercel = !!process.env.VERCEL;
  let savedLocally = false;
  let savedToCloud = false;

  try {
    // 1. Local disk backup is bypassed COMPLETELY on Vercel to prevent Read-Only system crashes
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
    }

    // 2. Stateless HTTP Request to Cloud Firestore
    if (db) {
      try {
        await withTimeout(
          db.collection("ledgers").doc(safeDocId).set({
            filename: safeFilename,
            size: Buffer.byteLength(csvData, "utf8"),
            uploadedAt: new Date().toISOString(),
            sourceType: "python_controller",
            csvData: csvData,
            syncedAt: new Date().toISOString()
          }),
          5000,
          "upload-ledger Firestore set"
        );
        savedToCloud = true;
        console.log(`[STAP HUB] Ledger saved to Firestore Cloud via Admin SDK: ${safeFilename}`);
      } catch (cloudErr) {
        console.error("[STAP HUB] Firestore upload failed:", cloudErr);
      }
    }

    if (savedLocally || savedToCloud) {
      return res.json({
        success: true,
        message: `Ledger ${safeFilename} processed successfully.`,
        savedLocally,
        savedToCloud
      });
    }

    return res.status(503).json({ success: false, error: "Cloud database and storage features are currently offline." });
  } catch (err: any) {
    console.error("[STAP HUB] Failed to save ledger upload:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save file on server." });
  }
}));

// --- API ROUTE: List all uploaded ledgers ---
app.get("/api/v1/ledgers", asyncHandler(async (req: Request, res: Response) => {
  try {
    const ledgersMap = new Map<string, any>();
    const isVercel = !!process.env.VERCEL;

    // 1. Read local folder if not on Vercel
    if (!isVercel) {
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
    }

    // 2. Fetch via Admin SDK
    if (db) {
      try {
        const querySnapshot = await withTimeout(
          db.collection("ledgers").get(),
          5000,
          "list ledgers get"
        );
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const existing = ledgersMap.get(data.filename);
          ledgersMap.set(data.filename, {
            filename: data.filename,
            size: data.size,
            uploadedAt: data.uploadedAt,
            sourceType: data.sourceType || "python_controller",
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
    const isVercel = !!process.env.VERCEL;

    if (!isVercel) {
      const filePath = path.join(getUploadsDir(), safeFilename);
      if (fs.existsSync(filePath)) {
        const csvData = fs.readFileSync(filePath, "utf8");
        return res.json({ success: true, filename: safeFilename, csvData });
      }
    }

    // Fallback to Admin Firestore
    if (db) {
      try {
        const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");
        const docSnap = await withTimeout(
          db.collection("ledgers").doc(safeDocId).get(),
          5000,
          "get ledger get"
        );
        if (docSnap.exists) {
          const data = docSnap.data();
          if (data) {
            return res.json({ success: true, filename: safeFilename, csvData: data.csvData });
          }
        }
      } catch (dbErr) {
        console.error("[STAP HUB] Failed to retrieve ledger from Firestore:", dbErr);
      }
    }

    return res.status(404).json({ success: false, error: "Ledger file not found locally or in cloud database." });
  } catch (err: any) {
    console.error("[STAP HUB] Failed to retrieve ledger content:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to retrieve file content." });
  }
}));

// --- API ROUTE: Update a specific ledger's content ---
app.put("/api/v1/ledgers/:filename", asyncHandler(async (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const { csvData } = req.body;
    const isVercel = !!process.env.VERCEL;

    if (!csvData || typeof csvData !== "string") {
      return res.status(400).json({ success: false, error: "Missing csvData string in request body." });
    }

    // Validate structure
    const validation = validateCSV(csvData);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: `CSV Structure Validation Failed: ${validation.error}` });
    }

    const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");
    const byteLength = Buffer.byteLength(csvData, "utf8");

    let savedLocally = false;
    if (!isVercel) {
      try {
        const filePath = path.join(getUploadsDir(), safeFilename);
        fs.writeFileSync(filePath, csvData, "utf8");
        savedLocally = true;
      } catch (fsErr) {
        console.warn("[STAP HUB] Local write failed on edit:", fsErr);
      }
    }

    let savedToCloud = false;
    if (db) {
      try {
        // To preserve original uploadedAt, we fetch existing
        let uploadedAt = new Date().toISOString();
        const docRef = db.collection("ledgers").doc(safeDocId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          if (data && data.uploadedAt) {
            uploadedAt = data.uploadedAt;
          }
        }

        await withTimeout(
          docRef.set({
            filename: safeFilename,
            size: byteLength,
            uploadedAt,
            csvData,
            syncedAt: new Date().toISOString()
          }),
          5000,
          "edit ledger Firestore set"
        );
        savedToCloud = true;
      } catch (dbErr) {
        console.error("[STAP HUB] Failed to update ledger in Firestore on edit:", dbErr);
      }
    }

    return res.json({
      success: true,
      message: `Ledger ${safeFilename} updated successfully.`,
      savedLocally,
      savedToCloud
    });
  } catch (err: any) {
    console.error("[STAP HUB] Failed to update ledger:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update file." });
  }
}));

// --- API ROUTE: Delete a specific ledger ---
app.delete("/api/v1/ledgers/:filename", asyncHandler(async (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const isVercel = !!process.env.VERCEL;

    let deletedLocal = false;
    if (!isVercel) {
      const filePath = path.join(getUploadsDir(), safeFilename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedLocal = true;
      }
    }

    let deletedCloud = false;
    if (db) {
      try {
        const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");
        await withTimeout(
          db.collection("ledgers").doc(safeDocId).delete(),
          5000,
          "delete ledger delete"
        );
        deletedCloud = true;
      } catch (dbErr) {
        console.error("[STAP HUB] Failed to delete ledger from Firestore:", dbErr);
      }
    }

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
  const nodeOnline = Date.now() - systemState.heartbeatTime < 20000;
  res.json({
    ...systemState,
    nodeOnline,
    serverTime: new Date().toISOString(),
  });
}));

// --- API ROUTE: Force Set Intersection Mode or Lights (Used by Web Console) ---
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

// --- API ROUTE: Proxy for Insecure Python Stream Status (Bypasses HTTPS Mixed Content) ---
app.get("/api/v1/proxy-python-status", asyncHandler(async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).json({ success: false, error: "Missing 'url' parameter." });

  try {
    // Only allow status endpoints for proxying to prevent open proxy abuse
    if (!targetUrl.includes("/status")) {
      return res.status(403).json({ success: false, error: "Only status endpoint proxying is permitted." });
    }

    const response = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`Target returned ${response.status}`);
    
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: `Proxy failed: ${err.message}` });
  }
}));

// --- API ROUTE: Proxy for Insecure Python Control POST commands (Bypasses HTTPS Mixed Content) ---
app.post("/api/v1/proxy-python-control", asyncHandler(async (req: Request, res: Response) => {
  const { targetUrl, body } = req.body;
  if (!targetUrl) return res.status(400).json({ success: false, error: "Missing 'targetUrl' parameter." });

  try {
    // Only allow control/mode or control/light endpoints to prevent abuse
    if (!targetUrl.includes("/control/")) {
      return res.status(403).json({ success: false, error: "Only control endpoint proxying is permitted." });
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) throw new Error(`Target returned ${response.status}`);
    
    const contentType = response.headers.get("content-type");
    let responseData;
    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = { text: await response.text() };
    }
    res.json(responseData);
  } catch (err: any) {
    res.status(502).json({ success: false, error: `Control proxy failed: ${err.message}` });
  }
}));

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";

// --- API ROUTE: Gmail - Send Report with Attachment ---
app.post("/api/gmail/send-report", asyncHandler(async (req: Request, res: Response) => {
  const { to, subject, body, attachment, filename } = req.body;
  if (!to || !body) {
    return res.status(400).json({ success: false, error: "Missing 'to' or 'body' in request." });
  }

  try {
    const auth = await getAutoRefreshingAuthClient();
    const gmail = google.gmail({ version: "v1", auth });
    
    const boundary = "stap_hub_boundary_" + Date.now();
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject || "STAP Hub Report").toString("base64")}?=`;

    let message = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body).toString("base64"),
      ""
    ].join("\r\n");

    if (attachment) {
      message += [
        `--${boundary}`,
        `Content-Type: application/pdf; name="${filename || 'report.pdf'}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename || 'report.pdf'}"`,
        "",
        attachment, // Assuming base64 data
        ""
      ].join("\r\n");
    }

    message += `--${boundary}--`;

    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    res.json({ success: true, message: "Email sent successfully with attachment." });
  } catch (err: any) {
    console.error("[STAP HUB] Gmail Send Report Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}));

// --- API ROUTE: Google Drive - Upload File ---
app.post("/api/google/drive-upload", asyncHandler(async (req: Request, res: Response) => {
  const { filename, content, mimeType, folderName } = req.body;
  if (!filename || !content) {
    return res.status(400).json({ success: false, error: "Missing filename or content." });
  }

  try {
    const auth = await getAutoRefreshingAuthClient();
    const drive = google.drive({ version: "v3", auth });

    // 1. Find or create the target folder
    let parentId: string | undefined;
    const targetFolderName = folderName || "STAP Reports";
    
    const folderSearch = await drive.files.list({
      q: `name = '${targetFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id)",
      pageSize: 1
    });

    if (folderSearch.data.files && folderSearch.data.files.length > 0) {
      parentId = folderSearch.data.files[0].id!;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: targetFolderName,
          mimeType: "application/vnd.google-apps.folder"
        },
        fields: "id"
      });
      parentId = folder.data.id!;
    }

    // 2. Upload the file
    const stream = new (require("stream").Readable)();
    stream.push(Buffer.from(content, "base64"));
    stream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: parentId ? [parentId] : []
      },
      media: {
        mimeType: mimeType || "application/pdf",
        body: stream
      },
      fields: "id, webViewLink"
    });

    res.json({ success: true, fileId: response.data.id, link: response.data.webViewLink });
  } catch (err: any) {
    console.error("[STAP HUB] Drive Upload Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}));

// --- API ROUTE: Google Auth - Status ---
app.get("/api/auth/google/status", asyncHandler(async (req: Request, res: Response) => {
  try {
    const auth = await getAutoRefreshingAuthClient();
    const oauth2 = google.oauth2({ version: "v2", auth });
    const userInfo = await oauth2.userinfo.get();
    
    res.json({ 
      success: true, 
      connected: true, 
      email: userInfo.data.email 
    });
  } catch (err: any) {
    res.json({ success: true, connected: false, error: err.message });
  }
}));

// --- API ROUTE: Weather Configuration & Data ---
app.get("/api/weather/config", asyncHandler(async (req: Request, res: Response) => {
  if (!db) return res.json({ success: true, location: "Marikina City" });
  try {
    const snap = await db.collection("system").doc("weather_config").get();
    if (snap.exists) {
      res.json({ success: true, ...snap.data() });
    } else {
      res.json({ success: true, location: "Marikina City" });
    }
  } catch (err: any) {
    res.json({ success: true, location: "Marikina City", error: err.message });
  }
}));

app.post("/api/weather/config", asyncHandler(async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ success: false, error: "Database not connected" });
  try {
    const { location } = req.body;
    await db.collection("system").doc("weather_config").set({ 
      location, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

app.get("/api/weather/forecast", asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!WEATHER_API_KEY) {
      return res.status(500).json({ success: false, error: "Weather API Key not configured." });
    }

    let location = "Marikina City";
    if (db) {
      const snap = await db.collection("system").doc("weather_config").get();
      if (snap.exists && snap.data()?.location) {
        location = snap.data()?.location;
      }
    }

    const response = await fetch(`http://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(location)}&days=3&aqi=no&alerts=no`);
    if (!response.ok) {
      throw new Error(`WeatherAPI returned ${response.status}`);
    }
    const data = await response.json();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// --- API ROUTE: Google Auth - Get URL ---
app.get("/api/auth/google/url", (req: Request, res: Response) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ 
        success: false, 
        error: "Google OAuth Credentials missing in environment variables (GOOGLE_CLIENT_ID/SECRET)." 
      });
    }

    const oauth2Client = createOAuth2Client(req);
    const scopes = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/userinfo.email"
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent"
    });

    console.log(`[STAP HUB] Generated Google Auth URL`);
    res.json({ success: true, url });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- API ROUTE: Google Auth - Callback ---
app.get("/api/auth/google/callback", asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided.");

  const oauth2Client = createOAuth2Client(req);
  const { tokens } = await oauth2Client.getToken(code as string);
  const refreshToken = tokens.refresh_token;

  // Store the permanent refresh token in Firestore for background auto-refreshing
  if (refreshToken && db) {
    await db.collection("system").doc("google_auth").set({
      refresh_token: refreshToken,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log("[STAP HUB] Permanent Google Refresh Token saved to Firestore.");
  }

  res.send(`
    <html>
      <body style="font-family: sans-serif; padding: 40px; line-height: 1.6; background: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
          <h2 style="color: #22C55E; margin-top: 0;">✓ Google Account Connected!</h2>
          <p style="color: #475569;">You have successfully authorized the STAP Traffic Automation Program to access your workspace.</p>
          ${refreshToken ? `
            <div style="background: #F1F5F9; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px dashed #CBD5E1;">
              <p style="font-weight: bold; margin-top: 0; font-size: 14px; color: #1E293B;">Permanent Refresh Token Issued:</p>
              <code style="word-break: break-all; background: #FFF; padding: 10px; display: block; border: 1px solid #E2E8F0; border-radius: 6px; font-size: 12px; font-family: monospace;">${refreshToken}</code>
              <p style="font-size: 11px; color: #64748B; margin-bottom: 0; margin-top: 10px;">This token has been securely stored in your Firestore database for background automation.</p>
            </div>
          ` : `<p style="color: #64748B;">No new refresh token was issued by Google (you likely have an existing active session). The system will continue using the stored token.</p>`}
          <button onclick="window.close()" style="padding: 12px 24px; background: #0F172A; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Close & Return to Dashboard</button>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS", refreshToken: "${refreshToken || ''}" }, "*");
          }
        </script>
      </body>
    </html>
  `);
}));

// --- API ROUTE: Google Drive - Configuration ---
app.get("/api/google/drive-config", asyncHandler(async (req: Request, res: Response) => {
  if (!db) return res.json({ success: true, folderId: "" });
  try {
    const snap = await db.collection("system").doc("google_drive_config").get();
    if (snap.exists) {
      res.json({ success: true, ...snap.data() });
    } else {
      res.json({ success: true, folderId: "" });
    }
  } catch (err: any) {
    res.json({ success: true, folderId: "", error: err.message });
  }
}));

app.post("/api/google/drive-config", asyncHandler(async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ success: false, error: "Database not connected" });
  try {
    const { folderId } = req.body;
    await db.collection("system").doc("google_drive_config").set({ 
      folderId, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// --- API ROUTE: Gmail - Send Reply to Footage Request ---
app.post("/api/footage-requests/reply", asyncHandler(async (req: Request, res: Response) => {
  const { to, subject, body } = req.body;
  if (!to || !body) {
    return res.status(400).json({ success: false, error: "Missing 'to' or 'body' in request." });
  }

  try {
    const auth = await getAutoRefreshingAuthClient();
    const gmail = google.gmail({ version: "v1", auth });
    
    // Create raw email string
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject || "Response to Footage Request").toString("base64")}?=`;
    const messageParts = [
      `To: ${to}`,
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: ${utf8Subject}`,
      "",
      body,
    ];
    const message = messageParts.join("\n");
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    res.json({ success: true, message: "Email sent successfully via Gmail API." });
  } catch (err: any) {
    console.error("[STAP HUB] Gmail Send Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}));

// Fetch Live Gmail Inbox Messages
app.get("/api/gmail/messages", asyncHandler(async (req: Request, res: Response) => {
  const auth = await getAutoRefreshingAuthClient();
  if (!auth) {
    return res.status(401).json({ error: "Google account not connected" });
  }

  try {
    const gmail = google.gmail({ version: "v1", auth });
    
    // 1. List latest 15 messages
    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: 15,
      q: "-from:me" // Exclude sent mail to show actual inbox
    });

    const messages = listRes.data.messages || [];
    const detailedMessages = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full"
        });

        const headers = detail.data.payload?.headers || [];
        const subject = headers.find(h => h.name === "Subject")?.value || "(No Subject)";
        const from = headers.find(h => h.name === "From")?.value || "Unknown Sender";
        const date = headers.find(h => h.name === "Date")?.value || "";

        // Simple body extraction
        let body = "";
        const parts = detail.data.payload?.parts || [];
        if (detail.data.payload?.body?.data) {
          body = Buffer.from(detail.data.payload.body.data, 'base64').toString();
        } else if (parts.length > 0) {
          // Find first text/plain or text/html part
          const textPart = parts.find(p => p.mimeType === "text/plain") || parts[0];
          if (textPart.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString();
          }
        }

        return {
          id: detail.data.id,
          threadId: detail.data.threadId,
          subject,
          from,
          date,
          snippet: detail.data.snippet,
          body: body.substring(0, 5000), // Cap size
          timestamp: detail.data.internalDate ? new Date(parseInt(detail.data.internalDate)).toISOString() : new Date().toISOString()
        };
      })
    );

    res.json({ success: true, messages: detailedMessages });
  } catch (error: any) {
    console.error("Gmail List Error:", error);
    res.status(500).json({ error: "Failed to fetch Gmail messages" });
  }
}));

// --- API ROUTE: Google Drive - List Files & Folders ---
app.get("/api/google/drive-files", asyncHandler(async (req: Request, res: Response) => {
  try {
    const auth = await getAutoRefreshingAuthClient();
    const drive = google.drive({ version: "v3", auth });
    
    // Fetch both folders and files (prioritizing videos but showing everything)
    const response = await drive.files.list({
      q: "trashed = false",
      fields: "files(id, name, mimeType, webViewLink, thumbnailLink, size, createdTime, iconLink)",
      orderBy: "folder,name",
      pageSize: 50
    });

    res.json({ success: true, files: response.data.files });
  } catch (err: any) {
    console.error("[STAP HUB] Drive List Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}));

// Global Express error-handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("[STAP HUB] Global error caught:", err);
  res.status(500).json({
    success: false,
    error: err.message || "An unexpected server error occurred."
  });
});

// --- API ROUTE: Handle Manual User Ledger Uploads ---
app.post("/api/v1/upload-manual-ledger", asyncHandler(async (req: Request, res: Response) => {
  const { filename, csvData } = req.body;
  if (!filename || !csvData || typeof csvData !== "string") {
    return res.status(400).json({ success: false, error: "Missing filename or valid csvData string in request body." });
  }

  // Basic validation
  if (csvData.trim().length < 10) {
    return res.status(400).json({ success: false, error: "CSV content is too short or empty." });
  }

  const validation = validateCSV(csvData);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: `CSV Structure Validation Failed: ${validation.error}` });
  }

  const safeFilename = path.basename(filename.replace(/\\/g, "/"));
  const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");

  let savedToCloud = false;
  if (db) {
    try {
      await withTimeout(
        db.collection("ledgers").doc(safeDocId).set({
          filename: safeFilename,
          size: Buffer.byteLength(csvData, "utf8"),
          uploadedAt: new Date().toISOString(),
          sourceType: "user_uploaded",
          csvData: csvData,
          syncedAt: new Date().toISOString()
        }),
        5000,
        "upload-manual-ledger Firestore set"
      );
      savedToCloud = true;
    } catch (cloudErr) {
      console.error("[STAP HUB] Firestore manual upload failed:", cloudErr);
    }
  }

  if (savedToCloud) {
    return res.json({
      success: true,
      message: `Manual ledger ${safeFilename} uploaded successfully.`,
      sourceType: "user_uploaded",
      savedToCloud
    });
  }

  return res.status(503).json({ success: false, error: "Cloud database features are currently offline." });
}));

// Legal Routes for standalone access (served as index.html for client routing)
app.get(["/privacy-policy", "/terms-of-service", "/tos", "/privacy"], (req, res) => {
  const distPath = path.join(process.cwd(), "dist");
  // Check if we are in production and dist exists
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // In dev, the SPA is handled by Vite middleware which is added later
    // If it falls through here, we just redirect or let it be handled by next()
    res.redirect("/");
  }
});

// Configure Vite or serve static files
async function configureFrontend() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[STAP HUB] Vite development middleware integrated.");
    } catch (e) {
      console.warn("[STAP HUB] Vite failed to load (expected in production).");
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
      console.log("[STAP HUB] Serving production static assets from dist/.");
    } else {
      console.warn("[STAP HUB] dist/ directory not found. Is the app built?");
    }
  }
}

if (!process.env.VERCEL) {
  configureFrontend().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`STAP Traffic Hub Express server online at http://0.0.0.0:${PORT}`);
    });
  });
} else {
  console.log("[STAP HUB] Running on Vercel Serverless Platform safely.");
}

export default app;