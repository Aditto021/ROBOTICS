import { useState } from "react";
import { motion } from "framer-motion";
import { TEAM_MEMBERS, type SocialLinks } from "../data/team";
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

type SocialKey = keyof SocialLinks;
const SOCIAL_PLATFORMS: { key: SocialKey; label: string }[] = [
  { key: "github", label: "GitHub" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "researchgate", label: "ResearchGate" },
];

function SocialIcon({ platform }: { platform: SocialKey }) {
  switch (platform) {
    case "github":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 .5C5.73.5.98 5.24.98 11.52c0 5.02 3.26 9.28 7.77 10.78.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.16.69-3.83-1.36-3.83-1.36-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.65 1.24 3.3.95.1-.73.4-1.24.72-1.53-2.52-.29-5.17-1.26-5.17-5.6 0-1.24.44-2.25 1.17-3.05-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.16a10.9 10.9 0 0 1 5.72 0c2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.8 1.17 1.81 1.17 3.05 0 4.35-2.65 5.31-5.18 5.59.41.35.77 1.04.77 2.1 0 1.52-.01 2.74-.01 3.11 0 .3.2.66.79.55 4.5-1.5 7.76-5.76 7.76-10.78C23.02 5.24 18.27.5 12 .5Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M4.98 3.5a2.5 2.5 0 1 1-.02 5 2.5 2.5 0 0 1 .02-5ZM.5 21.5h9V9h-9v12.5ZM13.5 9h8.62v12.5h-9V15c0-1.66-.03-3.79-2.31-3.79-2.31 0-2.66 1.8-2.66 3.67v6.62h-9V9h8.65v1.71h.12c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.81 2.65 4.81 6.1V9Z" />
        </svg>
      );
    case "researchgate":
      return <span className="font-mono text-[9px] font-bold leading-none">RG</span>;
  }
}

function SocialRow({ social }: { social: SocialLinks }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      {SOCIAL_PLATFORMS.map(({ key, label }) => {
        const url = social[key];
        return url ? (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${label} profile`}
            className="flex h-8 w-8 items-center justify-center border border-line/15 text-muted transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            <SocialIcon platform={key} />
          </a>
        ) : (
          <span
            key={key}
            aria-label={`${label} profile — link coming soon`}
            title="Link coming soon"
            className="flex h-8 w-8 cursor-not-allowed items-center justify-center border border-line/10 text-muted/30"
          >
            <SocialIcon platform={key} />
          </span>
        );
      })}
    </div>
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
                <PersonPhoto src={member.photo} name={member.name} className="mb-5 h-16 w-16 rounded-full text-lg" />
              ) : (
                <div className="mb-5 flex h-12 w-12 items-center justify-center border border-line/15 font-mono text-sm text-muted transition-colors duration-300 group-hover:border-cyan/50 group-hover:text-cyan">
                  {String(i + 1).padStart(2, "0")}
                </div>
              )}

              <p className="font-display text-lg font-medium text-paper">
                {member.name}
                {member.studentId && (
                  <span className="font-mono text-sm font-normal text-muted">
                    , ID: {member.studentId}
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-xs tracking-wide text-muted">
                {member.role}
              </p>
              {member.bio && (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {member.bio}
                </p>
              )}
              {member.social && <SocialRow social={member.social} />}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
