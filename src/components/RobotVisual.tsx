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

  const activeComponent = mode === "interactive" ? MECHANISM_COMPONENTS.find((c) => c.id === activeId) : undefined;
  const focusOrigin = activeComponent ? `${activeComponent.x}% ${activeComponent.y}%` : "50% 50%";
  const focusScale = activeComponent && !reduced ? 1.35 : 1;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative aspect-square w-full select-none overflow-hidden light:rounded-3xl light:border light:border-black/10 light:bg-white light:p-4 light:robot-panel-shadow ${className}`}
      style={{ perspective: 1000 }}
    >
      <motion.div
        data-theme="dark"
        className="relative h-full w-full"
        animate={{ scale: focusScale }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          transformOrigin: focusOrigin,
          ...(reduced
            ? {}
            : { rotateX: springRotateX, rotateY: springRotateY, transformStyle: "preserve-3d" }),
        }}
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

        {/* ambient scanning sweep */}
        {!reduced && (
          <div
            aria-hidden
            className="absolute inset-0 overflow-hidden rounded-full"
          >
            <div
              className="absolute inset-0 animate-scan-line"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 47%, rgba(43,227,255,0.45) 50%, transparent 53%)",
              }}
            />
          </div>
        )}

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

          {/* payload turret assembly: reveals itself (fade + drop-in) the first
              time it scrolls into view, on top of the existing hover/select
              dim behavior on its individual parts below */}
          <motion.g
            initial={{ opacity: 0, y: -16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
          {/* conceptual payload flow label */}
          <text
            x="325" y="78"
            textAnchor="middle"
            className="font-mono"
            fill="#8a94a3"
            fontSize="9"
            letterSpacing="1"
          >
            CONCEPTUAL PAYLOAD FLOW
          </text>

          {/* incoming ball + ball intake mechanism (feeds into the turret below) */}
          <g opacity={!activeId || isHighlighted("intake") ? 1 : 0.3} style={{ transition: "opacity 300ms" }}>
            <circle
              cx="287" cy="96" r="7"
              fill="none"
              stroke={isHighlighted("intake") ? "#2be3ff" : "#eef2f6"}
              strokeWidth="2"
              strokeDasharray="3 2"
            />
            <path
              d="M 265 112 L 309 112 L 295 134 L 279 134 Z"
              fill="none"
              stroke={isHighlighted("intake") ? "#2be3ff" : "#8a94a3"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </g>

          {/* payload turret: a single housing mounted flush on the chassis roof,
              containing the storage chamber, feed mechanism, and launcher */}
          <rect
            x="255" y="134" width="140" height="88" rx="8"
            fill="url(#chassisFill)"
            stroke="#8a94a3"
            strokeOpacity="0.5"
            strokeWidth="2"
            opacity={!activeId || ["intake", "storage", "feed", "launch"].includes(activeId) ? 1 : 0.45}
            style={{ transition: "opacity 300ms" }}
          />

          {/* payload storage chamber (left bay of the turret) */}
          <g opacity={!activeId || isHighlighted("storage") ? 1 : 0.3} style={{ transition: "opacity 300ms" }}>
            <circle cx="278" cy="178" r="6" fill="none" stroke={isHighlighted("storage") ? "#2be3ff" : "#8a94a3"} strokeWidth="1.5" />
            <circle cx="296" cy="178" r="6" fill="none" stroke={isHighlighted("storage") ? "#2be3ff" : "#8a94a3"} strokeWidth="1.5" strokeOpacity="0.6" />
            <path
              d="M 268 158 v 40 M 306 158 v 40"
              stroke={isHighlighted("storage") ? "#2be3ff" : "#8a94a3"}
              strokeOpacity="0.5"
              strokeWidth="1.5"
              strokeDasharray="2 3"
            />
          </g>

          {/* ball feeding mechanism (center bay, moves balls right toward the launcher) */}
          <g opacity={!activeId || isHighlighted("feed") ? 1 : 0.3} style={{ transition: "opacity 300ms" }}>
            <path
              d="M 313 178 L 320 173 M 313 178 L 320 183 M 327 178 L 334 173 M 327 178 L 334 183"
              stroke={isHighlighted("feed") ? "#2be3ff" : "#8a94a3"}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>

          {/* payload launching mechanism (right bay + barrel exiting the turret) */}
          <g opacity={!activeId || isHighlighted("launch") ? 1 : 0.3} style={{ transition: "opacity 300ms" }}>
            <circle
              cx="358" cy="178" r="11"
              fill="none"
              stroke={isHighlighted("launch") ? "#ff7a29" : "#8a94a3"}
              strokeWidth="2"
            />
            <path
              d="M 392 165 L 414 145"
              stroke={isHighlighted("launch") ? "#ff7a29" : "#8a94a3"}
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>

          {/* trajectory + target reticle */}
          <path
            d="M 414 145 Q 440 105 465 90"
            fill="none"
            stroke={isHighlighted("launch") ? "#ff7a29" : "#8a94a3"}
            strokeOpacity={!activeId ? 0.4 : isHighlighted("launch") ? 0.9 : 0.15}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <g opacity={!activeId || isHighlighted("launch") ? 0.8 : 0.2}>
            <circle cx="465" cy="90" r="9" fill="none" stroke="#ff7a29" strokeWidth="1.5" />
            <path
              d="M 465 83 v 4 M 465 93 v 4 M 458 90 h 4 M 468 90 h 4"
              stroke="#ff7a29"
              strokeWidth="1.2"
            />
          </g>

          {/* animated ball travelling intake -> storage -> feed -> launch -> target */}
          {!reduced && (
            <circle r="9" fill="#ff7a29">
              <animateMotion
                dur="4.5s"
                repeatCount="indefinite"
                path="M 287 100 L 287 134 L 287 178 L 358 178 L 392 165 L 414 145 Q 440 105 465 90"
              />
            </circle>
          )}
          </motion.g>

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
                {active && !reduced && (
                  <motion.span
                    key={`ping-${c.id}`}
                    aria-hidden
                    className="absolute h-full w-full rounded-full border border-cyan"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.6, opacity: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                )}
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                    active ? "bg-cyan" : "bg-line/60"
                  } ${!active ? "animate-pulse-slow" : ""}`}
                />

                <span
                  className={`pointer-events-none absolute z-20 whitespace-nowrap bg-void/60 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-cyan transition-all duration-200 ${
                    active
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-1"
                  } ${c.y < 50 && c.id !== "intake" ? "bottom-6" : "top-6"} left-1/2 -translate-x-1/2`}
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
