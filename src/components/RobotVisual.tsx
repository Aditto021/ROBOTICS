import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { MECHANISM_COMPONENTS } from "../data/mechanism";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

interface RobotVisualProps {
  mode?: "hero" | "interactive";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

export function RobotVisual({
  mode = "hero",
  selectedId = null,
  onSelect,
  className = "",
}: RobotVisualProps) {
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const activeId = mode === "interactive" ? selectedId ?? hovered : hovered;

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 120, damping: 18 });
  const springRotateY = useSpring(rotateY, { stiffness: 120, damping: 18 });
  const ringOffset = useTransform(springRotateY, (v) => v * 1.2);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || mode !== "hero") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 10);
    rotateX.set(py * -10);
  };

  const handlePointerLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  const isHighlighted = (id: string) => activeId === id;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative aspect-square w-full select-none light:rounded-3xl light:border light:border-black/10 light:bg-white light:p-4 light:robot-panel-shadow ${className}`}
      style={{ perspective: 1000 }}
    >
      <motion.div
        data-theme="dark"
        className="relative h-full w-full"
        style={
          reduced
            ? undefined
            : { rotateX: springRotateX, rotateY: springRotateY, transformStyle: "preserve-3d" }
        }
      >
        {/* scanning rings */}
        <motion.div
          aria-hidden
          className="absolute inset-[4%] rounded-full border border-cyan/20"
          style={reduced ? undefined : { rotate: ringOffset }}
        />
        <div
          aria-hidden
          className="absolute inset-[10%] rounded-full border border-dashed border-orange/25 animate-spin-slow"
        />
        <div
          aria-hidden
          className="absolute inset-[18%] rounded-full border border-cyan/15 animate-spin-reverse-slow"
        />

        {/* radial glow */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(43,227,255,0.10), transparent 60%)",
          }}
        />

        {/* main SVG illustration */}
        <svg
          viewBox="0 0 640 520"
          className="absolute inset-0 h-full w-full drop-shadow-[0_0_40px_rgba(43,227,255,0.08)]"
          role="img"
          aria-label="Schematic illustration of the ResQBot rover"
        >
          <defs>
            <linearGradient id="chassisFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a1f28" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#12161d" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* ground plane */}
          <line
            x1="70" y1="392" x2="570" y2="392"
            stroke="#8a94a3" strokeOpacity="0.25" strokeDasharray="2 6"
          />

          {/* corner brackets */}
          {[
            [70, 40, 1, 1],
            [570, 40, -1, 1],
            [70, 470, 1, -1],
            [570, 470, -1, -1],
          ].map(([x, y, dx, dy], i) => (
            <g key={i} stroke="#2be3ff" strokeOpacity="0.35" strokeWidth="1.5">
              <line x1={x as number} y1={y as number} x2={(x as number) + 22 * (dx as number)} y2={y as number} />
              <line x1={x as number} y1={y as number} x2={x as number} y2={(y as number) + 22 * (dy as number)} />
            </g>
          ))}

          {/* antenna / wireless node */}
          <g
            opacity={activeId && activeId !== "esp32" && activeId !== "power" ? 1 : 0.9}
          >
            <line x1="420" y1="212" x2="446" y2="150" stroke="#8a94a3" strokeWidth="2" />
            <circle cx="448" cy="142" r="7" fill="none" stroke="#2be3ff" strokeWidth="2" />
            <circle cx="448" cy="142" r="2.5" fill="#2be3ff" className="animate-pulse-slow" />
          </g>

          {/* payload arm + foam ball (payload mechanism) */}
          <g
            style={{ transition: "opacity 300ms" }}
            opacity={!activeId || isHighlighted("payload") || isHighlighted("foam") ? 1 : 0.35}
          >
            <path
              d="M 350 214 L 388 160 L 420 150"
              fill="none"
              stroke={isHighlighted("payload") ? "#ff7a29" : "#8a94a3"}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 405 145 q 15 -8 26 4"
              fill="none"
              stroke={isHighlighted("payload") ? "#ff7a29" : "#8a94a3"}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>

          {/* foam ball */}
          <g opacity={!activeId || isHighlighted("foam") ? 1 : 0.35}>
            <circle
              cx="440"
              cy="118"
              r="15"
              fill="none"
              stroke={isHighlighted("foam") ? "#ff7a29" : "#eef2f6"}
              strokeWidth="2.5"
              strokeDasharray="4 3"
            />
          </g>

          {/* chassis body */}
          <g opacity={!activeId || ["esp32", "power"].includes(activeId) ? 1 : 0.45}>
            <rect
              x="160" y="212" width="300" height="106" rx="16"
              fill="url(#chassisFill)"
              stroke={isHighlighted("esp32") || isHighlighted("power") ? "#2be3ff" : "#8a94a3"}
              strokeOpacity={isHighlighted("esp32") || isHighlighted("power") ? 1 : 0.5}
              strokeWidth="2"
            />
          </g>

          {/* ESP32 control unit */}
          <g opacity={!activeId || isHighlighted("esp32") ? 1 : 0.3}>
            <rect
              x="288" y="243" width="64" height="42" rx="4"
              fill="none"
              stroke={isHighlighted("esp32") ? "#2be3ff" : "#8a94a3"}
              strokeWidth="2"
            />
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1={296 + i * 14} y1="243" x2={296 + i * 14} y2="235"
                stroke={isHighlighted("esp32") ? "#2be3ff" : "#8a94a3"}
                strokeWidth="1.5"
              />
            ))}
          </g>

          {/* power system (battery) */}
          <g opacity={!activeId || isHighlighted("power") ? 1 : 0.3}>
            <rect
              x="188" y="252" width="46" height="30" rx="3"
              fill="none"
              stroke={isHighlighted("power") ? "#ff7a29" : "#8a94a3"}
              strokeWidth="2"
            />
            <line x1="234" y1="262" x2="240" y2="262" stroke={isHighlighted("power") ? "#ff7a29" : "#8a94a3"} strokeWidth="3" />
            <line x1="234" y1="272" x2="240" y2="272" stroke={isHighlighted("power") ? "#ff7a29" : "#8a94a3"} strokeWidth="3" />
          </g>

          {/* wheels / drive motors */}
          <g opacity={!activeId || isHighlighted("motors") ? 1 : 0.35}>
            {[210, 410].map((cx) => (
              <g key={cx}>
                <circle
                  cx={cx} cy="348" r="40"
                  fill="#0a0d12"
                  stroke={isHighlighted("motors") ? "#ff7a29" : "#8a94a3"}
                  strokeWidth="2.5"
                />
                <circle cx={cx} cy="348" r="13" fill="none" stroke="#2be3ff" strokeOpacity="0.6" strokeWidth="2" />
                {[0, 60, 120].map((deg) => (
                  <line
                    key={deg}
                    x1={cx} y1="308" x2={cx} y2="318"
                    stroke={isHighlighted("motors") ? "#ff7a29" : "#8a94a3"}
                    strokeWidth="2"
                    transform={`rotate(${deg} ${cx} 348)`}
                  />
                ))}
              </g>
            ))}
          </g>
        </svg>

        {/* hotspots */}
        {MECHANISM_COMPONENTS.map((c) => {
          const active = activeId === c.id;
          return (
            <div
              key={c.id}
              className="absolute"
              style={{ left: `${c.x}%`, top: `${c.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <button
                type="button"
                onMouseEnter={() => setHovered(c.id)}
                onMouseLeave={() => setHovered((h) => (h === c.id ? null : h))}
                onFocus={() => setHovered(c.id)}
                onBlur={() => setHovered((h) => (h === c.id ? null : h))}
                onClick={() => onSelect?.(c.id)}
                aria-label={c.label}
                aria-pressed={mode === "interactive" ? selectedId === c.id : undefined}
                className="group relative flex h-4 w-4 items-center justify-center"
              >
                <span
                  className={`absolute h-full w-full rounded-full border transition-all duration-300 ${
                    active ? "border-cyan scale-150" : "border-line/30"
                  }`}
                />
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                    active ? "bg-cyan" : "bg-line/60"
                  } ${!active ? "animate-pulse-slow" : ""}`}
                />

                <span
                  className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-none border px-2.5 py-1 font-mono text-[10px] tracking-wider transition-all duration-200 ${
                    active
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-1"
                  } ${c.y < 50 ? "bottom-6" : "top-6"} left-1/2 -translate-x-1/2 border-cyan/40 bg-void/90 text-cyan backdrop-blur-sm`}
                >
                  {c.label}
                </span>
              </button>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
