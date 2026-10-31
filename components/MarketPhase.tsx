export default function MarketPhase({
  phase,
}: {
  phase: "bullish" | "bearish" | "neutral" | "volatile";
}) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    bullish: { color: "bg-up pulse-dot", bg: "bg-up/10", label: "BULLISH" },
    bearish: { color: "bg-down pulse-dot", bg: "bg-down/10", label: "BEARISH" },
    neutral: { color: "bg-muted", bg: "bg-muted/10", label: "NEUTRAL" },
    volatile: { color: "bg-warn pulse-dot", bg: "bg-warn/10", label: "VOLATIL" },
  };
  const { color, bg, label } = config[phase] ?? config.neutral;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${bg}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs font-bold tracking-widest text-sub">
        Marktphase:
      </span>
      <span className="text-xs font-bold tracking-widest text-foreground">
        {label}
      </span>
    </div>
  );
}
