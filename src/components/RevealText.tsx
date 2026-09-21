import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

interface RevealTextProps {
  lines: ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
}

export function RevealText({
  lines,
  className,
  lineClassName,
  delay = 0,
  stagger = 0.12,
}: RevealTextProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className={className}>
      {lines.map((line, i) => (
        <div key={i} className="overflow-hidden">
          <motion.div
            className={lineClassName}
            initial={reduced ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            whileInView={reduced ? { opacity: 1 } : { y: "0%", opacity: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{
              duration: reduced ? 0.4 : 0.8,
              delay: delay + i * stagger,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {line}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
