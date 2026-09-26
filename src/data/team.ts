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
  {
    name: "Mohammad Abrar Akhtar Aman",
    role: "Second Leader / Embedded Systems & Firmware",
    studentId: "2110660",
    bio: "Serves as the project's second leader and works on ResQBot's embedded systems and firmware, developing the code that connects sensor input, motor control, and the smartphone command interface.",
    photo: "/team/member2.jpg",
    social: {
      github: "https://github.com/aaman0021",
      linkedin:
        "https://www.linkedin.com/in/mohammad-abrar-akhtar-aman-613090358?utm_source=share_via&utm_content=profile&utm_medium=member_android",
      researchgate: "https://www.researchgate.net/profile/Mohammad-Abrar-Akhtar-Aman?ev=hdr_xprf",
    },
  },
  {
    name: "Kazi Ismat Nahar Epthi",
    role: "Mechanical Design",
    studentId: "2330813",
    bio: "Works on ResQBot's mechanical design, shaping the chassis, payload mechanism, and structural layout that holds the rover together.",
    photo: "/team/member3.jpg",
    social: {
      github: "https://github.com/kaziepthii",
      linkedin: "https://www.linkedin.com/in/kazi-ismat-nahar-epthi-459200294/",
      researchgate: "https://www.researchgate.net/profile/Kazi-Epthi?ev=hdr_xprf",
    },
  },
  { name: "Add Name", role: "Mobile App & Controls" },
];
