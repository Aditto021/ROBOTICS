import { motion } from "framer-motion";
import { AI_FEATURES, AI_PIPELINE, AI_STATS } from "../data/ai";

export function AiVision() {
  return (
    <section id="ai" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-orange">
            [ 06 — AI MISSION CONTROL ]
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            A rover that sees and warns
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            An onboard ESP32-CAM streams live video and sensor readings to a
            laptop, where AI models analyse the scene and a one-screen
            dashboard shows the operator what the rover sees — fully offline.
          </p>
        </motion.div>

        {/* pipeline */}
        <motion.ol
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6 }}
          className="mb-14 flex flex-wrap items-center justify-center gap-x-3 gap-y-3"
          aria-label="AI data flow"
        >
          {AI_PIPELINE.map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              <span className="border border-cyan/40 bg-cyan/[0.06] px-4 py-2 font-mono text-xs tracking-wider text-paper">
                {step}
              </span>
              {i < AI_PIPELINE.length - 1 && (
                <span aria-hidden="true" className="font-mono text-cyan">
                  →
                </span>
              )}
            </li>
          ))}
        </motion.ol>

        {/* features */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FEATURES.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08 }}
              className="border border-line/10 bg-void p-6 transition-colors duration-300 hover:border-cyan/50"
            >
              <p className="font-mono text-[11px] tracking-[0.2em] text-cyan">
                {f.model.toUpperCase()}
              </p>
              <p className="mt-2 font-display text-xl font-medium text-paper">{f.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.description}</p>
            </motion.div>
          ))}
        </div>

        {/* stats */}
        <div className="mt-14 grid grid-cols-2 gap-6 border-y border-line/10 py-8 lg:grid-cols-4">
          {AI_STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-3xl font-semibold text-paper sm:text-4xl">{s.value}</p>
              <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-muted">
                {s.label.toUpperCase()}
              </p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-muted">
          The AI is a research aid that assists the operator. It flags possible
          fire, smoke, and hazards on camera, but it is not a certified fire or
          gas detector, and the payload does not extinguish fires.
        </p>
      </div>
    </section>
  );
}
