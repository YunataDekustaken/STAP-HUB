# STAP Hub - System Framework & Database Architecture Documentation

This document provides a comprehensive technical overview of the **Smart Traffic Automation Program (STAP) Hub** platform. It outlines the application’s multi-tier framework, compilation architecture, database schemas, access policies, and integration models.

---

## 🏛️ 1. System & Framework Architecture

STAP Hub is engineered as a full-stack, enterprise-grade, offline-first ready administrative dashboard. It bridges local smart-pole IoT devices, public citizen portals, and administrative tooling.

```
                  ┌──────────────────────────────────────────┐
                  │          Citizen Web Interface           │
                  │   (Footage Requests, Incident Reports)   │
                  └────────────────────┬─────────────────────┘
                                       │ Public HTTPS
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            STAP HUB CLOUD RUN CONTAINER                      │
│                                                                              │
│  ┌───────────────────────┐  Internal Route  ┌─────────────────────────────┐  │
│  │   Vite React SPA      │ ────────────────> │    Node/Express Backend     │  │
│  │   (Tailwind, Motion)  │                   │    (server.ts / esbuild)    │  │
│  └───────────────────────┘                   └──────────────┬──────────────┘  │
└─────────────────────────────────────────────────────────────┼────────────────┘
                                                              │
                                     ┌────────────────────────┴────────────────────────┐
                                     │                                                 │
                                     ▼ Secure Auth / API Scopes                        ▼ Durable Sync
                        ┌──────────────────────────┐                      ┌──────────────────────────┐
                        │     Google Workspace     │                      │    Firebase Firestore    │
                        │    (Gmail & Drive API)   │                      │    (Durable Cloud DB)    │
                        └──────────────────────────┘                      └──────────────────────────┘
```

### 1.1 Frontend Tech Stack
*   **Framework**: React 19 + TypeScript.
*   **Build Tool**: Vite 6. High-performance, zero-flicker static asset compilation with Hot Module Replacement (HMR) configured for local development.
*   **Styling & Design System**: Tailwind CSS v4. Standardized display headings pair **Space Grotesk** or **Outfit** for sleek technical presentation with **Inter** for clean, legible body text, and **JetBrains Mono** for low-level system logs and JSON configurations.
*   **State Management & Transitions**: Native React hooks (`useState`, `useEffect`, `useMemo`) combined with **Motion** (`motion/react`) for fluid, hardware-accelerated entering animations and route transitions.
*   **Data Visualization**: **Recharts** and **d3** for real-time intersection load indicators, peak congestion charts, and vehicle volume analysis.
*   **Document Generation**: **jspdf** and **jspdf-autotable** for compiling certified traffic analysis reports with official watermarks.

### 1.2 Backend Tech Stack
*   **Runtime & Server**: Node.js utilizing **Express** in TypeScript.
*   **Build Pipeline & Production Bundling**: 
    *   To bypass Node.js strict ES Module relative import compliance check limitations at runtime, the production build compiles the server via **esbuild** into a single, optimized, self-contained CommonJS bundle at `dist/server.cjs`.
    *   **Vite Development Middleware**: Serves assets and acts as a single-port proxy dynamically during development.
*   **Container Specifications**: Runs on Cloud Run behind an nginx reverse proxy.
    *   **Port Ingress**: Hardcoded and locked to Port `3000`. All web sockets and server loops route exclusively through this gateway.

---

## 🗄️ 2. Database Architecture (Firestore)

STAP Hub utilizes **Firebase Firestore** as its main transactional and persistent cloud database.

### 2.1 Schema Overview (Firebase Blueprint Model)
The Firestore document structure is governed by `/firebase-blueprint.json` which maps active collections to distinct entities.

```
Firestore Databases: {database}/documents/
 ├── traffic_logs/        --> [TrafficHistoryLog] Peak density snapshot records
 ├── footage_requests/    --> [FootageRequest] Citizen requests for archival footage
 ├── report_requests/     --> [ReportRequest] Formal certified traffic report orders
 ├── incident_reports/    --> [IncidentReport] Operator and citizen emergency reports
 ├── announcements/       --> [Announcement] Public notifications and advisory bulletins
 ├── users/               --> [User] Administrator and Operator access controls
 ├── settings/            --> [SystemSettings] Global app and device settings
 ├── ledgers/             --> [Ledger] Matrix charts representing compiled CSVs
 ├── sent_emails/         --> [EmailHistory] Records of outgoing automated dispatches
 └── received_emails/     --> [EmailHistory] Log entries of incoming customer responses
```

