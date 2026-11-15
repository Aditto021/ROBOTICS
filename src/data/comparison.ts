export const COMPARISON_COLUMNS = [
  "Smartphone control",
  "Fire sensing",
  "Manual control",
  "Payload loading",
  "Payload storage",
  "Payload feeding",
  "Launching",
  "Full load-store-feed-launch chain",
];

export interface ComparisonRow {
  name: string;
  marks: boolean[];
  planned?: number[];
  ours?: boolean;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { name: "Android/IoT firefighting robot (Blynk)", marks: [true, true, true, false, false, false, false, false] },
  { name: "FireGuardian (IoT)", marks: [false, true, false, false, false, false, false, false] },
  { name: "Automatic fire extinguisher robot (IEEE)", marks: [false, true, false, false, false, false, false, false] },
  { name: "Dual-mode Arduino robot (Raju et al.)", marks: [false, true, true, false, false, false, false, false] },
  { name: "Rescue Rover (IEEE)", marks: [false, false, true, false, false, false, false, false] },
  { name: "ResQBot", marks: [true, true, true, true, true, true, true, true], planned: [1], ours: true },
];
