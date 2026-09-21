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
      "A mechanical arm guides and positions the demonstration payload before launch, driven by a dedicated actuator.",
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
    label: "Foam-Ball Demonstration System",
    short: "Payload",
    description:
      "A lightweight foam ball stands in for a payload, allowing safe, repeatable collection-and-launch demonstrations.",
    x: 70,
    y: 20,
  },
];
