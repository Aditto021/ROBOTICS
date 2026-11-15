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

/* Palette taken from the real prototype: white foam-board body, yellow-rim wheels. */
const FOAM = "#ece7db";
const FOAM_TOP = "#f8f5ee";
const FOAM_SIDE = "#cbc4b4";
const EDGE = "#5b6470";
const TIRE = "#15181d";
const RIM = "#f2c418";
const CYAN = "#2be3ff";
const ORANGE = "#ff7a29";

/* Oblique 3D: every box shows its front face, top face, and right-hand (forward) face. */
const DX = 24;
const DY = -16;

function Box({
  x, y, w, h, stroke = EDGE, glow = false,
}: { x: number; y: number; w: number; h: number; stroke?: string; glow?: boolean }) {
  const sw = glow ? 2 : 1.4;
  return (
    <g strokeLinejoin="round">
      <polygon
        points={`${x},${y} ${x + DX},${y + DY} ${x + w + DX},${y + DY} ${x + w},${y}`}
        fill={FOAM_TOP} stroke={stroke} strokeWidth={sw}
      />
      <polygon
        points={`${x + w},${y} ${x + w + DX},${y + DY} ${x + w + DX},${y + h + DY} ${x + w},${y + h}`}
        fill={FOAM_SIDE} stroke={stroke} strokeWidth={sw}
      />
      <rect x={x} y={y} width={w} height={h} fill={FOAM} stroke={stroke} strokeWidth={sw} />
    </g>
  );
}

