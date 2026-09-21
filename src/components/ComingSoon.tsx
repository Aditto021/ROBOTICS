export function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex cursor-not-allowed items-center gap-1.5 font-mono text-[11px] tracking-widest text-muted/50"
      title="Not published yet"
    >
      {label}
      <span className="border border-line/10 px-1.5 py-0.5 text-[9px] text-muted/60">
        SOON
      </span>
    </span>
  );
}
