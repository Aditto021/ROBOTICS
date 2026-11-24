import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import type { MissionSceneHandle, SceneTheme } from "../three/missionScene";

type Status = "idle" | "ready" | "failed";

const readTheme = (): SceneTheme =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

const corner = "pointer-events-none absolute h-4 w-4 border-cyan/60";

/**
 * Viewport for the real-time 3D mission simulation. three.js is only
 * downloaded once the card scrolls near the screen, and the render loop
 * pauses whenever the card is off-screen or the tab is hidden.
 */
export function MissionScene3D({ step, label }: { step: number; label: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MissionSceneHandle | null>(null);
  const stepRef = useRef(step);
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    stepRef.current = step;
    engineRef.current?.setStage(step);
  }, [step]);

  useEffect(() => {
    reducedRef.current = reduced;
    engineRef.current?.setReducedMotion(reduced);
  }, [reduced]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let loading = false;
    let onScreen = false;

    const syncActive = () => engineRef.current?.setActive(onScreen && !document.hidden);

    const load = () => {
      if (loading) return;
      loading = true;
      import("../three/missionScene")
        .then(({ createMissionScene }) => {
          if (cancelled) return;
          engineRef.current = createMissionScene(host, {
            theme: readTheme(),
            reducedMotion: reducedRef.current,
            stage: stepRef.current,
          });
          syncActive();
          setStatus("ready");
        })
        .catch(() => {
          if (!cancelled) setStatus("failed");
        });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) load();
        syncActive();
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(host);

    const mo = new MutationObserver(() => engineRef.current?.setTheme(readTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    document.addEventListener("visibilitychange", syncActive);

    return () => {
      cancelled = true;
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", syncActive);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative mb-8 aspect-[4/3] w-full overflow-hidden border border-line/10 bg-gradient-to-b from-cyan/[0.04] to-transparent sm:aspect-[16/9]">
      <div ref={hostRef} className="absolute inset-0" />

      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[10px] tracking-widest text-muted/70">
            {status === "failed" ? "3D VIEW UNAVAILABLE ON THIS DEVICE" : "INITIALISING SIMULATION…"}
          </span>
        </div>
      )}

      {/* HUD frame */}
      <span className={`${corner} left-2 top-2 border-l border-t`} />
      <span className={`${corner} right-2 top-2 border-r border-t`} />
      <span className={`${corner} bottom-2 left-2 border-b border-l`} />
      <span className={`${corner} bottom-2 right-2 border-b border-r`} />
      <div className="pointer-events-none absolute left-4 top-3.5 flex items-center gap-2 font-mono text-[9px] tracking-widest text-cyan sm:text-[10px]">
        <span className="inline-block h-1.5 w-1.5 motion-safe:animate-pulse rounded-full bg-cyan" />
        {label}
      </div>
      <div className="pointer-events-none absolute bottom-3.5 right-4 font-mono text-[9px] tracking-widest text-muted/70 sm:text-[10px]">
        3D SIMULATION
      </div>
    </div>
  );
}
