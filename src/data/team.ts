export interface SocialLinks {
  github?: string;
  linkedin?: string;
  researchgate?: string;
}

export interface TeamMember {
  name: string;
  role: string;
  studentId?: string;
  bio?: string;
  photo?: string;
  social?: SocialLinks;
}

// Placeholder roster — replace remaining names before publishing.
export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Tanvir Ahmed Aditto",
    role: "Team Lead / Systems Integration",
    studentId: "2110457",
    bio: "Leads ResQBot's systems integration, coordinating the rover's hardware, firmware, and mobile control interface into a single working platform.",
    photo: "/team/lead.jpg",
    social: {
      github: "https://github.com/Aditto021",
      linkedin: "https://www.linkedin.com/in/tanvir-ahmed-aditto-35808b358/",
      researchgate:
        "https://www.researchgate.net/profile/Tanvir-Aditto?_tp=eyJjb250ZXh0Ijp7InBhZ2UiOiJwcm9maWxlIiwicHJldmlvdXNQYWdlIjpudWxsfX0",
    },
  },
  { name: "Add Name", role: "Embedded Systems & Firmware" },
  { name: "Add Name", role: "Mechanical Design" },
  { name: "Add Name", role: "Mobile App & Controls" },
];