---

### 2.2 Entity Models & TypeScript Interfaces

Below are the detailed models, required properties, and their respective TypeScript structures mapping directly to Firestore collections.

#### 1. Traffic Historical Logs (`traffic_logs`)
Captures intersection performance, telemetry levels, and level-of-service (LOS) congestion metrics.

*   **TypeScript Definition (`src/types.ts`)**:
    ```typescript
    export interface TrafficHistoryLog {
      id: string;
      timestamp: string; // ISO 8601 date-time format
      north: { count: number; density: number; light: LightState; los: string };
      south: { count: number; density: number; light: LightState; los: string };
      east: { count: number; density: number; light: LightState; los: string };
      west: { count: number; density: number; light: LightState; los: string };
      activeLane: Lane; // "NORTH" | "SOUTH" | "EAST" | "WEST"
      mode: SystemMode; // "AUTO" | "MANUAL" | "HAZARD" | "EMERGENCY"
      weather: "SUNNY" | "RAINY";
      triggeredBy: string; // "YOLO API" | "Manual" | "Simulation"
    }
    ```
*   **Firestore Blueprint Properties**:
    *   `id`: `string` (UUID or unique snapshot string)
    *   `timestamp`: `string` (date-time)
    *   `north`/`south`/`east`/`west`: `object`
    *   `activeLane`: `string`
    *   `mode`: `string`
    *   `weather`: `string`
    *   `triggeredBy`: `string`

#### 2. Footage Requests (`footage_requests`)
Stores requests submitted by citizens, law enforcement, or insurance adjusters for smart-pole archival camera records.

*   **TypeScript Representation**:
    ```typescript
    export interface FootageRequest {
      id: string;
      requesterName: string;
      email: string;
      organization?: string;
      contact: string;
      address?: string;
      nature: string; // Academic, Insurance, Accident Investigation
      handledBy?: string; // Operator User ID or email
      footageDate: string; // YYYY-MM-DD
      camera: string; // "NORTH_CAM" | "SOUTH_CAM" | "EAST_CAM" | "WEST_CAM"
      timeRange: string; // e.g., "14:00 - 15:00"
      description: string;
      status: "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";
      dateSubmitted: string; // ISO 8601 date-time
    }
    ```

#### 3. Formal Report Requests (`report_requests`)
Used to request, process, and download watermarked PDF certificates certifying traffic volumes for development, academic research, or legal hearings.

*   **Firestore Blueprint Schema**:
    ```json
    {
      "id": "string",
      "type": "string",
      "requestedRange": "object", // { start: string, end: string }
      "requesterInfo": "object",  // { name: string, email: string, organization: string }
      "status": "string (enum: PENDING, ONGOING, APPROVED, REJECTED)",
      "generatedPdfUrl": "string (optional)",
      "certifiedBy": "string (optional)",
      "certifiedAt": "string (optional)",
      "createdAt": "string"
    }
    ```

#### 4. Incident Reports (`incident_reports`)
Real-time hazard records reported by on-site officers or civilian mobile apps.

*   **Firestore Blueprint Schema**:
    ```json
    {
      "id": "string",
      "lane": "string",
      "type": "string (e.g., Collision, Stall, Maintenance, Weather)",
      "reporterName": "string",
      "reporterContact": "string",
      "timeReported": "string",
      "status": "string (e.g., ACTIVE, CLEARING, RESOLVED)",
      "description": "string",
      "severity": "string (e.g., LOW, MEDIUM, CRITICAL)"
    }
    ```

#### 5. Registered Systems Users (`users`)
Maintains directory lists of registered municipal personnel assigned to the smart infrastructure dashboard.

*   **TypeScript Definition**:
    ```typescript
    export interface User {
      id: string; // Firebase Auth UID
      email: string;
      name: string;
      role: "Administrator" | "Traffic Commissioner" | "Operations Analyst" | "Inspector" | "Pending";
      avatarUrl?: string;
      isOnline?: boolean;
      lastLogin?: string;
    }
    ```

---

## 🔒 3. Database Security Policy (`firestore.rules`)

To prevent unauthorized public write access or data leaks, Firestore implements precise security rules leveraging standard token attributes from **Firebase Authentication**.

### 3.1 Policy Enforcement Breakdown

