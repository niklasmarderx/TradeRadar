import { Action } from "@/lib/types";

export default function TradingLevels({ action }: { action: Action }) {
  const hasLevels =
    action.entry_numeric != null &&
    action.target_numeric != null &&
    action.stop_numeric != null;

  const riskReward =
    hasLevels && action.entry_numeric! > action.stop_numeric!
      ? (
          (action.target_numeric! - action.entry_numeric!) /
          (action.entry_numeric! - action.stop_numeric!)
        ).toFixed(1)
      : null;

  return (
    <div className="rounded-lg bg-card border border-card-border p-5">
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-4 section-header">
        Handelsniveaus
      </h2>

      <div className="space-y-4 mt-6">
        <div className="flex justify-between items-center py-2 border-b border-border-subtle">
          <span className="text-xs text-muted uppercase tracking-wider">
            Entry
          </span>
          <span className="font-mono-num text-sm text-foreground">
            {action.entry}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-border-subtle">
          <span className="text-xs text-muted uppercase tracking-wider">
            Target
          </span>
          <span className="font-mono-num text-sm text-up">
            {action.target}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-border-subtle">
          <span className="text-xs text-muted uppercase tracking-wider">
            Stop-Loss
          </span>
          <span className="font-mono-num text-sm text-down">
            {action.stop}
          </span>
        </div>

        {riskReward && (
          <div className="flex justify-between items-center py-2 border-b border-border-subtle">
            <span className="text-xs text-muted uppercase tracking-wider">
              Risk/Reward
            </span>
            <span className="font-mono-num text-sm text-accent">
              1:{riskReward}
            </span>
          </div>
        )}

        {hasLevels && (
          <div className="mt-4 pt-2">
            <PriceBar action={action} />
          </div>
        )}

        <div className="flex justify-between items-center py-2">
          <span className="text-xs text-muted uppercase tracking-wider">
            Aktueller Kurs
          </span>
          <span className="font-mono-num text-sm font-bold text-bright">
            {action.price}
          </span>
        </div>
      </div>
    </div>
  );
}

function PriceBar({ action }: { action: Action }) {
  const stop = action.stop_numeric!;
  const entry = action.entry_numeric!;
  const target = action.target_numeric!;
  const current = action.price_numeric;

  const min = stop * 0.97;
  const max = target * 1.03;
  const range = max - min;

  const toPercent = (val: number) =>
    Math.max(0, Math.min(100, ((val - min) / range) * 100));

  return (
    <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
      {/* Stop to Entry zone (risk) */}
      <div
        className="absolute h-full bg-down/20 rounded-l-full"
        style={{
          left: `${toPercent(stop)}%`,
          width: `${toPercent(entry) - toPercent(stop)}%`,
        }}
      />
      {/* Entry to Target zone (reward) */}
      <div
        className="absolute h-full bg-up/20 rounded-r-full"
        style={{
          left: `${toPercent(entry)}%`,
          width: `${toPercent(target) - toPercent(entry)}%`,
        }}
      />
      {/* Current price marker */}
      <div
        className="absolute top-0 h-full w-0.5 bg-accent"
        style={{ left: `${toPercent(current)}%` }}
      />
      {/* Labels below */}
      <div className="absolute -bottom-5 text-[9px] font-mono-num text-down" style={{ left: `${toPercent(stop)}%`, transform: "translateX(-50%)" }}>
        SL
      </div>
      <div className="absolute -bottom-5 text-[9px] font-mono-num text-sub" style={{ left: `${toPercent(entry)}%`, transform: "translateX(-50%)" }}>
        E
      </div>
      <div className="absolute -bottom-5 text-[9px] font-mono-num text-up" style={{ left: `${toPercent(target)}%`, transform: "translateX(-50%)" }}>
        T
      </div>
    </div>
  );
}
