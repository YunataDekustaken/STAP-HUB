export interface VehicleCounts {
  [vehicleType: string]: number;
}

export interface LaneRecord {
  lane: string; // "NORTH" | "SOUTH" | "EAST" | "WEST"
  vehicles: VehicleCounts;
  cumulativeTotal: number;
  densityOccupancy: number; // percentage (0 - 100)
}

export interface Snapshot {
  timestamp: string; // "2026-06-18 10:42:42"
  lanes: LaneRecord[];
  intersectionSum: number;
}

export interface FinalSummaryRecord {
  lane: string;
  vehicles: VehicleCounts;
  grandUniqueCount: number;
  finalDensity: number; // percentage (0 - 100)
}

export interface FinalSummary {
  timestamp: string; // "2026-06-18 11:45:05"
  lanes: FinalSummaryRecord[];
  corridorTotals: {
    vehicles: VehicleCounts;
    grandUniqueCount: number;
  } | null;
}

export interface ParsedTrafficData {
  sessionStart: string;
  snapshots: Snapshot[];
  finalSummary: FinalSummary | null;
  allVehicleTypes: string[];
}

/**
 * Parses a percent string like "42.43%" or "12" to a float number.
 */
function parsePercentage(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/%/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseTrafficCSV(csvText: string): ParsedTrafficData {
  const lines = csvText.split(/\r?\n/);
  
  let sessionStart = "—";
  const snapshots: Snapshot[] = [];
  let finalSummary: FinalSummary | null = null;
  
  const allVehicleTypesSet = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Parse Session Start
    if (line.includes("Session Start Initialization Time")) {
      const parts = line.split(",");
      if (parts.length > 1) {
        sessionStart = parts[1].trim();
      }
      i++;
      continue;
    }

    // Parse Snapshots
    // Format: --- INTERVAL RECORDING SNAPSHOT [2026-06-18 10:42:42] ---
    if (line.startsWith("--- INTERVAL RECORDING SNAPSHOT")) {
      const tsMatch = line.match(/\[(.*?)\]/);
      const timestamp = tsMatch ? tsMatch[1] : "Unknown Interval";
      i++; // Move to header line

      if (i < lines.length) {
        const headerLine = lines[i].trim();
        const headers = headerLine.split(",");
        
        // Headers look like: Lane Approach, ambulance, ..., Cumulative Total, Live Area Density Occupancy %
        const vehicleTypes: string[] = [];
        for (let h = 1; h < headers.length - 2; h++) {
          const type = headers[h].trim();
          vehicleTypes.push(type);
          allVehicleTypesSet.add(type);
        }

        i++; // Move to lane lines
        const lanes: LaneRecord[] = [];
        let intersectionSum = 0;

        // We expect 4 lanes: NORTH, SOUTH, EAST, WEST
        while (i < lines.length) {
          const laneLine = lines[i].trim();
          if (!laneLine || laneLine.startsWith("Intersection Cumulative Unique") || laneLine.startsWith("---") || laneLine.startsWith("==")) {
            break;
          }

          const cols = laneLine.split(",");
          const laneName = cols[0].trim();
          const vehicles: VehicleCounts = {};

          for (let c = 0; c < vehicleTypes.length; c++) {
            const countVal = cols[c + 1] ? parseInt(cols[c + 1].trim(), 10) : 0;
            vehicles[vehicleTypes[c]] = isNaN(countVal) ? 0 : countVal;
          }

          const cumulativeTotal = cols[cols.length - 2] ? parseInt(cols[cols.length - 2].trim(), 10) : 0;
          const densityOccupancy = cols[cols.length - 1] ? parsePercentage(cols[cols.length - 1]) : 0;

          lanes.push({
            lane: laneName,
            vehicles,
            cumulativeTotal: isNaN(cumulativeTotal) ? 0 : cumulativeTotal,
            densityOccupancy
          });

          i++;
        }

        // Check for Intersection Cumulative Unique Vehicles Sum:,349
        if (i < lines.length && lines[i].trim().startsWith("Intersection Cumulative Unique")) {
          const sumLine = lines[i].trim();
          const parts = sumLine.split(",");
          if (parts.length > 1) {
            intersectionSum = parseInt(parts[1].trim(), 10) || 0;
          }
          i++;
        }

        snapshots.push({
          timestamp,
          lanes,
          intersectionSum
        });
      }
      continue;
    }

    // Parse Final Summary
    // Format: FINAL INTERSECTION REPORT SUMMARY MATRIX
    if (line.includes("FINAL INTERSECTION REPORT SUMMARY MATRIX")) {
      i++; // Skip to Clock line
      let terminationClock = "—";
      if (i < lines.length && lines[i].trim().includes("Session Termination Completed Clock")) {
        const parts = lines[i].trim().split(",");
        if (parts.length > 1) {
          terminationClock = parts[1].trim();
        }
        i++;
      }

      // Skip to headers
      if (i < lines.length) {
        const headerLine = lines[i].trim();
        const headers = headerLine.split(",");
        
        const vehicleTypes: string[] = [];
        for (let h = 1; h < headers.length - 2; h++) {
          const type = headers[h].trim();
          vehicleTypes.push(type);
          allVehicleTypesSet.add(type);
        }

        i++; // Move to lane totals
        const finalLanes: FinalSummaryRecord[] = [];
        let corridorTotals: FinalSummary["corridorTotals"] = null;

        while (i < lines.length) {
          const recordLine = lines[i].trim();
          if (!recordLine || recordLine.startsWith("===") || recordLine.startsWith("Session Start")) {
            break;
          }

          const cols = recordLine.split(",");
          const name = cols[0].trim();
          
          if (name === "TOTAL INTERSECTION CORRIDOR") {
            const vehicles: VehicleCounts = {};
            for (let c = 0; c < vehicleTypes.length; c++) {
              const countVal = cols[c + 1] ? parseInt(cols[c + 1].trim(), 10) : 0;
              vehicles[vehicleTypes[c]] = isNaN(countVal) ? 0 : countVal;
            }
            const grandUniqueCount = cols[cols.length - 1] ? parseInt(cols[cols.length - 1].trim(), 10) : 0;
            
            corridorTotals = {
              vehicles,
              grandUniqueCount: isNaN(grandUniqueCount) ? 0 : grandUniqueCount
            };
          } else {
            const vehicles: VehicleCounts = {};
            for (let c = 0; c < vehicleTypes.length; c++) {
              const countVal = cols[c + 1] ? parseInt(cols[c + 1].trim(), 10) : 0;
              vehicles[vehicleTypes[c]] = isNaN(countVal) ? 0 : countVal;
            }
            const grandUniqueCount = cols[cols.length - 2] ? parseInt(cols[cols.length - 2].trim(), 10) : 0;
            const finalDensity = cols[cols.length - 1] ? parsePercentage(cols[cols.length - 1]) : 0;

            finalLanes.push({
              lane: name,
              vehicles,
              grandUniqueCount: isNaN(grandUniqueCount) ? 0 : grandUniqueCount,
              finalDensity
            });
          }
          i++;
        }

        finalSummary = {
          timestamp: terminationClock,
          lanes: finalLanes,
          corridorTotals
        };
      }
      continue;
    }

    i++;
  }

  return {
    sessionStart,
    snapshots,
    finalSummary,
    allVehicleTypes: Array.from(allVehicleTypesSet)
  };
}