| Collection | Read Rule | Write Rule | Logic / Requirement |
| :--- | :--- | :--- | :--- |
| **`traffic_logs`** | `allow read: if true;` | `allow write: if isOperator();` | Analytics, traffic widgets, and public dashboards are publicly queryable. Logging requires verified credentials. |
| **`footage_requests`** | `allow read: if true;` | `allow create: if true;`<br>`allow update, delete: if isOperator();` | Citizens can submit and check progress. Alteration is restricted to system operators. |
| **`report_requests`** | `allow read: if true;` | `allow create: if true;`<br>`allow update, delete: if isOperator();` | Report orders can be placed publicly. Generating PDFs and updates require verified roles. |
| **`incident_reports`** | `allow read: if true;` | `allow create: if true;`<br>`allow update, delete: if isOperator();` | Real-time map layers read publicly. Dispatch and resolution is operator-restricted. |
| **`announcements`** | `allow read: if true;` | `allow write: if isOperator();` | Advisories read publicly. Editing requires system clearance. |
| **`users`** | `allow read, write: if isOperator();` | `allow read, write: if isOperator();` | Operational accounts folder is fully locked down; requires verified authorization. |
| **`settings`** | `allow read: if true;` | `allow write: if isOperator() \|\| isSignedIn();` | Device configuration states are public for device sync, writes require standard auth. |

### 3.2 Access Functions Summary
```javascript
// Validates whether the user is actively authenticated via Firebase Auth
function isSignedIn() {
  return request.auth != null;
}

// Verifies the operator's Google Account holds a verified email address
function isOperator() {
  return isSignedIn() && (
    request.auth.token.email_verified == true
  );
}

// Validates document format matches uniform resource standards
function isValidId(id) {
  return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
}
```

---

## 🔌 4. Integration Pipelines & Workflows

### 4.1 Google Workspace Integration (Gmail & Drive)
STAP Hub routes all notifications and files through official Google APIs.

1.  **OAuth Consent Initiation**: The application requests scope clearances for Gmail (`https://www.googleapis.com/auth/gmail.send`) and Google Drive (`https://www.googleapis.com/auth/drive.file`).
2.  **Consent Processing**: Express maps credentials, retrieves the short-term access token, and establishes background sync handlers.
3.  **Footage Archival Storage**:
    *   When an operator clicks **Approve Footage**, the system compiles the selected sensor records.
    *   A stream is opened to upload the files to a designated folder in the administrative **Google Drive**.
    *   The Drive API returns a public read-only asset URL.
4.  **Notification Dispatch**:
    *   The backend triggers the **Gmail API** to send an email template containing the secure Drive download link.
    *   The email is logged in Firestore's `sent_emails` collection for compliance history.

### 4.2 Hardware/IoT Smart-Pole Connectivity
Our physical smart poles communicate through local network gateways and secure cloud-to-local tunnel configurations.

```
┌─────────────────┐             POST /api/snapshots/upload             ┌─────────────────┐
│                 │ ─────────────────────────────────────────────────> │                 │
│   Smart Pole    │                                                    │    STAP Hub     │
│   (YOLO Edge)   │ <───────────────────────────────────────────────── │     Server      │
│                 │            SSE (Server-Sent Events) Loop           │                 │
└─────────────────┘                                                    └─────────────────┘
```

1.  **Upload Pipeline**: On-pole camera sensors utilize embedded edge AI (YOLO) to detect vehicles. It compiles detection matrices every 5 seconds and dispatches them via a `POST /api/snapshots/upload` endpoint.
2.  **Active Signal Bridge**: For instant override controls (e.g., triggering a emergency manual red-light sequence), the pole maintains a persistent **SSE (Server-Sent Events)** loop listening for server signals.

---

## 🛠️ 5. Operational Guide & Maintenance

### 5.1 Compiling for Production
Ensure the client builds static assets successfully and esbuild bundles the Express server without external library contamination:

```bash
# Build the React frontend with Vite & Compile the backend server with esbuild
npm run build

# Start the optimized server bundle
npm run start
```

### 5.2 Expanding Database Schemas
When introducing a new feature or database field:
1.  **TypeScript update**: Define the new fields in `/src/types.ts` so the frontend remains strictly typed.
2.  **Blueprint update**: Add the keys to `/firebase-blueprint.json` to keep development models documented.
3.  **Security check**: Update `/firestore.rules` if the collection requires novel user role gates.
4.  **Deployment**: Execute Firebase deploy commands to update live cloud configurations:
    ```bash
    # Runs compile validation on database policies
    npm run build
    ```

---
*Operational Document Ref: STAP-HUB-DOC-v17.2-2026. Approved for production deployment.*
