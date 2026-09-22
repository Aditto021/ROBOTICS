export type MissionIcon =
  | "deploy"
  | "approach"
  | "collect"
  | "store"
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
    title: "Deploy",
    icon: "deploy",
    description:
      "The operator initiates the rover and controls it through a smartphone interface.",
  },
  {
    index: "02",
    title: "Approach",
    icon: "approach",
    description:
      "The rover moves toward the designated target area under remote operator control.",
  },
  {
    index: "03",
    title: "Collect",
    icon: "collect",
    description:
      "The intake mechanism collects the fire-response payload balls.",
  },
  {
    index: "04",
    title: "Store",
    icon: "store",
    description:
      "The collected balls are held temporarily inside the storage chamber.",
  },
  {
    index: "05",
    title: "Feed",
    icon: "feed",
    description:
      "The feeding mechanism transfers a stored ball toward the launcher.",
  },
  {
    index: "06",
    title: "Launch",
    icon: "launch",
    description:
      "The launching mechanism sends the payload toward the designated target area.",
  },
  {
    index: "07",
    title: "Evaluate",
    icon: "evaluate",
    description:
      "The operator observes the outcome and determines the next operational step.",
  },
];
