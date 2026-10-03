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
      "Taken together, these five papers frame the problem ResQBot addresses. Rescue robotics is an active field: Huamanchahua et al. reviewed 26 rescue-robot articles from 2017 to 2021, and Moniruzzaman et al. surveyed how mobile robots are teleoperated and how those methods are enhanced. The operator's interface is a recurring concern. Kim et al. designed a handheld controller for firefighters and a joystick controller for precise commands, evaluated both through a usability questionnaire, and built them to gather video, temperature, and gas data from the robot. The newer work moves toward autonomy and connectivity: Kavitha et al.'s FireGuardian combines fire sensors, an automated extinguisher, cloud monitoring, and machine-learning-based navigation toward fire sources, and Abdul Rahman et al. likewise build an IoT-based firefighting robot. Across these works the same trade-offs recur: keeping people out of hazardous spaces, making robots usable under pressure, and keeping the remote link reliable. These are the same questions ResQBot's research section raises.",
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
      "Taken together, these three papers focus on how people stay in control of rescue robots. The Rescue Rover paper describes a six-wheel all-terrain vehicle with an ESP32-CAM camera, GPS tracking, Bluetooth remote control, and audio communication, but its evaluation is mainly a description of the prototype, with no detailed measurements under disaster conditions, and its payload capacity and performance in extreme terrain remain open questions. The map-based interface paper tackles operator workload: the operator selects targets on a map with a touch-pen and groups robots that then move in formation. It was the fastest of the compared methods, but collisions occurred during formation control, which points to letting operators set the formation directly and adapting it automatically when obstacles appear. The automatic fire extinguisher robot senses temperature with a thermocouple, avoids obstacles, and pumps water, yet the paper does not explain how it recovers from a bad sensor reading or a wrong decision, which motivates a hybrid automatic-manual system with a human override and fail-safe stops. Across the three, the shared theme is that rescue robots are most useful when people stay in the loop: operators need an interface they can handle under load, evidence of performance in realistic conditions, and a safe way to take over when automation fails.",
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
      "Taken together, these two papers show two complementary sides of a firefighting robot. The IRJET paper proposes a Raspberry Pi 4 robot with a camera that looks for human presence, and extinguishes fire with a fireball, a lightweight medium that bursts on contact, instead of spraying water or foam, which the authors argue can injure people. The MDPI paper focuses on the mechanics and control of the extinguisher itself: a hybrid wheeled robot with a two-degree-of-freedom ball-shooting turret whose aim is stabilized against body movement using PID and SMC controllers. Its simulations report a shooting success rate of 85.71% with PID and 95.23% with SMC over 105 shots. Together they point to three requirements: detecting people and fire, using a safe extinguishing medium, and a stable, accurate launching mechanism. ResQBot's design uses a foam ball as a safe stand-in payload and a turret that launches it, so both papers bear directly on its launching and aiming work.",
  },
];
