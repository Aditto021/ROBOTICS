// `html` has `scroll-behavior: smooth` globally (index.css). Per spec, that
// means ANY window.scrollTo call without an explicit behavior — including
// the per-frame calls in our own easing loop below — inherits "smooth" and
// gets animated by the browser. Each frame then cancels and restarts a
// competing smooth-scroll toward a barely-different target, so the page
// never actually reaches where it's supposed to go. Every call here must
// pass `behavior: "instant"` explicitly to bypass that and jump immediately;
// the easing loop itself is what should look smooth.
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function jumpTo(y: number): void {
  window.scrollTo({ top: y, left: 0, behavior: "instant" });
}

export function scrollToId(id: string, offset = 0): void {
  const el = document.getElementById(id);
  if (!el) return;

  const targetY = el.getBoundingClientRect().top + window.scrollY - offset;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) {
    jumpTo(targetY);
    return;
  }

  const startY = window.scrollY;
  const distance = targetY - startY;
  const duration = Math.min(1200, Math.max(400, Math.abs(distance) * 0.35));
  let startTime: number | null = null;

  function step(timestamp: number) {
    if (startTime === null) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    jumpTo(startY + distance * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

export function scrollToTop(): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    jumpTo(0);
    return;
  }

  const startY = window.scrollY;
  const duration = Math.min(1200, Math.max(400, startY * 0.35));
  let startTime: number | null = null;

  function step(timestamp: number) {
    if (startTime === null) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    jumpTo(startY * (1 - easeInOutCubic(progress)));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
