import { Action, Strategy } from "@/lib/types";

function SignalBadge({ signal }: { signal: Action["signal"] }) {
  const colors: Record<string, string> = {
    "STRONG BUY": "bg-up/20 text-up border border-up/30",
    BUY: "bg-up/10 text-up border border-up/20",
    SELL: "bg-down/10 text-down border border-down/20",
    HOLD: "bg-muted/10 text-sub border border-muted/20",
  };
  return (
    <span
      className={`inline-block px-3 py-1 text-sm font-bold tracking-wider rounded ${colors[signal] ?? ""}`}
    >
      {signal}
    </span>
  );
}

function StrategyTag({ strategy }: { strategy: Strategy }) {
  const colors: Record<Strategy, string> = {
    Momentum: "bg-info/10 text-info border border-info/20",
    "Mean Reversion": "bg-purple/10 text-purple border border-purple/20",
    Catalyst: "bg-gold/10 text-gold border border-gold/20",
    "Value Investing": "bg-up/10 text-up-dim border border-up/20",
    "Relative Strength": "bg-accent/10 text-accent border border-accent/20",
  };
  return (
    <span
      className={`inline-block px-3 py-1 text-sm font-semibold tracking-wider rounded ${colors[strategy] ?? ""}`}
    >
      {strategy}
    </span>
  );
}

function ConfidenceDots({ level }: { level: string }) {
  const count = level === "hoch" ? 3 : level === "mittel" ? 2 : 1;
  return (
    <span className="inline-flex gap-1 ml-1">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full ${
            i <= count ? "bg-accent" : "bg-card-border"
          }`}
        />
      ))}
    </span>
  );
}

export default function StockHeader({ action }: { action: Action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="font-mono-num text-3xl font-bold tracking-wide text-bright">
            {action.ticker}
          </h1>
          <SignalBadge signal={action.signal} />
          {action.strategy && <StrategyTag strategy={action.strategy} />}
        </div>
        <p className="text-sm text-sub">{action.name}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {action.sector && (
            <span className="px-2 py-0.5 rounded bg-secondary border border-card-border text-xs text-muted">
              {action.sector}
            </span>
          )}
          {action.industry && (
            <span className="px-2 py-0.5 rounded bg-secondary border border-card-border text-xs text-muted">
              {action.industry}
            </span>
          )}
          {action.validated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-up/5 border border-up/15 text-[10px] text-up">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-up" />
              Opus + GPT-5 validiert
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono-num text-3xl font-bold">{action.price}</p>
        <div className="flex items-center justify-end gap-1 mt-1 text-xs text-muted">
          <span>Konfidenz: {action.confidence}</span>
          <ConfidenceDots level={action.confidence} />
        </div>
      </div>
    </div>
  );
}
