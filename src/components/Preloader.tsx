import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

interface PreloaderProps {
  onComplete: () => void;
}

interface StatusItem {
  label: string;
  pending: string;
}

const STATUS_ITEMS: StatusItem[] = [
  { label: "CORE MODULE", pending: "INITIALIZING" },
  { label: "MOTION CONTROL", pending: "CHECKING" },
  { label: "PAYLOAD SYSTEM", pending: "CHECKING" },
  { label: "REMOTE LINK", pending: "CONNECTING" },
];

type Phase = "init" | "activate";

export function Preloader({ onComplete }: PreloaderProps) {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<Phase>("init");
  const [resolved, setResolved] = useState(0);

  const settleDelay = reduced ? 100 : 450;
  const activatePhaseDuration = reduced ? 150 : 1300;
  const stepDelays = reduced ? [60, 110, 160, 210] : [320, 650, 1000, 1400];

  useEffect(() => {
    const timers = stepDelays.map((delay, i) =>
      setTimeout(() => setResolved((n) => Math.max(n, i + 1)), delay)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resolved < STATUS_ITEMS.length) return;
    const timer = setTimeout(() => setPhase("activate"), settleDelay);
    return () => clearTimeout(timer);
  }, [resolved, settleDelay]);

  useEffect(() => {
    if (phase !== "activate") return;
    const timer = setTimeout(() => setVisible(false), activatePhaseDuration);
    return () => clearTimeout(timer);
  }, [phase, activatePhaseDuration]);

  const progress = useMemo(
    () => Math.round((resolved / STATUS_ITEMS.length) * 100),
    [resolved]
  );

  const handleSkip = () => setVisible(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exitTransition = { duration: reduced ? 0.25 : 0.9, ease: [0.83, 0, 0.17, 1] as const };

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] bg-void text-paper"
          exit={{ transition: { duration: reduced ? 0.25 : 0.95 } }}
          role="dialog"
          aria-label="ResQBot system initialization"
          aria-live="polite"
        >
          {!reduced && (
            <>
              <motion.div
                className="absolute inset-x-0 top-0 h-1/2 border-b border-white/5 bg-void"
                exit={{ y: "-100%" }}
                transition={exitTransition}
              />
              <motion.div
                className="absolute inset-x-0 bottom-0 h-1/2 border-t border-white/5 bg-void"
                exit={{ y: "100%" }}
                transition={exitTransition}
              />
            </>
          )}

          <div className="absolute inset-0 bg-grid-fine opacity-40" aria-hidden />
          <div
            className="absolute inset-0 opacity-60"
            aria-hidden
            style={{
              background:
                "radial-gradient(600px circle at 50% 50%, rgba(43,227,255,0.08), transparent 70%)",
            }}
          />

          <button
            type="button"
            onClick={handleSkip}
            className="absolute right-6 top-6 z-10 flex items-center gap-2 border border-white/15 px-4 py-2 font-mono text-xs tracking-widest text-muted transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            SKIP INTRO
            <span aria-hidden>↷</span>
          </button>

          <motion.div
            className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6"
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(6px)" }}
            transition={{ duration: reduced ? 0.25 : 0.55 }}
          >
            <AnimatePresence mode="wait">
              {phase === "init" ? (
                <motion.div
                  key="init"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-md"
                >
                  <p className="mb-8 text-center font-mono text-xs tracking-[0.3em] text-cyan/80">
                    [ RESQBOT SYSTEM INITIALIZING ]
                  </p>

                  <div className="mb-6 h-px w-full bg-white/10" />

                  <p className="mb-4 font-mono text-[11px] tracking-[0.2em] text-muted">
                    SYSTEM STATUS:
                  </p>

                  <ul className="mb-8 space-y-3">
                    {STATUS_ITEMS.map((item, i) => {
                      const isDone = resolved > i;
                      return (
                        <li
                          key={item.label}
                          className="flex items-center justify-between font-mono text-xs tracking-wider"
                        >
                          <span className="flex items-center gap-3 text-paper/80">
                            <span
                              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                                isDone ? "bg-cyan" : "bg-orange animate-pulse-slow"
                              }`}
                              aria-hidden
                            />
                            {item.label}
                          </span>
                          <span
                            className={isDone ? "text-cyan" : "text-orange/80"}
                          >
                            {isDone ? "READY" : item.pending}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="h-[2px] w-full overflow-hidden bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan via-cyan to-orange"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                  <p className="mt-2 text-right font-mono text-[10px] tracking-widest text-muted">
                    {progress.toString().padStart(3, "0")}%
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="activate"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center"
                >
                  <div className="relative flex h-40 w-40 items-center justify-center sm:h-52 sm:w-52">
                    <motion.div
                      className="absolute inset-0 rounded-full border border-cyan/25"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.6 }}
                    />
                    <motion.div
                      className="absolute inset-4 rounded-full border border-dashed border-orange/30 animate-spin-slow"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15, duration: 0.5 }}
                    />
                    <motion.div
                      className="absolute inset-10 rounded-full border border-cyan/20 animate-spin-reverse-slow"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25, duration: 0.5 }}
                    />
                    <motion.span
                      className="font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl"
                      initial={{ opacity: 0, letterSpacing: "0.4em" }}
                      animate={{ opacity: 1, letterSpacing: "0em" }}
                      transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                      RQB
                    </motion.span>
                  </div>
                  <motion.p
                    className="mt-6 font-mono text-xs tracking-[0.3em] text-cyan text-glow-cyan"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55, duration: 0.5 }}
                  >
                    ALL SYSTEMS READY
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
