import { Risk } from "@/lib/types";

function riskGradient(level: Risk["level"]): string {
  switch (level) {
    case "high":
      return "bg-gradient-to-r from-down/8 to-transparent";
    case "medium":
      return "bg-gradient-to-r from-warn/6 to-transparent";
    default:
      return "";
  }
}

function LevelIndicator({ level }: { level: Risk["level"] }) {
  const config: Record<string, { color: string; label: string }> = {
    low: { color: "bg-up", label: "NIEDRIG" },
    medium: { color: "bg-warn", label: "MITTEL" },
    high: { color: "bg-down", label: "HOCH" },
  };
  const { color, label } = config[level] ?? config.medium;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        <span className={`w-2 h-5 rounded-sm ${color}`} />
        <span
          className={`w-2 h-5 rounded-sm ${
            level !== "low" ? color : "bg-card-border"
          }`}
        />
        <span
          className={`w-2 h-5 rounded-sm ${
            level === "high" ? color : "bg-card-border"
          }`}
        />
      </div>
      <span className="text-[10px] font-bold tracking-wider text-sub">
        {label}
      </span>
    </div>
  );
}

export default function RiskPanel({ risks }: { risks: Risk[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-3 section-header">
        Risiko-Assessment
      </h2>
      <div className="space-y-2">
        {risks.map((r, i) => (
          <div
            key={i}
            className={`rounded-lg bg-card border border-card-border p-3 flex items-center gap-4 card-interactive ${riskGradient(r.level)}`}
          >
            <LevelIndicator level={r.level} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sub">{r.type}</p>
              <p className="text-sm text-foreground leading-snug">
                {r.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
