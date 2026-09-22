import { useState } from "react";
import { motion } from "framer-motion";
import { TEAM_MEMBERS } from "../data/team";
import { SUPERVISOR } from "../data/supervisor";
import { ComingSoonBadge } from "../components/ComingSoon";

function initialsOf(name: string): string {
  return name
    .split(/[\s,]+/)
    .filter((w) => w && w[0] === w[0].toUpperCase() && /[A-Za-z]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function PersonPhoto({
  src,
  name,
  className = "",
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = initialsOf(name);

  if (failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center border border-cyan/30 bg-cyan/5 font-display font-semibold text-cyan ${className}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={`shrink-0 border border-line/15 object-cover ${className}`}
    />
  );
}

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

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7 }}
          className="mb-8"
        >
          <span className="inline-block border border-cyan/40 bg-cyan/5 px-4 py-2 font-mono text-xs tracking-[0.2em] text-cyan">
            RESEARCH SUPERVISOR
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="glass-panel mb-20 flex flex-col gap-6 border border-line/10 p-6 sm:flex-row sm:gap-8 sm:p-8"
        >
          <PersonPhoto src={SUPERVISOR.photo} name={SUPERVISOR.name} className="h-40 w-40 text-3xl sm:h-48 sm:w-48" />

          <div className="flex flex-1 flex-col">
            <h3 className="font-display text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
              {SUPERVISOR.name.toUpperCase()}
            </h3>

            <div className="mt-3 space-y-1">
              {SUPERVISOR.titles.map((title) => (
                <p key={title} className="text-sm leading-relaxed text-muted">
                  {title}
                </p>
              ))}
            </div>

            <a
              href={`mailto:${SUPERVISOR.email}`}
              className="mt-3 inline-block w-fit font-mono text-sm text-cyan transition-colors hover:text-paper"
            >
              {SUPERVISOR.email}
            </a>

            <p className="mt-3 text-sm leading-relaxed text-muted">
              <span className="text-paper">Research Area:</span>{" "}
              {SUPERVISOR.researchArea}
            </p>

            <div className="mt-5">
              {SUPERVISOR.profileUrl ? (
                <a
                  href={SUPERVISOR.profileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex border border-cyan/50 px-5 py-2.5 font-mono text-xs tracking-widest text-cyan transition-colors hover:bg-cyan/10"
                >
                  EXPLORE MORE
                </a>
              ) : (
                <ComingSoonBadge label="EXPLORE MORE" />
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM_MEMBERS.map((member, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="group relative overflow-hidden border border-line/10 p-6 transition-colors duration-300 hover:border-cyan/40"
            >
              <div
                className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(200px circle at 30% 20%, var(--glow-cyan), transparent 70%)",
                }}
              />

              {member.photo ? (
                <PersonPhoto src={member.photo} name={member.name} className="mb-5 h-16 w-16 text-lg" />
              ) : (
                <div className="mb-5 flex h-12 w-12 items-center justify-center border border-line/15 font-mono text-sm text-muted transition-colors duration-300 group-hover:border-cyan/50 group-hover:text-cyan">
                  {String(i + 1).padStart(2, "0")}
                </div>
              )}

              <p className="font-display text-lg font-medium text-paper">
                {member.name}
              </p>
              <p className="mt-1 font-mono text-xs tracking-wide text-muted">
                {member.role}
              </p>
              {member.studentId && (
                <p className="mt-1 font-mono text-[11px] tracking-wide text-muted/70">
                  ID: {member.studentId}
                </p>
              )}
              {member.bio && (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {member.bio}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
