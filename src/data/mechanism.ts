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
    x: 50,
    y: 50,
  },
  {
    id: "motors",
    label: "Drive Motors",
    short: "Mobility",
    description:
      "A pair of DC drive motors translate control signals into rover movement, enabling forward, reverse, and turning maneuvers.",
    x: 50,
    y: 78,
  },
  {
    id: "intake",
    label: "Ball Intake Mechanism",
    short: "Intake",
    description:
      "The intake mechanism collects the fire-response payload balls and guides them into the rover's internal storage or feeding system, reducing manual handling during operation. Reliable intake still requires mechanical testing.",
    x: 44.8,
    y: 21.2,
  },
  {
    id: "storage",
    label: "Payload Storage Chamber",
    short: "Storage",
    description:
      "The storage chamber temporarily holds multiple payload balls before they reach the launching mechanism, helping organize the firing sequence and reducing the need to reload after every launch. Final capacity depends on the mechanical design.",
    x: 44.8,
    y: 34.2,
  },
  {
    id: "feed",
    label: "Ball Feeding Mechanism",
    short: "Feeding",
    description:
      "The feeding mechanism transfers stored balls from the chamber to the launcher one at a time, preventing multiple balls from entering at once. Alignment and timing still require testing for reliable feeding.",
    x: 50,
    y: 34.2,
  },
  {
    id: "launch",
    label: "Payload Launching Mechanism",
    short: "Launching",
    description:
      "The launching mechanism receives a ball from the feeding system and propels it toward the designated target area using a motorized roller assembly. Launch distance depends on motor speed, ball properties, and the final mechanical design, and must be verified in a controlled, safe environment.",
    x: 58,
    y: 32.7,
  },
  {
    id: "power",
    label: "Power System",
    short: "Energy",
    description:
      "A rechargeable battery pack supplies power to the control unit, drive motors, and payload mechanism.",
    x: 29,
    y: 50,
  },
];
