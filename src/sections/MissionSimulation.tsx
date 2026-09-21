import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MISSION_STEPS, type MissionIcon } from "../data/mission";

function StepIcon({ icon, className }: { icon: MissionIcon; className?: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (icon) {
    case "deploy":
      return (
        <svg {...common}>
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
          <path d="M11 18.2h2" />
        </svg>
      );
    case "approach":
      return (
        <svg {...common}>
          <path d="M12 3v13" />
          <path d="M7 11l5 5 5-5" />
          <path d="M5 20.5h14" />
        </svg>
      );
    case "collect":
      return (
        <svg {...common}>
          <path d="M4 5h16" />
          <path d="M6 5l1.5 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8L18 5" />
          <path d="M10 10.5h4" />
        </svg>
      );
    case "launch":
      return (
        <svg {...common}>
          <path d="M12 21V8" />
          <path d="M6.5 13.5L12 8l5.5 5.5" />
          <path d="M8 21h8" />
        </svg>
      );
    case "evaluate":
      return (
        <svg {...common}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.6" />
        </svg>
      );
  }
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const swipeThreshold = 45;

export function MissionSimulation() {
  const total = MISSION_STEPS.length;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchStartX = useRef<number | null>(null);

  const goTo = (next: number) => {
    if (next < 0 || next >= total || next === step) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const prev = () => goTo(step - 1);
  const next = () => goTo(step + 1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > swipeThreshold) prev();
    else if (delta < -swipeThreshold) next();
    touchStartX.current = null;
  };

  const current = MISSION_STEPS[step];

  return (
    <section id="mission" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-cyan">
            [ 04 — PAYLOAD DELIVERY SYSTEM ]
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            From remote command to payload delivery
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Step through the five stages of a ResQBot response sequence.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7 }}
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label="ResQBot mission stages"
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="glass-panel border border-line/10 p-6 outline-none sm:p-10"
        >
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3 border border-cyan/30 bg-cyan/5 px-3 py-1.5 text-cyan">
              <StepIcon icon={current.icon} />
              <span className="font-mono text-[10px] tracking-widest">
                STAGE {step + 1} / {total}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {MISSION_STEPS.map((s, i) => (
                <button
                  key={s.index}
                  onClick={() => goTo(i)}
                  aria-label={`Go to stage ${i + 1}: ${s.title}`}
                  aria-current={i === step}
                  className="p-1.5"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? "w-6 bg-cyan" : "w-1.5 bg-line/20 hover:bg-line/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-[168px] overflow-hidden sm:min-h-[140px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, x: direction * 36 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -36 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="font-mono text-6xl font-semibold text-line/10 sm:text-7xl">
                  {current.index}
                </span>
                <h3 className="mt-2 font-display text-2xl font-semibold text-paper sm:text-3xl">
                  {current.title}
                </h3>
                <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
                  {current.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-10 flex items-center gap-4 border-t border-line/10 pt-6">
            <button
              onClick={prev}
              disabled={step === 0}
              aria-label="Previous stage"
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-line/15 text-paper transition-colors hover:border-cyan/50 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line/15 disabled:hover:text-paper"
            >
              <ChevronIcon direction="left" />
            </button>

            <div className="relative h-px flex-1 bg-line/10">
              <motion.div
                className="absolute inset-y-0 left-0 bg-cyan"
                animate={{ width: `${((step + 1) / total) * 100}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            <button
              onClick={next}
              disabled={step === total - 1}
              aria-label="Next stage"
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-line/15 text-paper transition-colors hover:border-cyan/50 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line/15 disabled:hover:text-paper"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>

          <p className="mt-5 text-center font-mono text-[10px] tracking-widest text-muted/50">
            FIELD FOOTAGE — COMING SOON
          </p>
        </motion.div>
      </div>
    </section>
  );
}
