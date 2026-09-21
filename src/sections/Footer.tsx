import { ComingSoonBadge } from "../components/ComingSoon";

export function Footer() {
  return (
    <footer className="relative border-t border-line/10 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-10">
        <div className="flex items-center gap-2.5 font-display text-sm font-semibold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center border border-cyan/40 text-[10px] text-cyan">
            RQ
          </span>
          RESQ<span className="text-orange">BOT</span>
        </div>

        <p className="font-mono text-[11px] tracking-widest text-muted">
          EMERGENCY-RESPONSE ROBOTICS RESEARCH
        </p>

        <div className="flex items-center gap-6">
          <ComingSoonBadge label="GITHUB" />
          <ComingSoonBadge label="DOCUMENTATION" />
        </div>
      </div>
    </footer>
  );
}
