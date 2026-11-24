import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_ITEMS } from "../data/nav";
import { REPORTS } from "../data/reports";
import { useActiveSection } from "../hooks/useActiveSection";
import { scrollToId, scrollToTop } from "../utils/scrollTo";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  const active = useActiveSection(NAV_ITEMS.map((item) => item.id));
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const reportsRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!reportsOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!reportsRef.current?.contains(e.target as Node)) setReportsOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [reportsOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (id: string) => {
    setOpen(false);
    scrollToId(id, 88);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        scrolled ? "border-b border-line/10 bg-void/80 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToTop();
          }}
          className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center border border-cyan/40 text-xs text-cyan">
            RQ
          </span>
          <span>
            RESQ<span className="text-orange">BOT</span>
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.id} className="relative">
              <button
                onClick={() => handleNavClick(item.id)}
                className={`relative px-4 py-2 font-mono text-[11px] tracking-[0.15em] transition-colors ${
                  active === item.id ? "text-cyan" : "text-muted hover:text-paper"
                }`}
              >
                {item.label.toUpperCase()}
                {active === item.id && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-3 -bottom-[1px] h-[2px] bg-cyan"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            </li>
          ))}
          <li
            ref={reportsRef}
            className="relative"
            onPointerEnter={(e) => e.pointerType === "mouse" && setReportsOpen(true)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setReportsOpen(false)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setReportsOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setReportsOpen(false);
            }}
          >
            <button
              aria-haspopup="true"
              aria-expanded={reportsOpen}
              // Mouse hover already opens the menu, so a mouse click only keeps it
              // open; keyboard (detail 0) and touch taps toggle it.
              onClick={(e) => setReportsOpen((o) => (e.detail === 0 || !matchMedia("(hover: hover)").matches ? !o : true))}
              className="flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] tracking-[0.15em] text-orange transition-colors hover:text-paper"
            >
              REPORT
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className={`transition-transform duration-200 ${reportsOpen ? "rotate-180" : ""}`}
              >
                <path d="M5 9l7 7 7-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <AnimatePresence>
              {reportsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute right-0 top-full pt-2"
                >
                  <ul className="w-60 border border-line/15 bg-void/95 p-1.5 shadow-xl backdrop-blur-md">
                    {REPORTS.map((r) => (
                      <li key={r.href}>
                        <a
                          href={r.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setReportsOpen(false)}
                          className="group flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-line/5 focus-visible:bg-line/5"
                        >
                          <span>
                            <span className="block font-mono text-[11px] tracking-[0.15em] text-paper group-hover:text-orange">
                              {r.label.toUpperCase()}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">{r.note} · PDF</span>
                          </span>
                          <span className="text-orange" aria-hidden>
                            ↗
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        </ul>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <button
            className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span
              className={`h-px w-5 bg-paper transition-transform ${open ? "translate-y-[3.5px] rotate-45" : ""}`}
            />
            <span
              className={`h-px w-5 bg-paper transition-transform ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`}
            />
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line/10 bg-void/95 backdrop-blur-md md:hidden">
          <ul className="flex flex-col px-6 py-4">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full py-3 text-left font-mono text-xs tracking-[0.15em] ${
                    active === item.id ? "text-cyan" : "text-muted"
                  }`}
                >
                  {item.label.toUpperCase()}
                </button>
              </li>
            ))}
            {REPORTS.map((r) => (
              <li key={r.href}>
                <a
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block w-full py-3 text-left font-mono text-xs tracking-[0.15em] text-orange"
                >
                  {r.label.toUpperCase()} (PDF) ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
