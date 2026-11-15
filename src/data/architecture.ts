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
    id: "loading",
    index: "06",
    title: "Manual Loading",
    description:
      "Before the run, the operator drops the foam payload balls by hand into the top of the camera tower.",
  },
  {
    id: "storage",
    index: "07",
    title: "Payload Storage",
    description:
      "The balls wait stacked inside the tower tube until the operator gives the launch command.",
  },
  {
    id: "feeding",
    index: "08",
    title: "Ball Feeding",
    description:
      "A servo gate at the bottom of the tower opens and releases one ball at a time into the launcher.",
  },
  {
    id: "launching",
    index: "09",
    title: "Payload Launching",
    description:
      "The relay-driven flywheel propels the ball toward the designated target area, completing the command loop.",
  },
];
