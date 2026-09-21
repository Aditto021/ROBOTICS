import { motion, useMotionValue, useSpring } from "framer-motion";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd"
>;

interface MagneticButtonProps extends NativeButtonProps {
  children: ReactNode;
  variant?: "primary" | "ghost";
}

export function MagneticButton({
  children,
  variant = "primary",
  className = "",
  ...rest
}: MagneticButtonProps) {
  const reduced = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 16, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 200, damping: 16, mass: 0.4 });

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.3);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.3);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const base =
    "group relative inline-flex items-center justify-center gap-2 overflow-hidden px-7 py-3.5 font-display text-sm font-medium tracking-wide transition-colors duration-300 focus-visible:outline-offset-4";

  const variants: Record<string, string> = {
    primary: "bg-cyan text-void hover:bg-white",
    ghost: "border border-white/25 text-paper hover:border-cyan/60 hover:text-cyan",
  };

  return (
    <motion.button
      {...rest}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`${base} ${variants[variant]} ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <span className="relative">{children}</span>
    </motion.button>
  );
}
