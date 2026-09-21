import { useState } from "react";
import { motion } from "framer-motion";
import { ARCHITECTURE_NODES } from "../data/architecture";

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
            A single command travels through five stages before it becomes
            motion. Hover or focus a stage to see its role.
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
      </div>
    </section>
  );
}
