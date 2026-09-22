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
    title: "MCU (ESP32) Controller",
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
    id: "movement",
    index: "05",
    title: "Robot Movement",
    description:
      "The drive motors turn, moving the rover toward the designated target area.",
  },
  {
    id: "intake",
    index: "06",
    title: "Payload Intake",
    description:
      "Once in position, the intake mechanism collects a fire-response payload ball.",
  },
  {
    id: "storage",
    index: "07",
    title: "Payload Storage",
    description:
      "The collected ball is held in the storage chamber until the launch sequence begins.",
  },
  {
    id: "feeding",
    index: "08",
    title: "Ball Feeding",
    description:
      "The feeding mechanism transfers one stored ball at a time toward the launcher.",
  },
  {
    id: "launching",
    index: "09",
    title: "Payload Launching",
    description:
      "The launching mechanism propels the ball toward the designated target area, completing the command loop.",
  },
];
