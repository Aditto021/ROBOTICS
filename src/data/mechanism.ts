export interface MechanismComponent {
  id: string;
  label: string;
  short: string;
  description: string;
  x: number; // percentage position over the robot visual
  y: number;
}

export const MECHANISM_COMPONENTS: MechanismComponent[] = [
  {
    id: "esp32",
    label: "MCU (ESP32) Control Unit",
    short: "Control",
    description:
      "The onboard microcontroller that interprets commands from the smartphone link and coordinates every subsystem in real time.",
    x: 52.7,
    y: 56.6,
  },
  {
    id: "camera",
    label: "ESP32-CAM Vision Mast",
    short: "Vision",
    description:
      "A camera module mounted high on the mast streams live video over Wi-Fi to the laptop, where AI models look for people, fire, smoke, and hazards.",
    x: 38.4,
    y: 26.3,
  },
  {
    id: "sensors",
    label: "Sensor Suite",
    short: "Sensing",
    description:
      "An HC-SR04 sonar measures the distance ahead and stops the rover before obstacles, while MQ-2 gas and DHT11 temperature and humidity sensors read the environment.",
    x: 77.2,
    y: 55,
  },
  {
    id: "motors",
    label: "Drive Motors",
    short: "Mobility",
    description:
      "A pair of DC drive motors translate control signals into rover movement, enabling forward, reverse, and turning maneuvers.",
    x: 65.6,
    y: 66.6,
  },
  {
    id: "storage",
    label: "Ball Tower (Manual Loading)",
    short: "Storage",
    description:
      "There is no automatic intake: before a run the operator drops the foam payload balls by hand into the top of the tower that also carries the camera. The balls stack inside the tube, so several shots can be fired without reloading.",
    x: 32,
    y: 39.1,
  },
  {
    id: "feed",
    label: "Servo Gate Feeder",
    short: "Feeding",
    description:
      "A servo gate at the bottom of the tower holds the stacked balls back. When the operator presses launch, the gate opens briefly and releases one ball into the spinning flywheel, then closes again.",
    x: 36.6,
    y: 47.5,
  },
  {
    id: "launch",
    label: "Payload Launching Mechanism",
    short: "Launching",
    description:
      "A relay-switched DC motor spins a flywheel that grips each ball released by the servo gate and throws it along a clear curved guide toward the target area. Launch distance depends on motor speed and ball properties, and must be verified in a controlled, safe environment.",
    x: 45.3,
    y: 41.6,
  },
  {
    id: "power",
    label: "Power System",
    short: "Energy",
    description:
      "A rechargeable 3S lithium-polymer (LiPo) battery supplies power to the control unit, drive motors, and payload mechanism.",
    x: 34.1,
    y: 56.3,
  },
];
