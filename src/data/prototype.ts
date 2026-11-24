export interface PrototypePhoto {
  src: string;
  title: string;
  caption: string;
}

/** Photos of the built ResQBot prototype (public/prototype). */
export const PROTOTYPE_PHOTOS: PrototypePhoto[] = [
  {
    src: "/prototype/launcher-front.webp",
    title: "Payload launcher",
    caption:
      "Flywheel launch motor and feeder servo, with the ESP32-CAM mounted high on the mast for a clear forward view.",
  },
  {
    src: "/prototype/launcher-side.webp",
    title: "Launcher & power panel",
    caption:
      "Side view of the launcher with the battery voltage display, main power switch, and the wiring bay below.",
  },
  {
    src: "/prototype/rover-bench.webp",
    title: "Rover on the test bench",
    caption:
      "The assembled four-wheel rover with its front sonar sensor, being programmed and tested from a laptop.",
  },
  {
    src: "/prototype/electronics-bay.webp",
    title: "Electronics bay",
    caption:
      "ESP32 controller, L298N motor driver, 3S LiPo battery with protection board, MQ-2 gas sensor, DHT11, HC-SR04 sonar, and relay.",
  },
];
