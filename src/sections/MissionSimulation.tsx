import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { MISSION_STEPS } from "../data/mission";

export function MissionSimulation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(
      MISSION_STEPS.length - 1,
      Math.floor(v * MISSION_STEPS.length)
    );
    setActiveStep(idx);
  });

  return (
    <section id="mission" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-cyan">
            [ 04 — MISSION SIMULATION ]
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            A controlled demonstration scenario
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Scroll through the five stages of a typical ResQBot demonstration
            run.
          </p>
        </motion.div>
      </div>

      <div ref={containerRef} style={{ height: `${MISSION_STEPS.length * 65}vh` }}>
        <div className="sticky top-24 mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              {MISSION_STEPS.map((step, i) => (
                <div key={step.index} className="flex gap-4 py-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`font-mono text-xs tracking-widest transition-colors duration-300 ${
                        i === activeStep ? "text-cyan" : "text-muted/50"
                      }`}
                    >
                      {step.index}
                    </span>
                    {i < MISSION_STEPS.length - 1 && (
                      <span
                        className={`mt-2 h-8 w-px transition-colors duration-300 ${
                          i < activeStep ? "bg-cyan" : "bg-white/10"
                        }`}
                      />
                    )}
                  </div>
                  <div className={i === activeStep ? "opacity-100" : "opacity-40"}>
                    <p
                      className={`font-display text-2xl font-semibold transition-colors duration-300 sm:text-3xl ${
                        i === activeStep ? "text-paper" : "text-muted"
                      }`}
                    >
                      {step.title}
                    </p>
                    <motion.p
                      initial={false}
                      animate={{
                        height: i === activeStep ? "auto" : 0,
                        opacity: i === activeStep ? 1 : 0,
                      }}
                      transition={{ duration: 0.35 }}
                      className="overflow-hidden text-sm leading-relaxed text-muted"
                    >
                      <span className="block pt-1.5">{step.description}</span>
                    </motion.p>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-7">
              <div className="relative aspect-video w-full overflow-hidden border border-white/10 bg-graphite">
                <div className="absolute inset-0 bg-grid-fine opacity-30" />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(500px circle at 50% 50%, rgba(43,227,255,0.08), transparent 70%)",
                  }}
                />
                <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
                  <span className="font-mono text-6xl font-semibold text-white/10 sm:text-8xl">
                    {MISSION_STEPS[activeStep].index}
                  </span>
                  <p className="font-mono text-xs tracking-[0.3em] text-cyan">
                    {MISSION_STEPS[activeStep].title.toUpperCase()}
                  </p>
                  <div className="mt-2 flex items-center gap-2 border border-white/15 px-4 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange animate-pulse-slow" />
                    <span className="font-mono text-[10px] tracking-widest text-muted">
                      DEMONSTRATION VIDEO — COMING SOON
                    </span>
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 flex gap-1 p-2">
                  {MISSION_STEPS.map((step, i) => (
                    <span
                      key={step.index}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        i <= activeStep ? "bg-cyan" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
