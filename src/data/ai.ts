export interface AiFeature {
  id: string;
  title: string;
  model: string;
  description: string;
}

/** What the laptop-side AI does with the rover's camera and sensor stream. */
export const AI_FEATURES: AiFeature[] = [
  {
    id: "people",
    title: "Victim detection",
    model: "YOLO11n-pose",
    description:
      "Finds people in the live video and tracks 17 body keypoints, drawn as a skeleton over the feed.",
  },
  {
    id: "down",
    title: "Person-down alert",
    model: "Pose geometry",
    description:
      "Flags someone lying on the ground from their torso angle, confirmed across several frames to avoid false alarms.",
  },
  {
    id: "fire",
    title: "Fire, smoke & hazards",
    model: "YOLO-World v2",
    description:
      "An open-vocabulary detector told what to look for in plain words — fire, smoke, gas cylinders, broken glass, cables.",
  },
  {
    id: "depth",
    title: "Free-path guidance",
    model: "MiDaS v2.1",
    description:
      "Estimates depth from the single camera and fuses it with the sonar to suggest left, ahead, or right.",
  },
  {
    id: "threat",
    title: "Threat level",
    model: "Random Forest",
    description:
      "Combines vision with gas, temperature, and distance readings into SAFE, CAUTION, DANGER, or CRITICAL.",
  },
  {
    id: "predict",
    title: "Anomaly & trend",
    model: "Isolation Forest + regression",
    description:
      "Spots unusual sensor readings and predicts problems early — for example, seconds until the gas alarm level.",
  },
];

export const AI_PIPELINE: string[] = [
  "ESP32-CAM video",
  "Sensors over Wi-Fi",
  "Laptop AI (offline)",
  "Mission dashboard",
  "Alerts & auto-stop",
];

export const AI_STATS: { value: string; label: string }[] = [
  { value: "30 fps", label: "live video" },
  { value: "40 cm", label: "automatic sonar stop" },
  { value: "6", label: "AI models working together" },
  { value: "0", label: "internet needed" },
];
