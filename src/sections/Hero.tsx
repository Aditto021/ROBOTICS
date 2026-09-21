import { motion } from "framer-motion";
import { RevealText } from "../components/RevealText";
import { MagneticButton } from "../components/MagneticButton";
import { RobotVisual } from "../components/RobotVisual";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center overflow-hidden pt-28 pb-16"
    >
      <div className="absolute inset-0 bg-grid opacity-[0.15]" aria-hidden />
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px circle at 15% 20%, rgba(43,227,255,0.08), transparent 60%), radial-gradient(700px circle at 85% 80%, rgba(255,122,41,0.07), transparent 60%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2 lg:gap-8 lg:px-10">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mb-6 flex items-center gap-3 font-mono text-xs tracking-[0.25em] text-cyan"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse-slow" />
            RESQBOT · REMOTE ROVER PLATFORM
          </motion.p>

          <RevealText
            className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            delay={0.3}
            lines={["REMOTE RESPONSE.", <span key="line-2" className="text-cyan text-glow-cyan">REIMAGINED.</span>]}
          />

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.7 }}
            className="mt-7 max-w-md text-base leading-relaxed text-muted sm:text-lg"
          >
            ResQBot is a smartphone-controlled robotic rover designed to
            demonstrate remote lightweight payload handling and launching in
            a controlled environment.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.7 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <MagneticButton onClick={() => scrollTo("mechanism")} variant="primary">
              EXPLORE SYSTEM
            </MagneticButton>
            <MagneticButton onClick={() => scrollTo("mission")} variant="ghost">
              VIEW DEMONSTRATION
            </MagneticButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.7 }}
            className="mt-14 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6 font-mono text-[11px] tracking-widest text-muted"
          >
            <div>
              <p className="text-muted/70">STATUS</p>
              <p className="mt-1 text-cyan">OPERATIONAL</p>
            </div>
            <div>
              <p className="text-muted/70">CONTROL LINK</p>
              <p className="mt-1 text-paper">SMARTPHONE</p>
            </div>
            <div>
              <p className="text-muted/70">MODE</p>
              <p className="mt-1 text-orange">DEMONSTRATION</p>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-md lg:max-w-lg"
        >
          <RobotVisual mode="hero" />

          <div className="pointer-events-none absolute -left-6 top-2 hidden glass-panel px-3 py-2 sm:block">
            <p className="font-mono text-[10px] tracking-widest text-muted">LINK</p>
            <p className="font-mono text-xs text-cyan">WIRELESS · ACTIVE</p>
          </div>
          <div className="pointer-events-none absolute -right-4 bottom-6 hidden glass-panel px-3 py-2 sm:block">
            <p className="font-mono text-[10px] tracking-widest text-muted">PAYLOAD</p>
            <p className="font-mono text-xs text-orange">STANDBY</p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
      >
        <span className="font-mono text-[10px] tracking-[0.3em] text-muted">SCROLL</span>
        <span className="h-9 w-px animate-pulse-slow bg-gradient-to-b from-cyan to-transparent" />
      </motion.div>
    </section>
  );
}
