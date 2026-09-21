import { motion } from "framer-motion";
import { TEAM_MEMBERS } from "../data/team";

export function Team() {
  return (
    <section id="team" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-cyan">
            [ 07 — TEAM ]
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            The people behind ResQBot
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM_MEMBERS.map((member, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="group relative overflow-hidden border border-white/10 p-6 transition-colors duration-300 hover:border-cyan/40"
            >
              <div
                className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(200px circle at 30% 20%, rgba(43,227,255,0.08), transparent 70%)",
                }}
              />
              <div className="mb-5 flex h-12 w-12 items-center justify-center border border-white/15 font-mono text-sm text-muted transition-colors duration-300 group-hover:border-cyan/50 group-hover:text-cyan">
                {String(i + 1).padStart(2, "0")}
              </div>
              <p className="font-display text-lg font-medium text-paper">
                {member.name}
              </p>
              <p className="mt-1 font-mono text-xs tracking-wide text-muted">
                {member.role}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
