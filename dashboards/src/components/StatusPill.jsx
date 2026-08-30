export default function StatusPill({ recovered, recoveredVia }) {
  if (recovered) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-recovery/10 border border-recovery/30 px-2.5 py-1 text-xs font-mono text-recovery">
        <span className="w-1.5 h-1.5 rounded-full bg-recovery" />
        recovered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-baseline/10 border border-baseline/30 px-2.5 py-1 text-xs font-mono text-baseline">
      <span className="w-1.5 h-1.5 rounded-full bg-baseline" />
      fallback
    </span>
  );
}
