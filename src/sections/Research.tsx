import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { LiteratureTab } from "../components/LiteratureTab";
import { LITERATURE_REVIEWS } from "../data/literature";
import { COMPARISON_COLUMNS, COMPARISON_ROWS } from "../data/comparison";

function ComparisonTable() {
  const literature = COMPARISON_ROWS.filter((r) => !r.ours);
  const ours = COMPARISON_ROWS.find((r) => r.ours);
  const unique = COMPARISON_COLUMNS.map((_, c) => Boolean(ours?.marks[c]) && literature.every((r) => !r.marks[c]));

  // Consecutive columns that share a group become one spanning header cell.
  const groups = COMPARISON_COLUMNS.reduce<{ label: string; span: number }[]>((acc, c) => {
    const last = acc[acc.length - 1];
    if (last && last.label === c.group) last.span += 1;
    else acc.push({ label: c.group, span: 1 });
    return acc;
  }, []);
  const groupStart = new Set(
    groups.slice(1).map((_, g) => groups.slice(0, g + 1).reduce((n, x) => n + x.span, 0)),
  );
  const sep = (i: number) => (groupStart.has(i) ? "border-l border-line/15" : "");
  const stickyCell = "sticky left-0 z-10 bg-void";

  return (
    <div className="overflow-x-auto xl:-mx-28">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${stickyCell} p-2`} aria-hidden />
            {groups.map((g, gi) => (
              <th
                key={g.label}
                colSpan={g.span}
                scope="colgroup"
                className={`px-2 pb-1 pt-2 text-center font-mono text-[10px] font-medium tracking-[0.2em] text-paper/80 ${gi > 0 ? "border-l border-line/15" : ""}`}
              >
                <span className="block border-b border-line/20 pb-1.5">{g.label.toUpperCase()}</span>
              </th>
            ))}
          </tr>
          <tr className="border-b border-line/20">
            <th scope="col" className={`${stickyCell} p-2 align-bottom font-mono text-[10px] font-medium tracking-[0.15em] text-muted`}>
              ROBOT
            </th>
            {COMPARISON_COLUMNS.map((c, i) => (
              <th
                key={c.label}
                scope="col"
                className={`w-[76px] p-2 text-center align-bottom font-mono text-[10px] font-medium leading-tight tracking-[0.06em] ${unique[i] ? "text-cyan" : "text-muted"} ${sep(i)}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr
              key={row.name}
              className={row.ours ? "border-t-2 border-cyan font-semibold" : "border-t border-line/10"}
            >
              <th
                scope="row"
                className={`${stickyCell} min-w-[170px] max-w-[220px] p-2 text-xs font-normal ${row.ours ? "font-semibold text-paper" : "text-muted"}`}
              >
                {row.name}
              </th>
              {row.marks.map((m, i) => (
                <td
                  key={COMPARISON_COLUMNS[i].label}
                  className={`p-2 text-center text-sm ${row.ours && unique[i] ? "bg-cyan/15" : ""} ${sep(i)}`}
                >
                  {row.planned?.includes(i) ? (
                    <span className="text-cyan" aria-label="planned">◐</span>
                  ) : (
                    <span className={m ? "text-cyan" : "text-muted/50"} aria-label={m ? "yes" : "no"}>
                      {m ? "✓" : "✗"}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PROBLEM = [
  "Responders need to reach areas that are dangerous for people.",
  "Rescue robots are costly or hazardous to research, so students have few safe platforms.",
  "Operator workload and automation failure remain open problems in the literature.",
  "Dhaka's fire service is understaffed, with reported firefighter ratios far below international norms, and traffic often delays arrival beyond its 10-minute target.",
  "Dense old-city fires are deadly: the February 2019 Chawkbazar fire killed at least 70 people and took about 15 hours to bring under control, in lanes fire engines struggled to reach.",
];

const OBJECTIVES = [
  "A smartphone-controlled rover that completes load, store, feed, and launch.",
  "Every subsystem separable and every control signal traceable.",
  "Commodity hardware: ESP32 and standard motor drivers.",
];

const RESEARCH_QUESTIONS = [
  "How reliable is smartphone-to-ESP32 latency over Wi-Fi?",
  "How repeatable is the foam-ball launch trajectory?",
  "What payload weight and range keep the platform stable?",
];

const PIPELINE = [
  "Smartphone",
  "Wireless",
  "ESP32",
  "Motor drivers",
  "Movement",
  "Loading",
  "Storage",
  "Feeding",
  "Launch",
];

const LIMITATIONS = [
  "Not tested on real fires; foam ball only, no fire suppression.",
  "Not rated for hazardous or extreme environments.",
  "Range limited by Wi-Fi signal strength.",
];

const FUTURE_WORK = [
  "Closed-loop aiming with camera or sensor feedback.",
  "Certified payload options for verified field trials.",
  "Secure telemetry gateway for the rover.",
];

function Block({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.7 }}
      className="mt-16"
    >
      <h3 className="mb-5 flex items-baseline gap-4 border-b border-line/10 pb-3 font-display text-xl font-medium tracking-tight text-paper">
        <span className="font-mono text-xs tracking-[0.2em] text-cyan">{n}</span>
        {title}
      </h3>
      {children}
    </motion.section>
  );
}

function Bullets({ items, marker = "dot" }: { items: string[]; marker?: "dot" | "rq" }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted">
          {marker === "dot" ? (
            <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-line/30" aria-hidden />
          ) : (
            <span className="shrink-0 font-mono text-[11px] tracking-[0.15em] text-cyan">RQ{i + 1}</span>
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Research() {
  return (
    <section id="research" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mb-4 font-mono text-xs tracking-[0.25em] text-orange"
        >
          [ 07 — RESEARCH ]
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8 }}
          className="font-display text-3xl font-medium leading-tight tracking-tight text-paper sm:text-4xl"
        >
          ResQBot: Scout, Sense and Deliver – An Edge-AI Teleoperated Rover for Fire and Collapse Sites
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-6 space-y-1 text-sm text-muted"
        >
          <p>Tanvir Ahmed Aditto, Mohammad Abrar Akhtar Aman, Kazi Ismat Nahar Epthi, Afsana Anjum, Sanjida Akter Jui</p>
          <p className="font-mono text-[11px] tracking-[0.15em]">INDEPENDENT UNIVERSITY, BANGLADESH · CSE</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7 }}
          className="mt-10 border border-cyan/30 p-6"
        >
          <p className="mb-3 font-mono text-[11px] tracking-[0.2em] text-cyan">ABSTRACT</p>
          <p className="text-sm leading-relaxed text-muted">
            ResQBot is a small rover that a smartphone drives to a target, where a servo gate feeds a hand-loaded
            foam ball from its camera tower into a flywheel launcher. The foam ball stands in for a certified fire-response payload, so the
            study focuses on control and motion rather than suppression.
          </p>
        </motion.div>

        <Block n="01" title="Problem">
          <Bullets items={PROBLEM} />
        </Block>

        <Block n="02" title="Objectives">
          <Bullets items={OBJECTIVES} />
        </Block>

        <Block n="03" title="Research Questions">
          <Bullets items={RESEARCH_QUESTIONS} marker="rq" />
        </Block>

        <Block n="04" title="Method">
          <p className="mb-5 text-sm leading-relaxed text-muted">Nine-stage command pipeline:</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 font-mono text-[11px] tracking-[0.12em] text-paper">
            {PIPELINE.map((stage, i) => (
              <span key={stage} className="flex items-center gap-2">
                <span className="border border-line/15 px-2 py-1">{stage}</span>
                {i < PIPELINE.length - 1 && <span className="text-cyan" aria-hidden>→</span>}
              </span>
            ))}
          </div>
        </Block>

        <Block n="05" title="Literature Review">
          <div className="space-y-0">
            {LITERATURE_REVIEWS.map((review, i) => (
              <LiteratureTab key={review.owner} review={review} index={i} />
            ))}
          </div>
        </Block>

        <Block n="06" title="Comparison with Literature">
          <p className="mb-5 text-sm leading-relaxed text-muted">
            Compared against the five most complete robots in the literature review, chosen for sensing,
            actuation, and control. ✓ = reported in the paper (for ResQBot: built into the prototype), ✗ = not
            reported. Highlighted columns are features ResQBot has that none of the five have: AI hazard
            detection, sonar auto-stop, and the full load, store, feed, and launch payload chain.
          </p>
          <ComparisonTable />
        </Block>

        <Block n="07" title="Results">
          <p className="text-sm leading-relaxed text-muted">Trials pending. No measured results yet.</p>
        </Block>

        <Block n="08" title="Limitations">
          <Bullets items={LIMITATIONS} />
        </Block>

        <Block n="09" title="Future Work">
          <Bullets items={FUTURE_WORK} />
        </Block>
      </div>
    </section>
  );
}
