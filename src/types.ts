export type Lane = "NORTH" | "SOUTH" | "EAST" | "WEST";
export type LightState = "RED" | "YELLOW" | "GREEN";
export type SystemMode = "AUTO" | "MANUAL" | "HAZARD" | "EMERGENCY";
export type Role = "Administrator" | "Traffic Commissioner" | "Operations Analyst" | "Inspector" | "Pending";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string;
  isOnline?: boolean;
  lastLogin?: string;
}

export interface FirebaseConnectionConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  connected: boolean;
}

export interface SnapshotData {
  camera_id: number; // 1: NORTH, 2: SOUTH, 3: EAST, 4: WEST
  lane: Lane;
  cars: number;
  trucks: number;
  motorcycles: number;
  buses: number;
  emergency_vehicles: number;
  congestion: string; // A, B, C, D, E, F
  snapshot_time: string;
}

export interface TrafficHistoryLog {
  id: string;
  timestamp: string;
  north: { count: number; density: number; light: LightState; los: string };
  south: { count: number; density: number; light: LightState; los: string };
  east: { count: number; density: number; light: LightState; los: string };
  west: { count: number; density: number; light: LightState; los: string };
  activeLane: Lane;
  mode: SystemMode;
  weather: "SUNNY" | "RAINY";
  triggeredBy: string; // "YOLO API" | "Manual" | "Simulation"
}
