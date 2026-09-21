export interface ArchitectureNode {
  id: string;
  index: string;
  title: string;
  description: string;
}

export const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: "smartphone",
    index: "01",
    title: "Smartphone",
    description:
      "The operator issues movement and payload commands from a mobile control interface.",
  },
  {
    id: "wireless",
    index: "02",
    title: "Wireless Communication",
    description:
      "Commands travel over a wireless link between the smartphone and the rover's onboard receiver.",
  },
  {
    id: "esp32",
    index: "03",
    title: "ESP32 Controller",
    description:
      "The microcontroller decodes incoming commands and routes them to the appropriate subsystem.",
  },
  {
    id: "drivers",
    index: "04",
    title: "Motor Drivers",
    description:
      "Driver circuitry converts controller signals into the power levels needed to run the motors.",
  },
  {
    id: "output",
    index: "05",
    title: "Movement + Payload Mechanism",
    description:
      "The rover moves and the payload mechanism actuates, completing the command loop.",
  },
];
