import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { NAV_ITEMS } from "../data/nav";
import { useActiveSection } from "../hooks/useActiveSection";
import { scrollToId, scrollToTop } from "../utils/scrollTo";

export function Nav() {
  const active = useActiveSection(NAV_ITEMS.map((item) => item.id));
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
        scrolled ? "border-b border-white/10 bg-void/80 backdrop-blur-md" : "border-b border-transparent"
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
        </ul>

        <div className="hidden items-center gap-3 font-mono text-[11px] tracking-widest text-muted md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse-slow" aria-hidden />
          LINK ACTIVE
        </div>

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
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-void/95 backdrop-blur-md md:hidden">
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
          </ul>
        </div>
      )}
    </header>
  );
}
