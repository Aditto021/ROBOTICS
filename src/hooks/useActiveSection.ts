import { useEffect, useState } from "react";

// A "line" near the top of the viewport; whichever section's top has
// scrolled above it most recently is the active one. This works regardless
// of section height, unlike an IntersectionObserver ratio threshold (a
// section taller than ~10x the observed band never reaches a low enough
// ratio to fire, so it can never become active).
const ACTIVE_LINE_PX = 160;

export function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState("");

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    let raf = 0;

    const update = () => {
      let current = "";
      for (const el of elements) {
        if (el.getBoundingClientRect().top - ACTIVE_LINE_PX <= 0) {
          current = el.id;
        }
      }
      setActive(current);
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ids]);

  return active;
}
