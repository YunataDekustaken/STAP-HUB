import express, { Request, Response } from "express";
import * as admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

// Clean CORS Policy 
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const AUTHORIZATION_TOKEN = "node_alpha_J7FVxdRBqwCBWQSdiKBN742lMHuEPX5A";

// Serverless-Safe Firebase Admin Initialize
if ((process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID) && !admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
    });
    console.log("[STAP SERVERLESS] Firebase Admin initialized successfully.");
  } catch (err) {
    console.error("[STAP SERVERLESS] Firebase Admin init error:", err);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

// --- API ROUTE: Handle Python Ledger Uploads ---
app.post("/api/v1/upload-ledger", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTHORIZATION_TOKEN}`) {
      return res.status(401).json({ success: false, error: "Unauthorized Bearer Token" });
    }

    const { filename, csvData } = req.body;
    if (!filename || typeof csvData !== "string") {
      return res.status(400).json({ success: false, error: "Missing filename or valid csvData string in request body." });
    }

    if (!db) {
      return res.status(503).json({ success: false, error: "Database initialization failed or credentials unconfigured on Vercel." });
    }

    const cleanFilename = filename.replace(/\\/g, "/").split("/").pop() || "summary.csv";
    const safeDocId = cleanFilename.replace(/[.#$/[\]]/g, "_");

    // Stateless database insertion
    await db.collection("ledgers").doc(safeDocId).set({
      filename: cleanFilename,
      size: Buffer.byteLength(csvData, "utf8"),
      uploadedAt: new Date().toISOString(),
      csvData: csvData,
      syncedAt: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: `Ledger ${cleanFilename} processed successfully to cloud storage.`,
      savedLocally: false,
      savedToCloud: true
    });

  } catch (err: any) {
    console.error("[STAP SERVERLESS CRASH] Endpoint encountered an error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal serverless worker error." });
  }
});

// --- API ROUTE: Synchronize System State ---
app.post("/api/v1/control", async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: "Database offline" });
    
    const authHeader = req.headers.authorization;
    const userAgent = req.headers["user-agent"] || "";
    const isFromPython = (authHeader === `Bearer ${AUTHORIZATION_TOKEN}`) || userAgent.toLowerCase().includes("python");

    const { mode, activeLane, weather, lanes, remainingSecs, greenDuration } = req.body;
    const docRef = db.collection("system").doc("state");
    
    const snap = await docRef.get();
    let currentState = snap.exists ? snap.data() || {} : {};

    if (mode !== undefined) currentState.mode = mode;
    if (activeLane !== undefined) currentState.activeLane = activeLane;
    if (weather !== undefined) currentState.weather = weather;
    if (remainingSecs !== undefined) currentState.remainingSecs = remainingSecs;
    if (greenDuration !== undefined) currentState.greenDuration = greenDuration;
    if (lanes) currentState.lanes = { ...currentState.lanes, ...lanes };
    if (isFromPython) currentState.heartbeatTime = Date.now();

    await docRef.set({ ...currentState, updatedAt: new Date().toISOString() });
    return res.json({ success: true, state: currentState });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- API ROUTE: Real-time Status ---
app.get("/api/v1/status", async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: "Database offline" });
    const snap = await db.collection("system").doc("state").get();
    const currentState = snap.exists ? snap.data() || {} : {};
    const nodeOnline = Date.now() - (currentState.heartbeatTime || 0) < 20000;
    
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    return res.json({ ...currentState, nodeOnline, serverTime: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Failsafe catch-all for missing assets
app.get("/api/v1/debug-version", (req: Request, res: Response) => {
  res.json({ success: true, serverlessMode: true, firebaseConnected: !!db });
});

export default app;