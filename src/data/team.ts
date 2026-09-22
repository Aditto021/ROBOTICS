export interface TeamMember {
  name: string;
  role: string;
  studentId?: string;
  bio?: string;
  photo?: string;
}

// Placeholder roster — replace remaining names before publishing.
export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Tanvir Ahmed Aditto",
    role: "Team Lead / Systems Integration",
    studentId: "2110457",
    bio: "Leads ResQBot's systems integration, coordinating the rover's hardware, firmware, and mobile control interface into a single working platform.",
    photo: "/team/lead.jpg",
  },
  { name: "Add Name", role: "Embedded Systems & Firmware" },
  { name: "Add Name", role: "Mechanical Design" },
  { name: "Add Name", role: "Mobile App & Controls" },
];
