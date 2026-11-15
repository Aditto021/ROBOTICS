export type MissionIcon =
  | "load"
  | "deploy"
  | "approach"
  | "aim"
  | "feed"
  | "launch"
  | "evaluate";

export interface MissionStep {
  index: string;
  title: string;
  description: string;
  icon: MissionIcon;
}

export const MISSION_STEPS: MissionStep[] = [
  {
    index: "01",
    title: "Load",
    icon: "load",
    description:
      "The operator drops the foam payload balls by hand into the top of the camera tower, where they stack up ready to fire.",
  },
  {
    index: "02",
    title: "Deploy",
    icon: "deploy",
    description:
      "The operator initiates the rover and controls it through a smartphone interface.",
  },
  {
    index: "03",
    title: "Approach",
    icon: "approach",
    description:
      "The rover moves toward the designated target area under remote operator control.",
  },
  {
    index: "04",
    title: "Aim",
    icon: "aim",
    description:
      "The operator lines up the target using the live ESP32-CAM view from the top of the tower.",
  },
  {
    index: "05",
    title: "Feed",
    icon: "feed",
    description:
      "On command, the servo gate at the bottom of the tower opens and releases one ball into the launcher.",
  },
  {
    index: "06",
    title: "Launch",
    icon: "launch",
    description:
      "The spinning flywheel sends the ball along the guide toward the designated target area.",
  },
  {
    index: "07",
    title: "Evaluate",
    icon: "evaluate",
    description:
      "The operator observes the outcome and determines the next operational step.",
  },
];
