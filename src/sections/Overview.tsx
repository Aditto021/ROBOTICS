import { motion } from "framer-motion";

const FACTS = [
  {
    label: "PLATFORM",
    value: "Wheeled Rover",
    detail: "A ground-based chassis built for controlled indoor and outdoor demonstrations.",
  },
  {
    label: "CONTROL",
    value: "Smartphone Link",
    detail: "Operated remotely over a wireless connection — no dedicated hardware controller required.",
  },
  {
    label: "PURPOSE",
    value: "Concept Demonstration",
    detail: "Built to showcase remote payload handling and launch mechanics in a safe, repeatable setting.",
  },
];

export function Overview() {
  return (
    <section id="overview" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, x: -48 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7"
          >
            <p className="mb-4 font-mono text-xs tracking-[0.25em] text-orange">
              [ 01 — OVERVIEW ]
            </p>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              A rover built to explore
              <br />
              remote-operated response.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              ResQBot began as an exercise in remote robotics: how far can a
              lightweight, smartphone-controlled rover go in demonstrating
              the fundamentals of tele-operated movement and payload
              handling? The result is a compact platform that pairs simple
              mechanical design with real-time wireless control.
            </p>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
              Every subsystem — drive, control, and payload mechanism — is
              built to be understood at a glance, making ResQBot as much a
              teaching platform as it is a working prototype.
            </p>
          </motion.div>

          <div className="flex flex-col gap-6 lg:col-span-5">
            {FACTS.map((fact, i) => (
              <motion.div
                key={fact.label}
                initial={{ opacity: 0, x: 48 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-15%" }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="border-l-2 border-white/10 pl-6 transition-colors hover:border-cyan/50"
              >
                <p className="font-mono text-[11px] tracking-[0.2em] text-muted">
                  {fact.label}
                </p>
                <p className="mt-1.5 font-display text-xl font-medium text-paper">
                  {fact.value}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {fact.detail}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
