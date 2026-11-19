import { useState } from "react";
import { motion } from "framer-motion";
import { ARCHITECTURE_NODES } from "../data/architecture";

const CIRCUIT_SRC = "/circuit/resqbot-circuit.svg";

const CIRCUIT_NOTES = [
  "Net labels join pins: every pin stub with the same name (ENA, TRIG, LINK_TX …) is one wire.",
  "The 5 V sonar ECHO and MQ-2 AO outputs pass through 1 kΩ/2 kΩ and 10 kΩ/20 kΩ dividers before the 3.3 V GPIO 35 and GPIO 34 inputs.",
  "GPIO 26 drives an NPN transistor that pulls the low-level relay input down, so HIGH switches the flywheel motor on.",
  "The ESP32-CAM has its own 5 V, 2 A feed; all grounds are shared.",
];

function CircuitDiagram() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.7 }}
      className="mt-24"
    >
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <h3 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Circuit diagram</h3>
        <p className="mt-4 text-base leading-relaxed text-muted">
          The main ESP32 controller and every part wired to it, drawn from the tested pin map in the firmware.
        </p>
      </div>

      <figure className="border border-line/15 p-3 sm:p-5">
        <div className="overflow-x-auto">
          <img
            src={CIRCUIT_SRC}
            alt="ResQBot circuit schematic: ESP32 DevKit connected to an L298N motor driver with two motor pairs, an ESP32-CAM over UART, an HC-SR04 sonar and MQ-2 gas sensor through resistor dividers, a DHT11, a gate servo, a passive buzzer, an NPN-driven relay module switching the flywheel motor, and a 3S battery with switch and buck converter."
            width={1309}
            height={964}
            loading="lazy"
            className="mx-auto block h-auto w-full min-w-[720px] invert light:invert-0"
          />
        </div>
        <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/10 pt-3 font-mono text-[11px] tracking-[0.12em] text-muted">
          <span>FIG. — RESQBOT MAIN CONTROLLER SCHEMATIC</span>
          <a href={CIRCUIT_SRC} target="_blank" rel="noreferrer" className="text-cyan hover:underline">
            OPEN FULL SIZE ↗
          </a>
        </figcaption>
      </figure>

      <ul className="mx-auto mt-8 max-w-3xl space-y-3">
        {CIRCUIT_NOTES.map((note) => (
          <li key={note} className="flex gap-3 text-sm leading-relaxed text-muted">
            <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-cyan/70" aria-hidden />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function Architecture() {
  const [active, setActive] = useState<string | null>(ARCHITECTURE_NODES[0].id);

  return (
    <section id="architecture" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-orange">
            [ 03 — SYSTEM ARCHITECTURE ]
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            The command signal path
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            A single command travels through every stage from smartphone to
            payload delivery. Hover or focus a stage to see its role.
          </p>
        </motion.div>

        <div className="relative mx-auto flex max-w-xl flex-col">
          {ARCHITECTURE_NODES.map((node, i) => {
            const isActive = active === node.id;
            const isLast = i === ARCHITECTURE_NODES.length - 1;
            return (
              <div key={node.id} className="relative">
                <motion.button
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-10%" }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  onMouseEnter={() => setActive(node.id)}
                  onFocus={() => setActive(node.id)}
                  onClick={() => setActive(node.id)}
                  className={`relative z-10 flex w-full items-center gap-5 border px-6 py-5 text-left transition-all duration-300 ${
                    isActive
                      ? "border-cyan/60 bg-cyan/[0.06]"
                      : "border-line/10 bg-void hover:border-line/25"
                  }`}
                >
                  <span
                    className={`font-mono text-sm tracking-widest ${
                      isActive ? "text-cyan" : "text-muted"
                    }`}
                  >
                    {node.index}
                  </span>
                  <div className="flex-1">
                    <p
                      className={`font-display text-lg font-medium sm:text-xl ${
                        isActive ? "text-paper" : "text-paper/80"
                      }`}
                    >
                      {node.title}
                    </p>
                    <motion.p
                      initial={false}
                      animate={{
                        height: isActive ? "auto" : 0,
                        opacity: isActive ? 1 : 0,
                        marginTop: isActive ? 6 : 0,
                      }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden text-sm leading-relaxed text-muted"
                    >
                      {node.description}
                    </motion.p>
                  </div>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-300 ${
                      isActive ? "bg-cyan" : "bg-line/20"
                    }`}
                    aria-hidden
                  />
                </motion.button>

                {!isLast && (
                  <div className="relative mx-6 h-10 w-px overflow-hidden">
                    <div className="absolute inset-0 bg-line/10" />
                    <svg
                      className="absolute inset-0 h-full w-full"
                      preserveAspectRatio="none"
                      viewBox="0 0 2 40"
                    >
                      <line
                        x1="1" y1="0" x2="1" y2="40"
                        stroke="var(--color-cyan)"
                        strokeWidth="2"
                        strokeDasharray="4 6"
                        className="animate-flow"
                        opacity={isActive || active === ARCHITECTURE_NODES[i + 1]?.id ? 0.9 : 0.3}
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <CircuitDiagram />
      </div>
    </section>
  );
}
