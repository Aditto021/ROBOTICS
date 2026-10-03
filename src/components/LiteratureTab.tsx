import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LiteratureReview } from "../data/literature";

interface LiteratureTabProps {
  review: LiteratureReview;
  index: number;
}

export function LiteratureTab({ review, index }: LiteratureTabProps) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const dur = (s: number) => (reduceMotion ? 0 : s);
  const panelId = `literature-panel-${index}`;

  return (
    <div className={index > 0 ? "mt-16" : undefined}>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.7 }}
        className="mb-8 font-mono text-xs tracking-[0.25em] text-cyan"
      >
        LITERATURE REVIEW — BY {review.owner.toUpperCase()}
      </motion.p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between border border-cyan/40 px-6 py-4 text-left font-mono text-xs tracking-[0.2em] text-paper transition-colors hover:bg-cyan/10"
      >
        <span>{open ? "HIDE PAPERS" : `VIEW ALL ${review.papers.length} PAPERS`}</span>
        <motion.svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 14 14"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: dur(0.35) }}
          className="text-cyan"
        >
          <path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: dur(0.5), ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ol className="space-y-4 pt-6">
              {review.papers.map((paper, i) => (
                <motion.li
                  key={paper.title}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur(0.4), delay: dur(0.15 + i * 0.07) }}
                  className="relative flex flex-col gap-4 overflow-hidden border border-line/10 p-6 sm:flex-row sm:items-start sm:justify-between"
                >
                  {paper.thumb && (
                    <>
                      <img
                        src={paper.thumb}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 h-full w-full object-cover object-top blur-[2px] light:brightness-[0.82]"
                      />
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-void from-35% via-void/70 to-transparent" />
                    </>
                  )}
                  <div className="relative min-w-0">
                    <p className="font-mono text-[11px] tracking-[0.2em] text-cyan">[{i + 1}]</p>
                    <p className="mt-2 font-display text-base font-medium leading-snug text-paper">{paper.title}</p>
                    {paper.authors && <p className="mt-1.5 text-sm leading-relaxed text-muted">{paper.authors}</p>}
                    <p className="mt-1 font-mono text-[11px] tracking-wide text-muted">{paper.venue}</p>
                  </div>
                  {paper.url ? (
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative shrink-0 self-start border border-cyan/40 px-4 py-2 font-mono text-[11px] tracking-[0.2em] text-cyan transition-colors hover:bg-cyan/10"
                    >
                      OPEN
                    </a>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="relative shrink-0 self-start border border-line/15 px-4 py-2 font-mono text-[11px] tracking-[0.2em] text-muted"
                    >
                      LINK PENDING
                    </span>
                  )}
                </motion.li>
              ))}
            </ol>

            <div className="mt-8 border border-cyan/30 p-6 sm:p-8">
              <p className="mb-4 font-mono text-[11px] tracking-[0.2em] text-cyan">COMBINED SUMMARY</p>
              <p className="text-sm leading-relaxed text-muted">{review.summary}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
