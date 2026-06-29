import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import { google } from "googleapis";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

// Clean CORS Middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const AUTHORIZATION_TOKEN = "node_alpha_J7FVxdRBqwCBWQSdiKBN742lMHuEPX5A";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "stap-hub";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

// --- GOOGLE WORKSPACE API SETUP (Synced with server.ts) ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || "";
const APP_URL = process.env.APP_URL || "";

function createOAuth2Client(req?: Request) {
  let redirectOrigin = APP_URL;
  if (!redirectOrigin && req) {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.get("host");
    redirectOrigin = `${protocol}://${host}`;
  }
  if (!redirectOrigin) redirectOrigin = "https://stap-hub.vercel.app";

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${redirectOrigin}/api/auth/google/callback`
  );
}

async function getAutoRefreshingAuthClient() {
  // 1. Try to fetch refresh token from Firestore REST
  let refreshToken = GOOGLE_REFRESH_TOKEN;
  try {
    const authSnap = await firestoreREST("GET", "system/google_auth");
    if (authSnap && authSnap.fields?.refresh_token?.stringValue) {
      refreshToken = authSnap.fields.refresh_token.stringValue;
    }
  } catch (e) {
    // Fallback to env
  }

  if (!refreshToken) {
    throw new Error("Google Workspace not connected. Please connect your account in Admin Settings or set GOOGLE_REFRESH_TOKEN.");
  }

  const authClient = createOAuth2Client();
  authClient.setCredentials({ refresh_token: refreshToken });

  authClient.on("tokens", async (newTokens) => {
    if (newTokens.refresh_token) {
      try {
        await firestoreREST("PATCH", "system/google_auth", {
          fields: {
            refresh_token: { stringValue: newTokens.refresh_token },
            updatedAt: { stringValue: new Date().toISOString() }
          }
        });
      } catch (err) {
        console.error("Failed to update new refresh token in Firestore REST:", err);
      }
    }
  });

  return authClient;
}

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

// --- API ROUTE: Proxy for Insecure Python Stream Status (Bypasses HTTPS Mixed Content) ---
app.get("/api/v1/proxy-python-status", async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).json({ success: false, error: "Missing 'url' parameter." });

  try {
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
});

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";

// --- API ROUTE: Google Auth - Status ---
app.get("/api/auth/google/status", async (req: Request, res: Response) => {
  try {
    const auth = await getAutoRefreshingAuthClient();
    if (!auth) return res.json({ success: true, connected: false });
    
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
});

// --- API ROUTE: Gmail - Send Report with Attachment ---
app.post("/api/gmail/send-report", async (req: Request, res: Response) => {
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
});

// --- API ROUTE: Google Drive - Upload File ---
app.post("/api/google/drive-upload", async (req: Request, res: Response) => {
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
});

// --- API ROUTE: Google Drive - Configuration ---
app.get("/api/google/drive-config", async (req: Request, res: Response) => {
  try {
    const snap = await firestoreREST("GET", "system/google_drive_config");
    if (snap && snap.fields?.folderId?.stringValue) {
      return res.json({ success: true, folderId: snap.fields.folderId.stringValue });
    }
    res.json({ success: true, folderId: "" });
  } catch (err: any) {
    res.json({ success: true, folderId: "" });
  }
});

app.post("/api/google/drive-config", async (req: Request, res: Response) => {
  try {
    const { folderId } = req.body;
    await firestoreREST("PATCH", "system/google_drive_config", {
      fields: {
        folderId: { stringValue: folderId || "" },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- API ROUTE: Weather Configuration & Data ---
app.get(["/api/weather/config", "/weather/config"], async (req: Request, res: Response) => {
  try {
    const snap = await firestoreREST("GET", "system/weather_config");
    if (snap && snap.fields?.location?.stringValue) {
      return res.json({ success: true, location: snap.fields.location.stringValue });
    }
    res.json({ success: true, location: process.env.WEATHER_LOCATION || "Marikina City" });
  } catch (err: any) {
    res.json({ success: true, location: process.env.WEATHER_LOCATION || "Marikina City" });
  }
});

app.post(["/api/weather/config", "/weather/config"], async (req: Request, res: Response) => {
  try {
    const { location } = req.body;
    if (!location) return res.status(400).json({ success: false, error: "Missing location" });
    
    await firestoreREST("PATCH", "system/weather_config", {
      fields: {
        location: { stringValue: location },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(["/api/weather/forecast", "/weather/forecast"], async (req: Request, res: Response) => {
  try {
    if (!WEATHER_API_KEY) {
      return res.status(500).json({ success: false, error: "Weather API Key not configured." });
    }

    let location = req.query.location as string || process.env.WEATHER_LOCATION || "Marikina City";

    // Try to get dynamic location from Firestore REST if not provided in query
    if (!req.query.location) {
      try {
        const snap = await firestoreREST("GET", "system/weather_config");
        if (snap && snap.fields?.location?.stringValue) {
          location = snap.fields.location.stringValue;
        }
      } catch (e) {
        // Fallback to default
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
});

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
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/userinfo.email"
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent"
    });

    res.json({ success: true, url });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- API ROUTE: Google Auth - Callback ---
app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided.");

    const oauth2Client = createOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code as string);
    const refreshToken = tokens.refresh_token;

    if (refreshToken) {
      await firestoreREST("PATCH", "system/google_auth", {
        fields: {
          refresh_token: { stringValue: refreshToken },
          updatedAt: { stringValue: new Date().toISOString() }
        }
      });
    }

    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; line-height: 1.6;">
          <h2 style="color: #22C55E;">✓ Google Account Connected!</h2>
          <p>You have successfully authorized the application.</p>
          <button onclick="window.close()" style="padding: 10px 20px; background: #1E293B; color: white; border: none; border-radius: 8px; cursor: pointer;">Close Window</button>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`Auth Callback Error: ${err.message}`);
  }
});

// --- API ROUTE: Google Drive - List Files ---
app.get("/api/google/drive-files", async (req: Request, res: Response) => {
  try {
    const auth = await getAutoRefreshingAuthClient();
    if (!auth) throw new Error("Google Authentication not configured.");
    
    // Get folder ID from Firestore
    let folderId = "";
    try {
      const snap = await firestoreREST("GET", "system/google_drive_config");
      if (snap && snap.fields?.folderId?.stringValue) {
        folderId = snap.fields.folderId.stringValue;
      }
    } catch (e) {
      // Default to root or empty
    }

    const drive = google.drive({ version: "v3", auth });
    
    let query = "trashed = false";
    if (folderId && folderId.trim()) {
      query = `'${folderId.trim()}' in parents and trashed = false`;
    }

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType, webViewLink, thumbnailLink, size, createdTime, iconLink)",
      orderBy: "folder,name",
      pageSize: 50
    });
    res.json({ success: true, files: response.data.files });
  } catch (err: any) {
    console.error("[STAP HUB] Drive List Error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to list cloud archive." });
  }
});

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

// --- API ROUTE: List all uploaded ledgers ---
app.get("/api/v1/ledgers", async (req: Request, res: Response) => {
  try {
    const listUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/ledgers${FIREBASE_API_KEY ? `?key=${FIREBASE_API_KEY}` : ""}`;
    const restRes = await fetch(listUrl);
    const ledgers: any[] = [];
    if (restRes.ok) {
      const data = await restRes.json();
      if (data.documents) {
        data.documents.forEach((doc: any) => {
          const fields = doc.fields || {};
          ledgers.push({
            filename: fields.filename?.stringValue || "",
            size: Number(fields.size?.integerValue || 0),
            uploadedAt: fields.uploadedAt?.stringValue || "",
            sourceType: fields.sourceType?.stringValue || "python_controller",
            source: "cloud"
          });
        });
      }
    }
    return res.json({ success: true, ledgers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- API ROUTE: Get a specific ledger's content ---
app.get("/api/v1/ledgers/:filename", async (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");
    const getUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/ledgers/${safeDocId}${FIREBASE_API_KEY ? `?key=${FIREBASE_API_KEY}` : ""}`;
    
    const restRes = await fetch(getUrl);
    if (!restRes.ok) {
      return res.status(404).json({ success: false, error: "Ledger file not found in cloud database." });
    }
    const data = await restRes.json();
    const fields = data.fields || {};
    return res.json({
      success: true,
      filename: safeFilename,
      csvData: fields.csvData?.stringValue || ""
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- API ROUTE: Update a specific ledger's content ---
app.put("/api/v1/ledgers/:filename", async (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const { csvData } = req.body;
    
    if (!csvData || typeof csvData !== "string") {
      return res.status(400).json({ success: false, error: "Missing csvData string in request body." });
    }

    // Validate structure
    const validation = validateCSV(csvData);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: `CSV Structure Validation Failed: ${validation.error}` });
    }

    const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");
    const byteLength = new TextEncoder().encode(csvData).length;

    const firestorePayload = {
      fields: {
        filename: { stringValue: safeFilename },
        size: { integerValue: String(byteLength) },
        uploadedAt: { stringValue: new Date().toISOString() },
        sourceType: { stringValue: "user_uploaded" },
        csvData: { stringValue: csvData },
        syncedAt: { stringValue: new Date().toISOString() }
      }
    };

    // Try to get original uploadedAt and sourceType to preserve them
    try {
      const getUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/ledgers/${safeDocId}${FIREBASE_API_KEY ? `?key=${FIREBASE_API_KEY}` : ""}`;
      const restRes = await fetch(getUrl);
      if (restRes.ok) {
        const data = await restRes.json();
        if (data.fields) {
          if (data.fields.uploadedAt) firestorePayload.fields.uploadedAt = data.fields.uploadedAt;
          if (data.fields.sourceType) firestorePayload.fields.sourceType = data.fields.sourceType;
        }
      }
    } catch (e) {}

    // Upsert using PATCH
    await firestoreREST("PATCH", `ledgers/${safeDocId}`, firestorePayload);

    return res.json({
      success: true,
      message: `Ledger ${safeFilename} updated successfully.`,
      savedToCloud: true
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- API ROUTE: Delete a specific ledger ---
app.delete("/api/v1/ledgers/:filename", async (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const safeDocId = safeFilename.replace(/[.#$/[\]]/g, "_");
    const deleteUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/ledgers/${safeDocId}${FIREBASE_API_KEY ? `?key=${FIREBASE_API_KEY}` : ""}`;
    
    const restRes = await fetch(deleteUrl, { method: "DELETE" });
    if (!restRes.ok) {
      const errText = await restRes.text();
      throw new Error(`Firestore delete error: ${errText}`);
    }
    return res.json({
      success: true,
      message: `Ledger ${safeFilename} deleted successfully.`,
      deletedCloud: true
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

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
        sourceType: { stringValue: "python_controller" },
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

// --- API ROUTE: Handle Manual User Ledger Uploads ---
app.post("/api/v1/upload-manual-ledger", async (req: Request, res: Response) => {
  try {
    const { filename, csvData } = req.body;
    if (!filename || !csvData || typeof csvData !== "string") {
      return res.status(400).json({ success: false, error: "Missing filename or valid csvData string." });
    }

    // Basic server-side validation
    if (csvData.trim().length < 10) {
      return res.status(400).json({ success: false, error: "CSV content is too short or empty." });
    }

    const validation = validateCSV(csvData);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: `CSV Structure Validation Failed: ${validation.error}` });
    }

    const cleanFilename = filename.replace(/\\/g, "/").split("/").pop() || "uploaded_ledger.csv";
    const safeDocId = cleanFilename.replace(/[.#$/[\]]/g, "_");
    
    const byteLength = new TextEncoder().encode(csvData).length;

    const firestorePayload = {
      fields: {
        filename: { stringValue: cleanFilename },
        size: { integerValue: String(byteLength) },
        uploadedAt: { stringValue: new Date().toISOString() },
        sourceType: { stringValue: "user_uploaded" },
        csvData: { stringValue: csvData },
        syncedAt: { stringValue: new Date().toISOString() }
      }
    };

    await firestoreREST("PATCH", `ledgers/${safeDocId}`, firestorePayload);

    return res.json({
      success: true,
      message: `Manual ledger ${cleanFilename} uploaded successfully to the cloud.`,
      sourceType: "user_uploaded",
      savedToCloud: true
    });
  } catch (err: any) {
    console.error("[STAP MANUAL UPLOAD ERROR]", err);
    return res.status(500).json({ success: false, error: err.message || "Internal serverless worker error." });
  }
});

export default app;