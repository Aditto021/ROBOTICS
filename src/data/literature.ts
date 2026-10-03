export interface LiteraturePaper {
  title: string;
  venue: string;
  authors?: string;
  url?: string;
  thumb?: string;
}

export interface LiteratureReview {
  owner: string;
  papers: LiteraturePaper[];
  summary: string;
}

export const LITERATURE_REVIEWS: LiteratureReview[] = [
  {
    owner: "Tanvir Ahmed Aditto",
    papers: [
      {
        authors: "Y.-D. Kim, J.-H. Kang, D.-H. Sun, J.-I. Moon, Y.-S. Ryuh, J. An",
        title: "Design and implementation of user-friendly remote controllers for rescue robots used at fire sites",
        venue: "IEEE/RSJ IROS, 2010",
        url: "https://ieeexplore.ieee.org/document/5602450/",
      },
      {
        authors: "M. Moniruzzaman, A. Rassau, D. Chai, S. M. S. Islam",
        title: "Teleoperation methods and enhancement techniques for mobile robots: A comprehensive survey",
        venue: "Robotics and Autonomous Systems, vol. 150, 2022",
        url: "https://doi.org/10.1016/j.robot.2021.103973",
      },
      {
        authors: "D. Huamanchahua, K. Aubert, M. Rivas, E. Guerrero, L. Kodaka, D. Guevara",
        title: "Land-mobile robots for rescue and search: A technological and systematic review",
        venue: "IEEE IEMTRONICS, Toronto, 2022",
        url: "https://ieeexplore.ieee.org/document/9795829/",
      },
      {
        authors: "A. A. Abdul Rahman, Z. Janin, R. Sam, M. Masrie, T. S. Gunawan, F. D. Abdul Rahman",
        title: "Firefighting robot based on IoT and ban levels technique",
        venue: "IEEE ICSIMA, Melaka, 2022",
      },
      {
        authors: "T. Kavitha, P. Neeraj, K. Sunil Kumar, B. Naga Shravan, J. Nadira Anjum",
        title: "FireGuardian: A smart IoT firefighting robot for automated fire hazard mitigation",
        venue: "ICRDICCT, 2025",
        url: "https://www.scitepress.org/Papers/2025/139046/139046.pdf",
        thumb: "/papers/thumbs/kavitha-2025.jpg",
      },
    ],
    summary:
      "Operator usability and reliable remote control are the recurring concerns. Kim et al. built controllers for firefighters, Moniruzzaman et al. surveyed teleoperation, and Huamanchahua et al. reviewed 26 rescue-robot studies. The newer IoT work, FireGuardian and Abdul Rahman et al., adds sensors, cloud monitoring, and autonomous navigation to fire-fighting robots.",
  },
  {
    owner: "Sanjida Akter Jui",
    papers: [
      {
        title: "Rescue Rover: All-Terrain Emergency Response and Exploration Vehicle",
        venue: "IEEE Xplore",
        url: "https://ieeexplore.ieee.org/abstract/document/10714744",
      },
      {
        title: "Map-based Navigation Interface for Multiple Rescue Robots",
        venue: "IEEE Xplore",
        url: "https://ieeexplore.ieee.org/document/4745893",
      },
      {
        title: "Automatic Fire Extinguisher Robot",
        venue: "IEEE Xplore",
        url: "https://ieeexplore.ieee.org/document/11089149",
      },
    ],
    summary:
      "Rescue robots work best when people stay in control. Rescue Rover offers all-terrain mobility and live video, but lacks detailed testing in disaster conditions. The map-based interface cuts operator workload, but its robot formations collided. The fire-extinguisher robot automates firefighting, but has no documented human override.",
  },
  {
    owner: "Mohammad Abrar Akhtar Aman",
    papers: [
      {
        authors: "A. Krishna S, C. M. Abraham, P. Sreekumar, V. Vijayan",
        title: "Fire extinguisher robot using fireball as extinguisher",
        venue: "IRJET, vol. 07, issue 06, 2020",
        url: "https://www.irjet.net/archives/V7/i6/IRJET-V7I6432.pdf",
        thumb: "/papers/thumbs/irjet-2020.jpg",
      },
      {
        authors: "A. K. Tanyıldızı",
        title: "Design, control and stabilization of a transformable wheeled fire fighting robot with a fire-extinguishing, ball-shooting turret",
        venue: "Machines, vol. 11, no. 4, 2023, art. 492",
        url: "https://www.mdpi.com/2075-1702/11/4/492",
      },
    ],
    summary:
      "The IRJET paper uses a camera to find people and a fireball instead of water, which avoids injury. The MDPI paper stabilizes a ball-shooting turret with PID and SMC controllers, reporting simulated hit rates of 85.71% and 95.23%. Both bear on ResQBot's launching and aiming.",
  },
];
