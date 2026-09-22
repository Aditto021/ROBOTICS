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
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      );
    case "linkedin":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "researchgate":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M19.586 0c-.818 0-1.508.19-2.073.565-.563.377-.97.936-1.213 1.68a3.193 3.193 0 0 0-.112.437 8.365 8.365 0 0 0-.078.53 9 9 0 0 0-.05.727c-.01.282-.013.621-.013 1.016a31.121 31.123 0 0 0 .014 1.017 9 9 0 0 0 .05.727 7.946 7.946 0 0 0 .077.53h-.005a3.334 3.334 0 0 0 .113.438c.245.743.65 1.303 1.214 1.68.565.376 1.256.564 2.075.564.8 0 1.536-.213 2.105-.603.57-.39.94-.916 1.175-1.65.076-.235.135-.558.177-.93a10.9 10.9 0 0 0 .043-1.207v-.82c0-.095-.047-.142-.14-.142h-3.064c-.094 0-.14.047-.14.141v.956c0 .094.046.14.14.14h1.666c.056 0 .084.03.084.086 0 .36 0 .62-.036.865-.038.244-.1.447-.147.606-.108.385-.348.664-.638.876-.29.212-.738.35-1.227.35-.545 0-.901-.15-1.21-.353-.306-.203-.517-.454-.67-.915a3.136 3.136 0 0 1-.147-.762 17.366 17.367 0 0 1-.034-.656c-.01-.26-.014-.572-.014-.939a26.401 26.403 0 0 1 .014-.938 15.821 15.822 0 0 1 .035-.656 3.19 3.19 0 0 1 .148-.76 1.89 1.89 0 0 1 .742-1.01c.344-.244.593-.352 1.137-.352.508 0 .815.096 1.144.303.33.207.528.492.764.925.047.094.111.118.198.07l1.044-.43c.075-.048.09-.115.042-.199a3.549 3.549 0 0 0-.466-.742 3 3 0 0 0-.679-.607 3.313 3.313 0 0 0-.903-.41A4.068 4.068 0 0 0 19.586 0zM8.217 5.836c-1.69 0-3.036.086-4.297.086-1.146 0-2.291 0-3.007-.029v.831l1.088.2c.744.144 1.174.488 1.174 2.264v11.288c0 1.777-.43 2.12-1.174 2.263l-1.088.2v.832c.773-.029 2.12-.086 3.465-.086 1.29 0 2.951.057 3.667.086v-.831l-1.49-.2c-.773-.115-1.174-.487-1.174-2.264v-4.784c.688.057 1.29.057 2.206.057 1.748 3.123 3.41 5.472 4.355 6.56.86 1.032 2.177 1.691 3.839 1.691.487 0 1.003-.086 1.318-.23v-.744c-1.031 0-2.063-.716-2.808-1.518-1.26-1.376-2.95-3.582-4.355-6.074 2.32-.545 4.04-2.722 4.04-4.9 0-3.208-2.492-4.698-5.758-4.698zm-.515 1.29c2.406 0 3.839 1.26 3.839 3.552 0 2.263-1.547 3.782-4.097 3.782-.974 0-1.404-.03-2.063-.086v-7.19c.66-.059 1.547-.059 2.32-.059z" />
        </svg>
      );
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
              </p>
              {member.studentId && (
                <p className="mt-0.5 font-mono text-xs tracking-wide text-muted">
                  ID: {member.studentId}
                </p>
              )}
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
