import React, { useState, useEffect } from "react";
import { Lane, LightState, SystemMode, Role } from "../types";
import { Smartphone, Laptop, Terminal, RefreshCw, Send, AlertTriangle, CloudRain, Sun, Play } from "lucide-react";

interface HardwareSimulatorProps {
  mode: SystemMode;
  lanes: Record<Lane, { count: number; density: number; light: LightState; los: string }>;
  weather: "SUNNY" | "RAINY";
  onUpdateCounts: (lane: Lane, count: number) => void;
  onPostMockSnapshot: () => void;
}

export default function HardwareSimulator({
  mode,
  lanes,
  weather,
  onUpdateCounts,
  onPostMockSnapshot
}: HardwareSimulatorProps) {
  const [serialConsole, setSerialConsole] = useState<string[]>([
    "[ESP32 Setup] Initialized GPIO pins N=1-3, E=4-6, W=9-11, S=12-14",
    "[ESP32 Setup] Adafruit 7segment registers calibrated at I2C ADDR 0x70, 0x72, 0x74, 0x76",
    "[Python YOLO] Tracking stream active on local frame buffer.",
  ]);

  const [sliderCounts, setSliderCounts] = useState<Record<Lane, number>>({
    NORTH: lanes.NORTH.count,
    SOUTH: lanes.SOUTH.count,
    EAST: lanes.EAST.count,
    WEST: lanes.WEST.count,
  });

  // Keep slider counts synchronous with external counts
  useEffect(() => {
    setSliderCounts({
      NORTH: lanes.NORTH.count,
      SOUTH: lanes.SOUTH.count,
      EAST: lanes.EAST.count,
      WEST: lanes.WEST.count,
    });
  }, [lanes]);

  const pushSerialMessage = (msg: string) => {
    setSerialConsole((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-8));
  };

  const handleSliderChange = (lane: Lane, val: number) => {
    setSliderCounts(prev => ({ ...prev, [lane]: val }));
    onUpdateCounts(lane, val);
    pushSerialMessage(`YOLO Sensors: Recalibrated approach queue of ${lane} to ${val}`);
  };

  const handlePostYOLOSnap = () => {
    onPostMockSnapshot();
    pushSerialMessage(`YOLO Engine: Dispatched secure snapshot JSON payload to webapp proxy /api/v1/snapshots`);
  };

  const handlePreemptEmergency = (lane: Lane) => {
    pushSerialMessage(`HARDWARE INT: Preemption interrupt on BTN_EMG for approach ${lane}! Flagging sirens...`);
  };

  return (
    <div className="space-y-6" id="hardware-simulator">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Local Python Sensor Controls */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Laptop className="h-5 w-5 text-emerald-400" />
                Python YOLO v8 Processing Node Emulator
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Simulate active YOLO camera counts. Adjust queues to test Level of Service calculations and adaptive timings.
              </p>
            </div>
          </div>

          {/* Slider list */}
          <div className="space-y-4 my-6">
            {(["NORTH", "SOUTH", "EAST", "WEST"] as Lane[]).map((lane) => {
              const currentVal = sliderCounts[lane];
              let losColor = "text-emerald-400";
              const los = lanes[lane].los;
              if (["D", "E"].includes(los)) losColor = "text-amber-400 font-bold";
              if (los === "F") losColor = "text-red-400 font-black animate-pulse";

              return (
                <div key={lane} className="bg-slate-950 p-4.5 rounded-2xl border border-slate-850">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold font-mono text-slate-200 uppercase">{lane} Approach</span>
                    <span className={`text-xs font-mono ${losColor}`}>
                      {currentVal} Cars (LOS {los})
                    </span>
                  </div>

                  <input
                    id={`sld-${lane.toLowerCase()}`}
                    type="range"
                    min="0"
                    max="22"
                    value={currentVal}
                    onChange={(e) => handleSliderChange(lane, parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />

                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
                    <span>A (0-1)</span>
                    <span>C (4-6)</span>
                    <span>E (11-15)</span>
                    <span>F (16+)</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            id="btn-trigger-yolo-snapshot"
            onClick={handlePostYOLOSnap}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3 rounded-xl transition-all active:scale-98 font-bold text-xs flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            <span>Simulate YOLO Snap POST (Authorization active)</span>
          </button>
        </div>

        {/* Right Column: Physical ESP32 Controller Console */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-cyan-400" />
              ESP32 Micro-Controller Firmware Console (v17.7)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Tracks local tactile push-button clicks, rain sensors, and serial signals directed to the physical shift registers.
            </p>
          </div>

          {/* Serial Terminal View */}
          <div className="my-6 flex-1 bg-slate-950 p-4 rounded-2xl border border-slate-850 font-mono text-[10px] text-cyan-400/90 space-y-2 overflow-hidden min-h-[220px] flex flex-col justify-end">
            <div className="text-slate-500 text-[9px] border-b border-slate-850 pb-2 mb-2">
              --- START COM CHANNEL SERIAL STREAMS (BAUD 115200) ---
            </div>
            {serialConsole.map((log, index) => (
              <div key={index} className="truncate select-all leading-normal">
                {log}
              </div>
            ))}
          </div>

          {/* Simulate ESP32 Button Presses */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block">
              Simulate Physical Tactile Button Interrupts
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(["NORTH", "SOUTH", "EAST", "WEST"] as Lane[]).map((lane) => (
                <button
                  id={`btn-tactile-${lane.toLowerCase()}`}
                  key={lane}
                  onClick={() => {
                    handlePreemptEmergency(lane);
                    pushSerialMessage(`BUTTON_INTERRUPT: GPIO_${lane === "NORTH" ? 27 : lane === "SOUTH" ? 33 : lane === "EAST" ? 25 : 32} Clicked`);
                  }}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 transition-all text-slate-300 rounded-xl font-mono text-[11px]"
                >
                  Click Physical {lane} Btn
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
