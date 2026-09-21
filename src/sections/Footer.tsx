function ComingSoonLink({ label }: { label: string }) {
  return (
    <span
      className="inline-flex cursor-not-allowed items-center gap-1.5 font-mono text-[11px] tracking-widest text-muted/50"
      title="Not published yet"
    >
      {label}
      <span className="border border-white/10 px-1.5 py-0.5 text-[9px] text-muted/60">
        SOON
      </span>
    </span>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 lg:px-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:w-full sm:flex-row">
          <div className="flex items-center gap-2.5 font-display text-sm font-semibold tracking-tight">
            <span className="flex h-6 w-6 items-center justify-center border border-cyan/40 text-[10px] text-cyan">
              RQ
            </span>
            RESQ<span className="text-orange">BOT</span>
          </div>

          <div className="flex items-center gap-6">
            <ComingSoonLink label="GITHUB" />
            <ComingSoonLink label="DOCUMENTATION" />
          </div>

          <p className="font-mono text-[11px] tracking-widest text-muted">
            ROBOTICS DEMONSTRATION PROJECT
          </p>
        </div>
        <p className="font-mono text-[11px] tracking-widest text-muted/60">
          NO REAL FIRE-SUPPRESSION CAPABILITY — FOAM-BALL DEMONSTRATION ONLY
        </p>
      </div>
    </footer>
  );
}
