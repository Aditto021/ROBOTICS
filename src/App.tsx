import { useState } from "react";
import { MotionConfig } from "framer-motion";
import { Preloader } from "./components/Preloader";
import { Nav } from "./components/Nav";
import { ScrollProgressBar } from "./components/ScrollProgressBar";
import { CursorGlow } from "./components/CursorGlow";
import { Hero } from "./sections/Hero";
import { Overview } from "./sections/Overview";
import { Mechanism } from "./sections/Mechanism";
import { Architecture } from "./sections/Architecture";
import { MissionSimulation } from "./sections/MissionSimulation";
import { ControlConsole } from "./sections/ControlConsole";
import { Research } from "./sections/Research";
import { Team } from "./sections/Team";
import { Contact } from "./sections/Contact";
import { Footer } from "./sections/Footer";
import { useIntroSeen } from "./hooks/useIntroSeen";

function App() {
  const { seen, markSeen } = useIntroSeen();
  const [introDone, setIntroDone] = useState(seen);

  const handleIntroComplete = () => {
    markSeen();
    setIntroDone(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      {!introDone && <Preloader onComplete={handleIntroComplete} />}

      <ScrollProgressBar />
      <CursorGlow />
      <Nav />

      <main id="top" className="relative">
        <Hero />
        <Overview />
        <Mechanism />
        <Architecture />
        <MissionSimulation />
        <ControlConsole />
        <Research />
        <Team />
        <Contact />
      </main>

      <Footer />
    </MotionConfig>
  );
}

export default App;
