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
    label: "ESP32 Control Unit",
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
    id: "payload",
    label: "Payload Mechanism",
    short: "Handling",
    description:
      "A mechanical arm collects and positions the fire-response payload before it is launched toward the target area.",
    x: 62,
    y: 27,
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
  {
    id: "foam",
    label: "Fire-Response Payload (Foam-Ball)",
    short: "Payload",
    description:
      "A lightweight foam ball serves as the current fire-response payload for safe, repeatable collection-and-launch trials — not a certified extinguishing agent.",
    x: 70,
    y: 20,
  },
];
