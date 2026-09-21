export interface NavItem {
  id: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "mechanism", label: "Mechanism" },
  { id: "architecture", label: "Architecture" },
  { id: "mission", label: "Mission" },
  { id: "control", label: "Control" },
  { id: "research", label: "Research" },
  { id: "team", label: "Team" },
  { id: "contact", label: "Contact" },
];
