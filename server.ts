import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Let json body parser accept up to 15mb for carrying base64 image data from Python safely
  app.use(express.json({ limit: "15mb" }));

  // CORS Middleware for direct browser interactions
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // --- API ROUTE: Receive Real-Time YOLO Snapshot Postings ---
  // Matches Python: STAP_HUB_URL = "https://<app-url>/api/v1/snapshots"
  app.post("/api/v1/snapshots", (req: Request, res: Response) => {
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

    res.json({ success: true, message: `Snapshot parsed successfully for ${laneKey}` });
  });

  // --- API ROUTE: Hardware Node Heartbeat ---
  // Matches Python: STAP_HEARTBEAT_URL = "https://<app-url>/api/v1/heartbeat"
  app.post("/api/v1/heartbeat", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTHORIZATION_TOKEN}`) {
      return res.status(401).json({ success: false, error: "Unauthorized Hearter Token" });
    }

    systemState.heartbeatTime = Date.now();
    res.json({ success: true, status: "alive" });
  });

  // --- API ROUTE: Upload CSV Ledger Data ---
  // Save finalized CSV ledger data to server directory
  app.post("/api/v1/upload-ledger", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTHORIZATION_TOKEN}`) {
      return res.status(401).json({ success: false, error: "Unauthorized Bearer Token" });
    }

    const { filename, csvData } = req.body;
    if (!filename || typeof csvData !== "string") {
      return res.status(400).json({ success: false, error: "Missing filename or valid csvData string in request body." });
    }

    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Secure the filename to prevent path traversal
      const safeFilename = path.basename(filename);
      const filePath = path.join(uploadsDir, safeFilename);

      fs.writeFileSync(filePath, csvData, "utf8");
      console.log(`[STAP HUB] Ledger saved successfully: ${safeFilename}`);
      return res.json({ success: true, message: `Ledger ${safeFilename} uploaded and saved successfully.` });
    } catch (err: any) {
      console.error("[STAP HUB] Failed to save ledger upload:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to save file on server." });
    }
  });

  // --- API ROUTE: List all uploaded ledgers ---
  app.get("/api/v1/ledgers", (req: Request, res: Response) => {
    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        return res.json({ success: true, ledgers: [] });
      }

      const files = fs.readdirSync(uploadsDir);
      const ledgers = files
        .filter((file) => file.endsWith(".csv") || file.endsWith(".txt"))
        .map((file) => {
          const filePath = path.join(uploadsDir, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      return res.json({ success: true, ledgers });
    } catch (err: any) {
      console.error("[STAP HUB] Failed to list ledgers:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to list files." });
    }
  });

  // --- API ROUTE: Get a specific ledger's content ---
  app.get("/api/v1/ledgers/:filename", (req: Request, res: Response) => {
    try {
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.join(process.cwd(), "uploads", safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: "Ledger file not found." });
      }

      const csvData = fs.readFileSync(filePath, "utf8");
      return res.json({ success: true, filename: safeFilename, csvData });
    } catch (err: any) {
      console.error("[STAP HUB] Failed to retrieve ledger content:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to retrieve file content." });
    }
  });

  // --- API ROUTE: Delete a specific ledger ---
  app.delete("/api/v1/ledgers/:filename", (req: Request, res: Response) => {
    try {
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.join(process.cwd(), "uploads", safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: "Ledger file not found." });
      }

      fs.unlinkSync(filePath);
      console.log(`[STAP HUB] Ledger deleted: ${safeFilename}`);
      return res.json({ success: true, message: `Ledger ${safeFilename} deleted successfully.` });
    } catch (err: any) {
      console.error("[STAP HUB] Failed to delete ledger:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to delete file." });
    }
  });

  // --- API ROUTE: Integrated Hub Status State getter ---
  app.get("/api/v1/status", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    // Be generous: 20 seconds. If any packet has been parsed in the last 20 seconds
    const nodeOnline = Date.now() - systemState.heartbeatTime < 20000;
    res.json({
      ...systemState,
      nodeOnline,
      serverTime: new Date().toISOString(),
    });
  });

  // --- API ROUTE: Force Set Intersection Mode or Lights (Used by Web Console/Dashboard) ---
  app.post("/api/v1/control", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const userAgent = req.headers["user-agent"] || "";
    const isFromPython = (authHeader === `Bearer ${AUTHORIZATION_TOKEN}`) || userAgent.toLowerCase().includes("python");

    const { mode, activeLane, weather, lanes, remainingSecs, greenDuration } = req.body;

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

    res.json({ success: true, state: systemState });
  });

  // Serve static assets in production or initiate Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`STAP Traffic Hub Express server online at http://0.0.0.0:${PORT}`);
  });
}

startServer();
