import { motion } from "framer-motion";

const PANELS = [
  {
    title: "Open Questions",
    items: [
      "How reliable is smartphone-to-ESP32 latency over a typical Wi-Fi link?",
      "How repeatable is the foam-ball launch trajectory across attempts?",
      "What payload weight and range keep the platform stable?",
    ],
  },
  {
    title: "Limitations",
    items: [
      "ResQBot has not been tested against real fires and carries no certified fire-suppression capability; its current payload is a foam ball used for safe, repeatable research trials.",
      "The platform is not rated or verified for deployment in extreme or hazardous real-world environments.",
      "Operating range is bounded by Wi-Fi signal strength between phone and rover.",
    ],
  },
  {
    title: "Future Development",
    items: [
      "Closed-loop aiming using camera or sensor feedback before launch.",
      "Evaluating certified fire-suppression payload options for future, verified field trials.",
      "A secure gateway architecture for real-time telemetry from the rover.",
    ],
  },
];

export function Research() {
  return (
    <section id="research" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mb-4 font-mono text-xs tracking-[0.25em] text-orange"
        >
          [ 06 — RESEARCH & MOTIVATION ]
        </motion.p>

        <motion.blockquote
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="border-l-2 border-cyan/50 pl-6 font-display text-2xl font-medium leading-snug tracking-tight text-paper sm:text-3xl lg:text-4xl"
        >
          Response robotics doesn't need to be dangerous to be worth
          studying — it needs to be understandable.
        </motion.blockquote>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7 }}
            className="text-base leading-relaxed text-muted"
          >
            Many remote-response concepts — search-and-approach behavior,
            payload handling, tele-operation over wireless links — are
            usually explored on expensive or hazardous platforms. ResQBot
            asks a narrower question: how much of that behavior can be
            explored safely, on a small scale, with commodity hardware and
            a smartphone as the control surface?
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-base leading-relaxed text-muted"
          >
            The project deliberately favors clarity over complexity. Every
            mechanism is exposed rather than hidden, every control signal
            traceable from smartphone to motor. The foam-ball payload
            stands in for a certified fire-response payload, keeping the
            focus on the robotics — motion, coordination, and control —
            rather than on the payload itself.
          </motion.p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PANELS.map((panel, i) => (
            <motion.div
              key={panel.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="border border-line/10 p-6"
            >
              <p className="mb-4 font-mono text-[11px] tracking-[0.2em] text-cyan">
                {panel.title.toUpperCase()}
              </p>
              <ul className="space-y-3">
                {panel.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-line/30" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
