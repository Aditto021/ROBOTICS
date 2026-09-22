import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RobotVisual } from "../components/RobotVisual";
import { MECHANISM_COMPONENTS } from "../data/mechanism";

const assemblyOffsets = [
  { x: -30, y: -20 },
  { x: 30, y: -24 },
  { x: -34, y: 18 },
  { x: 32, y: 22 },
  { x: 0, y: -30 },
  { x: -22, y: 28 },
  { x: 26, y: -16 },
];

export function Mechanism() {
  const [selected, setSelected] = useState<string | null>(null);
  const active = MECHANISM_COMPONENTS.find((c) => c.id === selected) ?? null;

  return (
    <section id="mechanism" className="relative py-28 lg:py-36">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.12]" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-cyan">
            [ 02 — MECHANISM ]
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Inside the ResQBot chassis
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            A conceptual breakdown of ResQBot's core subsystems. Select a
            component to learn its role in the rover's operation.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <RobotVisual
              mode="interactive"
              selectedId={selected}
              onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
              className="max-w-lg"
            />
          </motion.div>

          <div className="flex flex-col gap-3">
            {MECHANISM_COMPONENTS.map((c, i) => {
              const offset = assemblyOffsets[i % assemblyOffsets.length];
              const isActive = selected === c.id;
              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, x: offset.x, y: offset.y }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, margin: "-10%" }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setSelected((cur) => (cur === c.id ? null : c.id))}
                  aria-pressed={isActive}
                  className={`flex items-center justify-between border px-5 py-4 text-left transition-all duration-300 ${
                    isActive
                      ? "border-cyan/60 bg-cyan/5"
                      : "border-line/10 hover:border-line/25 hover:bg-white/[0.03]"
                  }`}
                >
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.2em] text-muted">
                      {c.short.toUpperCase()}
                    </p>
                    <p
                      className={`mt-1 font-display text-lg font-medium ${
                        isActive ? "text-cyan" : "text-paper"
                      }`}
                    >
                      {c.label}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-lg transition-transform duration-300 ${
                      isActive ? "rotate-45 text-cyan" : "text-muted"
                    }`}
                    aria-hidden
                  >
                    +
                  </span>
                </motion.button>
              );
            })}

            <div className="mt-2 min-h-[92px] border border-dashed border-line/15 px-5 py-4">
              <AnimatePresence mode="wait">
                {active ? (
                  <motion.p
                    key={active.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm leading-relaxed text-muted"
                  >
                    <span className="text-cyan">{active.label}.</span>{" "}
                    {active.description}
                  </motion.p>
                ) : (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="font-mono text-xs tracking-widest text-muted/60"
                  >
                    SELECT A COMPONENT TO VIEW DETAILS
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
