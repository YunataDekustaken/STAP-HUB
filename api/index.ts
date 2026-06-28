import express, { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

// Clean CORS Middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const AUTHORIZATION_TOKEN = "node_alpha_J7FVxdRBqwCBWQSdiKBN742lMHuEPX5A";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "stap-hub";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

// Helper to interact with Firestore via pure, stateless HTTP REST API
async function firestoreREST(method: "GET" | "PATCH", documentPath: string, data?: any) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${documentPath}${FIREBASE_API_KEY ? `?key=${FIREBASE_API_KEY}` : ""}`;
  
  const options: RequestInit = {
    method: method,
    headers: { "Content-Type": "application/json" }
  };

  if (data && method === "PATCH") {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST Error (${res.status}): ${errText}`);
  }
  return res.json();
}

// --- API ROUTE: Handle Python Ledger Uploads ---
app.post("/api/v1/upload-ledger", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTHORIZATION_TOKEN}`) {
      return res.status(401).json({ success: false, error: "Unauthorized Bearer Token" });
    }

    const { filename, csvData } = req.body;
    if (!filename || typeof csvData !== "string") {
      return res.status(400).json({ success: false, error: "Missing filename or valid csvData string." });
    }

    const cleanFilename = filename.replace(/\\/g, "/").split("/").pop() || "summary.csv";
    const safeDocId = cleanFilename.replace(/[.#$/[\]]/g, "_");
    
    // Serverless-safe ESModule byte length check
    const byteLength = new TextEncoder().encode(csvData).length;

    // Map fields directly to the Firestore REST API JSON structure
    const firestorePayload = {
      fields: {
        filename: { stringValue: cleanFilename },
        size: { integerValue: String(byteLength) },
        uploadedAt: { stringValue: new Date().toISOString() },
        csvData: { stringValue: csvData },
        syncedAt: { stringValue: new Date().toISOString() }
      }
    };

    // Upsert using the PATCH method over HTTP REST
    await firestoreREST("PATCH", `ledgers/${safeDocId}`, firestorePayload);

    return res.json({
      success: true,
      message: `Ledger ${cleanFilename} uploaded and processed successfully to the cloud.`,
      savedLocally: false,
      savedToCloud: true
    });

  } catch (err: any) {
    console.error("[STAP REST ERROR]", err);
    return res.status(500).json({ success: false, error: err.message || "Internal serverless worker error." });
  }
});

// --- API ROUTE: Synchronize System State ---
app.post("/api/v1/control", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const userAgent = req.headers["user-agent"] || "";
    const isFromPython = (authHeader === `Bearer ${AUTHORIZATION_TOKEN}`) || userAgent.toLowerCase().includes("python");

    const { mode, activeLane, weather, lanes, remainingSecs, greenDuration } = req.body;

    // Fetch existing state via REST API to merge fields dynamically
    let currentState: any = {};
    try {
      const existing = await firestoreREST("GET", "system/state");
      if (existing && existing.fields) {
        currentState = existing.fields;
      }
    } catch (e) {
      // Document doesn't exist yet, start clean
    }

    if (mode) currentState.mode = { stringValue: mode };
    if (activeLane) currentState.activeLane = { stringValue: activeLane };
    if (weather) currentState.weather = { stringValue: weather };
    if (remainingSecs !== undefined) currentState.remainingSecs = { integerValue: String(remainingSecs) };
    if (greenDuration !== undefined) currentState.greenDuration = { integerValue: String(greenDuration) };
    if (isFromPython) currentState.heartbeatTime = { integerValue: String(Date.now()) };

    if (lanes) {
      const currentLanesMap = currentState.lanes?.mapValue?.fields || {};
      Object.keys(lanes).forEach((key) => {
        currentLanesMap[key] = {
          mapValue: {
            fields: {
              count: { integerValue: String(lanes[key].count || 0) },
              density: { integerValue: String(lanes[key].density || 0) },
              light: { stringValue: lanes[key].light || "RED" },
              los: { stringValue: lanes[key].los || "A" }
            }
          }
        };
      });
      currentState.lanes = { mapValue: { fields: currentLanesMap } };
    }

    currentState.updatedAt = { stringValue: new Date().toISOString() };

    await firestoreREST("PATCH", "system/state", { fields: currentState });
    return res.json({ success: true, message: "State synced successfully." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- API ROUTE: Real-time Status ---
app.get("/api/v1/status", async (req: Request, res: Response) => {
  try {
    let fields: any = {};
    try {
      const data = await firestoreREST("GET", "system/state");
      fields = data.fields || {};
    } catch (e) {}

    const heartbeat = Number(fields.heartbeatTime?.integerValue || 0);
    const nodeOnline = Date.now() - heartbeat < 20000;

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    return res.json({
      mode: fields.mode?.stringValue || "AUTO",
      activeLane: fields.activeLane?.stringValue || "NORTH",
      weather: fields.weather?.stringValue || "SUNNY",
      remainingSecs: Number(fields.remainingSecs?.integerValue || 0),
      greenDuration: Number(fields.greenDuration?.integerValue || 0),
      nodeOnline,
      serverTime: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default app;