function Wheel({
  cx, cy, r, spin, dur = 1.4, highlight = false, far = false,
}: { cx: number; cy: number; r: number; spin: boolean; dur?: number; highlight?: boolean; far?: boolean }) {
  const spokes = [0, 72, 144, 216, 288];
  return (
    <g opacity={far ? 0.55 : 1}>
      <circle cx={cx} cy={cy} r={r} fill={TIRE} stroke={highlight ? ORANGE : "#3a414c"} strokeWidth={highlight ? 3 : 1.5} />
      <circle cx={cx} cy={cy} r={r * 0.84} fill="none" stroke="#2c323b" strokeWidth="3" strokeDasharray="4 5" />
      <circle cx={cx} cy={cy} r={r * 0.56} fill={RIM} stroke="#b98f00" strokeWidth="1.5" />
      <g>
        {spokes.map((deg) => (
          <line
            key={deg}
            x1={cx} y1={cy} x2={cx} y2={cy - r * 0.5}
            stroke="#c99a00" strokeWidth={r * 0.12} strokeLinecap="round"
            transform={`rotate(${deg} ${cx} ${cy})`}
          />
        ))}
        {spin && (
          <animateTransform
            attributeName="transform" type="rotate"
            from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`}
            dur={`${dur}s`} repeatCount="indefinite"
          />
        )}
      </g>
      <circle cx={cx} cy={cy} r={r * 0.16} fill="#e5e7eb" stroke="#9aa3ad" />
    </g>
  );
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
  const live = !reduced;

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
    rotateY.set(px * 12);
    rotateX.set(py * -10);
  };

  const handlePointerLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  const isHighlighted = (id: string) => activeId === id;
  /** Parts not related to the hovered/selected component fade back. */
  const dim = (...ids: string[]) => ({
    opacity: !activeId || ids.includes(activeId) ? 1 : 0.28,
    style: { transition: "opacity 300ms" },
  });
  const hl = (id: string, on = CYAN) => (isHighlighted(id) ? on : EDGE);

  const activeComponent = mode === "interactive" ? MECHANISM_COMPONENTS.find((c) => c.id === activeId) : undefined;
  const focusOrigin = activeComponent ? `${activeComponent.x}% ${activeComponent.y}%` : "50% 50%";
  const focusScale = activeComponent && !reduced ? 1.35 : 1;

  /* Ball cycle: ground -> intake ramp -> hopper -> feeder -> flywheel -> guide -> target */
  const BALL_PATH =
    "M 600 394 L 540 362 L 496 326 L 498 252 L 486 200 L 432 204 L 346 238 L 314 224 " +
    "C 290 198 266 170 298 128 C 318 106 350 98 404 92 Q 482 78 560 112";

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
        <div aria-hidden className="absolute inset-[10%] rounded-full border border-dashed border-orange/25 animate-spin-slow" />
        <div aria-hidden className="absolute inset-[18%] rounded-full border border-cyan/15 animate-spin-reverse-slow" />
        <div
          aria-hidden
          className="absolute inset-0 rounded-full opacity-70"
          style={{ background: "radial-gradient(circle at 50% 55%, rgba(43,227,255,0.12), transparent 60%)" }}
        />

        <svg
          viewBox="0 0 640 520"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Illustration of the ResQBot rover: white chassis, camera mast, flywheel launcher, ball hopper, and four wheels"
        >
          <defs>
            <linearGradient id="fov" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CYAN} stopOpacity="0.28" />
              <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
            </linearGradient>
            <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* corner brackets */}
          {[
            [70, 40, 1, 1],
            [570, 40, -1, 1],
            [70, 470, 1, -1],
            [570, 470, -1, -1],
          ].map(([x, y, dx, dy], i) => (
            <g key={i} stroke={CYAN} strokeOpacity="0.35" strokeWidth="1.5">
              <line x1={x} y1={y} x2={x + 22 * dx} y2={y} />
              <line x1={x} y1={y} x2={x} y2={y + 22 * dy} />
            </g>
          ))}

          <text x="320" y="30" textAnchor="middle" className="font-mono" fill="#8a94a3" fontSize="9" letterSpacing="1.5">
            RESQBOT · LIVE SYSTEM VIEW
          </text>

          {/* ground: moving dashes give a sense of driving */}
          <line x1="60" y1="404" x2="600" y2="404" stroke="#8a94a3" strokeOpacity="0.35" strokeDasharray="10 14" strokeWidth="1.5">
            {live && <animate attributeName="stroke-dashoffset" from="0" to="48" dur="0.9s" repeatCount="indefinite" />}
          </line>
          <line x1="110" y1="420" x2="560" y2="420" stroke="#8a94a3" strokeOpacity="0.15" strokeDasharray="4 18">
            {live && <animate attributeName="stroke-dashoffset" from="0" to="44" dur="1.3s" repeatCount="indefinite" />}
          </line>
          <ellipse cx="330" cy="404" rx="230" ry="12" fill="url(#shadow)" />

          {/* camera field of view (behind the rover) */}
          <g {...dim("camera")}>
            <polygon points="252,108 612,36 612,196" fill="url(#fov)" />
            {live && (
              <line x1="252" y1="108" x2="612" y2="60" stroke={CYAN} strokeOpacity="0.55" strokeWidth="1.2">
                <animate attributeName="y2" values="48;186;48" dur="4s" repeatCount="indefinite" />
              </line>
            )}
          </g>

          {/* target area + trajectory */}
          <g {...dim("launch", "camera")}>
            <path d="M 404 92 Q 482 78 560 112" fill="none" stroke={ORANGE} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="560" cy="112" r="11" fill="none" stroke={ORANGE} strokeWidth="1.5" />
            <path d="M 560 98 v 6 M 560 120 v 6 M 546 112 h 6 M 568 112 h 6" stroke={ORANGE} strokeWidth="1.2" />
            {live && (
              <circle cx="560" cy="112" r="11" fill="none" stroke={ORANGE} strokeWidth="1">
                <animate attributeName="r" values="11;24" dur="5s" keyTimes="0;1" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0;0.9;0" keyTimes="0;0.9;0.93;1" dur="5s" repeatCount="indefinite" />
              </circle>
            )}
          </g>

          {/* ===================== the rover (drives in on load) ===================== */}
          <motion.g
            initial={reduced ? false : { x: -170, opacity: 0 }}
            {...(mode === "hero"
              ? { animate: { x: 0, opacity: 1 } }
              : { whileInView: { x: 0, opacity: 1 }, viewport: { once: true, margin: "-10%" } })}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: mode === "hero" ? 0.5 : 0 }}
          >
            {/* far-side wheels */}
            <g {...dim("motors")}>
              <Wheel cx={238} cy={350} r={36} spin={live} far />
              <Wheel cx={444} cy={350} r={36} spin={live} far />
            </g>

            {/* body sways gently on its suspension */}
            <g>
              {live && (
                <animateTransform
                  attributeName="transform" type="translate"
                  values="0 0; 0 -1.6; 0 0; 0 -0.8; 0 0" dur="0.9s" repeatCount="indefinite"
                />
              )}

              {/* chassis */}
              <g {...dim("esp32", "power", "sensors")}>
                <Box x={150} y={262} w={320} h={74} />
              </g>

              {/* cut-away electronics bay */}
              <rect x="176" y="272" width="270" height="54" rx="5" fill="#10141b" stroke={EDGE} strokeWidth="1.2" opacity={0.92} />
              <g {...dim("power")}>
                <rect x="186" y="284" width="64" height="34" rx="3" fill="#2b2f36" stroke={hl("power", ORANGE)} strokeWidth="1.5" />
                <rect x="188" y="278" width="60" height="10" rx="1.5" fill="#1f7a4d" />
                <text x="218" y="306" textAnchor="middle" fontSize="8" fill="#9aa3ad" className="font-mono">3S</text>
              </g>
              <rect x="262" y="288" width="36" height="30" rx="2" fill="#b3262b" opacity={!activeId || isHighlighted("motors") ? 1 : 0.3} />
              <rect x="270" y="280" width="20" height="12" fill="#222" opacity={!activeId || isHighlighted("motors") ? 1 : 0.3} />
              <g {...dim("esp32")}>
                <rect x="308" y="286" width="60" height="32" rx="2" fill="#1f6b3a" stroke={hl("esp32")} strokeWidth="1.5" />
                <rect x="318" y="290" width="40" height="24" rx="2" fill="#111" />
                <rect x="324" y="293" width="22" height="12" rx="1" fill="#9aa3ad" />
                <circle cx="362" cy="312" r="2.5" fill="#39ff7a" filter="url(#glow)">
                  {live && <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />}
                </circle>
              </g>
              <g {...dim("sensors")}>
                <rect x="378" y="296" width="26" height="20" rx="2" fill="#1d3f8f" />
                <rect x="412" y="290" width="26" height="24" rx="2" fill="#2563c4" />
              </g>
              <path d="M 250 296 C 262 278 300 276 318 290 M 298 312 C 330 326 380 322 392 306" fill="none" stroke="#e23b3b" strokeWidth="1.3" opacity="0.8" />
              <path d="M 368 300 C 385 284 400 286 412 300" fill="none" stroke="#f2c418" strokeWidth="1.3" opacity="0.8" />

              {/* front sensors: MQ-2 gas sensor + HC-SR04 sonar "eyes" */}
              <g {...dim("sensors")}>
                <circle cx="458" cy="300" r="8" fill="#c9ced4" stroke={hl("sensors")} strokeWidth="1.5" />
                <path d="M 452 300 h 12 M 458 294 v 12" stroke="#7b838e" strokeWidth="1" />
                <polygon points="472,292 490,280 490,302 472,314" fill="#1d4fa0" stroke={hl("sensors")} strokeWidth="1.2" />
                <rect x="486" y="281" width="12" height="9" rx="2" fill="#d5d9de" stroke="#7b838e" />
                <rect x="486" y="295" width="12" height="9" rx="2" fill="#d5d9de" stroke="#7b838e" />
                {live &&
                  [0, 0.4, 0.8].map((b) => (
                    <path key={b} d="M 506 278 A 20 20 0 0 1 506 308" fill="none" stroke={CYAN} strokeWidth="1.5">
                      <animateTransform attributeName="transform" type="translate" values="0 0; 26 0" dur="1.6s" begin={`${b}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0" dur="1.6s" begin={`${b}s`} repeatCount="indefinite" />
                    </path>
                  ))}
              </g>

              {/* intake ramp at the front */}
              <g {...dim("intake")}>
                <path d="M 476 324 L 542 364" stroke={FOAM} strokeWidth="7" strokeLinecap="round" />
                <path d="M 476 324 L 542 364" stroke={hl("intake")} strokeWidth="1.2" fill="none" strokeDasharray={isHighlighted("intake") ? "0" : "0"} />
                <polygon points="476,320 500,304 548,350 542,364" fill={FOAM_SIDE} opacity="0.55" stroke={hl("intake")} strokeWidth="1" />
              </g>

              {/* power panel on the deck: voltage display */}
              <g {...dim("power")}>
                <rect x="160" y="246" width="28" height="11" rx="1.5" fill="#111" stroke={hl("power", ORANGE)} />
                <text x="174" y="254.5" textAnchor="middle" fontSize="8" fill="#ff4d4d" className="font-mono">8.4</text>
              </g>

              {/* camera mast + ESP32-CAM */}
              <g {...dim("camera")}>
                <Box x={188} y={98} w={34} h={158} stroke={hl("camera")} glow={isHighlighted("camera")} />
                <polygon points="226,100 240,91 240,128 226,137" fill="#141414" stroke={hl("camera")} strokeWidth="1.2" />
                <rect x="236" y="102" width="13" height="12" rx="2" fill="#262a30" />
                <ellipse cx="250" cy="108" rx="3" ry="5.5" fill={CYAN} filter="url(#glow)" />
                <circle cx="231" cy="124" r="1.6" fill="#ff4d4d">
                  {live && <animate attributeName="opacity" values="1;0.15;1" dur="2s" repeatCount="indefinite" />}
                </circle>
                <path d="M 208 140 C 196 190 206 230 200 254" fill="none" stroke="#f2c418" strokeWidth="1.3" />
                <path d="M 214 140 C 204 190 214 230 208 254" fill="none" stroke="#e23b3b" strokeWidth="1.3" />
              </g>

              {/* flywheel launcher + clear guide */}
              <g {...dim("launch")}>
                <path d="M 356 104 L 346 226" stroke={FOAM} strokeWidth="5" strokeLinecap="round" />
                <path d="M 270 196 C 262 150 300 112 360 98 L 404 92" fill="none" stroke="#bfe9f5" strokeOpacity="0.28" strokeWidth="14" strokeLinecap="round" />
                <path d="M 270 196 C 262 150 300 112 360 98 L 404 92" fill="none" stroke="#e6f8fd" strokeOpacity="0.65" strokeWidth="1.2" />
                <Box x={246} y={230} w={70} h={26} stroke={hl("launch", ORANGE)} glow={isHighlighted("launch")} />
                <rect x="252" y="236" width="46" height="15" rx="4" fill="#8d96a1" stroke="#5b6470" />
                <ellipse cx="298" cy="243.5" rx="3.5" ry="7.5" fill="#6b7480" />
                <Wheel cx={290} cy={206} r={22} spin={live} dur={0.35} highlight={isHighlighted("launch")} />
              </g>

              {/* hopper / storage chamber with balls */}
              <g {...dim("storage", "intake")} strokeLinejoin="round">
                <polygon points="352,212 376,196 506,182 482,198" fill="#2b2f36" stroke={hl("storage")} strokeWidth="1.4" />
                <circle cx="408" cy="203" r="8" fill={ORANGE} />
                <circle cx="434" cy="200" r="8" fill={ORANGE} />
                <circle cx="458" cy="197" r="8" fill={ORANGE} opacity="0.85" />
                <polygon points="466,254 490,238 506,182 482,198" fill={FOAM_SIDE} stroke={hl("storage")} strokeWidth="1.4" />
                <polygon points="340,254 466,254 482,198 352,212" fill={FOAM} stroke={hl("storage")} strokeWidth="1.4" />
              </g>

              {/* feeder servo (releases one ball at a time) */}
              <g {...dim("feed")}>
                <rect x="322" y="228" width="24" height="20" rx="2" fill="#1b1b1f" stroke={hl("feed")} strokeWidth="1.4" />
                <rect x="322" y="234" width="24" height="4" fill="#c2185b" />
                <line x1="334" y1="230" x2="352" y2="222" stroke="#f1f1f1" strokeWidth="3" strokeLinecap="round">
                  {live && (
                    <animateTransform attributeName="transform" type="rotate" values="0 334 230; 0 334 230; -38 334 230; 0 334 230"
                      keyTimes="0;0.5;0.56;0.64" dur="5s" repeatCount="indefinite" />
                  )}
                </line>
              </g>
            </g>

            {/* near-side wheels (do not sway) */}
            <g {...dim("motors")}>
              <Wheel cx={214} cy={366} r={38} spin={live} highlight={isHighlighted("motors")} />
              <Wheel cx={420} cy={366} r={38} spin={live} highlight={isHighlighted("motors")} />
            </g>

            {/* the payload ball running through the whole cycle */}
            {live && (
              <circle r="8" fill={ORANGE} filter="url(#glow)">
                <animateMotion dur="5s" repeatCount="indefinite" path={BALL_PATH} />
              </circle>
            )}
          </motion.g>
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
                    active ? "border-cyan scale-150" : "border-cyan/40"
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
                    active ? "bg-cyan" : "bg-cyan/70"
                  } ${!active ? "animate-pulse-slow" : ""}`}
                />
                <span
                  className={`pointer-events-none absolute z-20 whitespace-nowrap bg-void/80 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-cyan transition-all duration-200 ${
                    active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  } ${c.y < 50 ? "bottom-6" : "top-6"} left-1/2 -translate-x-1/2`}
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
