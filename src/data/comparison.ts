export interface ComparisonColumn {
  label: string;
  group: "Control" | "Sensing & vision" | "Payload";
}

export const COMPARISON_COLUMNS: ComparisonColumn[] = [
  { label: "Smartphone control", group: "Control" },
  { label: "Manual control", group: "Control" },
  { label: "Fire / smoke sensing", group: "Sensing & vision" },
  { label: "Live camera video", group: "Sensing & vision" },
  { label: "AI hazard detection", group: "Sensing & vision" },
  { label: "Sonar auto-stop", group: "Sensing & vision" },
  { label: "Payload loading", group: "Payload" },
  { label: "Payload storage", group: "Payload" },
  { label: "Payload feeding", group: "Payload" },
  { label: "Launching", group: "Payload" },
];

export interface ComparisonRow {
  name: string;
  marks: boolean[];
  planned?: number[];
  ours?: boolean;
}

//                                                       phone  manual fire   video  AI     sonar  load   store  feed   launch
export const COMPARISON_ROWS: ComparisonRow[] = [
  { name: "Android/IoT firefighting robot (Blynk)", marks: [true,  true,  true,  false, false, false, false, false, false, false] },
  { name: "FireGuardian (IoT)",                     marks: [false, false, true,  false, false, false, false, false, false, false] },
  { name: "Automatic fire extinguisher robot (IEEE)", marks: [false, false, true, false, false, false, false, false, false, false] },
  { name: "Dual-mode Arduino robot (Raju et al.)",  marks: [false, true,  true,  false, false, false, false, false, false, false] },
  { name: "Rescue Rover (IEEE)",                    marks: [false, true,  false, true,  false, false, false, false, false, false] },
  { name: "ResQBot",                                marks: [true,  true,  true,  true,  true,  true,  true,  true,  true,  true], ours: true },
];
