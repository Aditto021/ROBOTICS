export interface MissionStep {
  index: string;
  title: string;
  description: string;
}

export const MISSION_STEPS: MissionStep[] = [
  {
    index: "01",
    title: "Deploy",
    description: "The operator controls the rover using a smartphone.",
  },
  {
    index: "02",
    title: "Approach",
    description: "The rover moves toward a designated demonstration area.",
  },
  {
    index: "03",
    title: "Collect",
    description: "The mechanism guides or collects a soft foam ball.",
  },
  {
    index: "04",
    title: "Launch",
    description: "The mechanism launches the foam ball toward a marked target.",
  },
  {
    index: "05",
    title: "Evaluate",
    description: "The team records the demonstration result.",
  },
];
