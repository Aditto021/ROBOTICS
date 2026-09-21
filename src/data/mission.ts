export type MissionIcon = "deploy" | "approach" | "collect" | "launch" | "evaluate";

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
      "The integrated mechanism collects or feeds the fire-response payload into the launching system.",
  },
  {
    index: "04",
    title: "Launch",
    icon: "launch",
    description:
      "The launching mechanism sends the payload toward the designated target area.",
  },
  {
    index: "05",
    title: "Evaluate",
    icon: "evaluate",
    description:
      "The operator observes the outcome and determines the next operational step.",
  },
];
