import Link from "next/link";
import { Action, Strategy } from "@/lib/types";
import { SparklineChart } from "@/components/charts";
import AnalyzeButton from "@/components/AnalyzeButton";

function SignalBadge({ signal }: { signal: Action["signal"] }) {
  const colors: Record<string, string> = {
    "STRONG BUY": "bg-up/20 text-up border border-up/30",
    BUY: "bg-up/10 text-up border border-up/20",
    SELL: "bg-down/10 text-down border border-down/20",
    "STRONG SELL": "bg-down/20 text-down border border-down/30",
    HOLD: "bg-muted/10 text-sub border border-muted/20",
  };
  const labels: Record<string, string> = {
    "STRONG BUY": "STRONG BUY",
    BUY: "BUY",
    SELL: "SHORT",
    "STRONG SELL": "STRONG SHORT",
    HOLD: "HOLD",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-bold tracking-wider rounded ${colors[signal] ?? ""}`}
    >
      {labels[signal] ?? signal}
    </span>
  );
}

function StrategyTag({ strategy }: { strategy: Strategy }) {
  const colors: Record<Strategy, string> = {
    Momentum: "bg-info/10 text-info",
    "Mean Reversion": "bg-purple/10 text-purple",
    Catalyst: "bg-gold/10 text-gold",
    "Value Investing": "bg-up/10 text-up-dim",
    "Relative Strength": "bg-accent/10 text-accent",
  };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold tracking-wider rounded ${colors[strategy] ?? ""}`}
    >
      {strategy}
    </span>
  );
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-up/20 text-up border-up/30",
  "A":  "bg-up/15 text-up border-up/25",
  "A-": "bg-up/10 text-up border-up/20",
  "B+": "bg-accent/15 text-accent border-accent/25",
  "B":  "bg-accent/10 text-accent border-accent/20",
  "B-": "bg-accent/10 text-accent border-accent/15",
  "C+": "bg-gold/15 text-gold border-gold/25",
  "C":  "bg-gold/10 text-gold border-gold/20",
  "C-": "bg-gold/10 text-gold border-gold/15",
  "D+": "bg-down/10 text-down border-down/15",
  "D":  "bg-down/15 text-down border-down/20",
  "F":  "bg-down/20 text-down border-down/30",
};

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded border ${
        GRADE_COLORS[grade] ?? "bg-muted/10 text-muted border-muted/20"
      }`}
    >
      {grade}
    </span>
  );
}

function ConfidenceDots({ level }: { level: string }) {
  const count = level === "hoch" ? 3 : level === "mittel" ? 2 : 1;
  return (
    <span className="inline-flex gap-0.5 ml-1">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i <= count ? "bg-accent" : "bg-card-border"
          }`}
        />
      ))}
    </span>
  );
}

function calcRiskReward(action: Action): string | null {
  if (
    action.entry_numeric == null ||
    action.target_numeric == null ||
    action.stop_numeric == null
  )
    return null;

  const isShort = action.signal === "SELL" || action.signal === "STRONG SELL";

  if (isShort) {
    // Short: entry > target, stop > entry
    const risk = action.stop_numeric - action.entry_numeric;
    const reward = action.entry_numeric - action.target_numeric;
    if (risk <= 0 || reward <= 0) return null;
    return `1:${(reward / risk).toFixed(1)}`;
  }

  // Long: target > entry, entry > stop
  const risk = action.entry_numeric - action.stop_numeric;
  const reward = action.target_numeric - action.entry_numeric;
  if (risk <= 0 || reward <= 0) return null;
  return `1:${(reward / risk).toFixed(1)}`;
}

function cardClass(signal: string, isCrypto?: boolean): string {
  const base = isCrypto ? " ring-1 ring-gold/20" : "";
  switch (signal) {
    case "STRONG BUY":
      return "signal-strong-buy" + base;
    case "BUY":
      return "signal-buy" + base;
    case "SELL":
    case "STRONG SELL":
      return "signal-sell" + base;
    default:
      return "signal-hold" + base;
  }
}

/** Display ticker without -USD suffix for crypto */
function displayTicker(ticker: string): string {
  return ticker.replace(/-USD$/, "");
}

function ActionCard({ action }: { action: Action }) {
  const rr = calcRiskReward(action);
  const isShort = action.signal === "SELL" || action.signal === "STRONG SELL";
  const isCrypto = action.isCrypto || action.ticker.endsWith("-USD");

  // Show name if different from ticker (strip -USD for crypto comparison)
  const cleanTicker = displayTicker(action.ticker);
  const hasRealName = action.name
    && action.name !== action.ticker
    && action.name !== cleanTicker
    && action.name.toUpperCase() !== action.ticker.toUpperCase();

  return (
    <Link href={`/stock/${action.ticker}`} className="block">
      <div
        className={`rounded-lg p-4 ${cardClass(action.signal, isCrypto)} border border-card-border card-interactive`}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono-num text-lg font-bold tracking-wide">
                {cleanTicker}
              </span>
              <SignalBadge signal={action.signal} />
              {action.grade && <GradeBadge grade={action.grade} />}
              {isCrypto && (
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-gold/10 text-gold border border-gold/20">
                  Crypto
                </span>
              )}
              {isShort && (
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-down/10 text-down">
                  Short
                </span>
              )}
              {action.strategy && <StrategyTag strategy={action.strategy} />}
              {action.changelogStatus === "new" && (
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded bg-up/20 text-up border border-up/30 animate-pulse">
                  NEU
                </span>
              )}
              {action.timeframeTag && (
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-muted/10 text-sub border border-muted/20">
                  {action.timeframeTag}
                </span>
              )}
            </div>
            {hasRealName && (
              <p className="text-xs text-sub mt-0.5">{action.name}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {action.sparkline && action.sparkline.length > 1 && (
              <SparklineChart data={action.sparkline} width={80} height={28} />
            )}
            <span className="font-mono-num text-lg font-semibold">
              {action.price}
            </span>
          </div>
        </div>

        <p className="text-sm text-sub leading-snug mb-3">{action.reason}</p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">{isShort ? "Short Entry" : "Entry"}</span>
            <span className="font-mono-num text-foreground">
              {action.entry}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{isShort ? "Kursziel" : "Target"}</span>
            <span className={`font-mono-num ${isShort ? "text-down" : "text-up"}`}>{action.target}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Stop-Loss</span>
            <span className={`font-mono-num ${isShort ? "text-up" : "text-down"}`}>{action.stop}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Konfidenz</span>
            <span className="text-foreground capitalize">
              {action.confidence}
              <ConfidenceDots level={action.confidence} />
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Zeitrahmen</span>
            <span className="text-foreground">{action.timeframe}</span>
          </div>
          {rr && (
            <div className="flex justify-between">
              <span className="text-muted">R/R Ratio</span>
              <span className="font-mono-num text-accent">{rr}</span>
            </div>
          )}
          {!rr && (
            <div className="flex justify-between">
              <span className="text-muted">Katalysator</span>
              <span className="text-accent text-right truncate">
                {action.catalyst}
              </span>
            </div>
          )}
        </div>

        {action.scenarios && (
          <div className="flex items-center gap-3 mt-2 text-[10px]">
            <span className="text-muted">Szenarien:</span>
            <span className="font-mono-num text-up">Bull {action.scenarios.bull}</span>
            <span className="font-mono-num text-sub">Base {action.scenarios.base}</span>
            <span className="font-mono-num text-down">Bear {action.scenarios.bear}</span>
          </div>
        )}

        {action.valuation && (
          <div className="flex items-center gap-3 mt-1 text-[10px]">
            <span className={`px-1.5 py-0.5 rounded font-semibold border ${
              action.valuation.verdict === "Unterbewertet" ? "bg-up/15 text-up border-up/30" :
              action.valuation.verdict === "Überbewertet" ? "bg-down/15 text-down border-down/30" :
              "bg-muted/15 text-muted border-muted/30"
            }`}>
              {action.valuation.verdict}
            </span>
            <span className="font-mono-num text-sub">
              Fair Value: {action.valuation.fairValue}
            </span>
            <span className="font-mono-num text-muted">
              MoS: {action.valuation.marginOfSafety}
            </span>
          </div>
        )}

        {action.daysOnList != null && action.daysOnList > 1 && (
          <div className="flex items-center gap-3 mt-1 text-[10px]">
            <span className="text-muted">Tracking:</span>
            <span className="font-mono-num text-sub">Tag {action.daysOnList}</span>
            {action.performancePercent != null && (
              <span className={`font-mono-num font-semibold ${action.performancePercent >= 0 ? "text-up" : "text-down"}`}>
                {action.performancePercent >= 0 ? "+" : ""}{action.performancePercent.toFixed(1)}%
              </span>
            )}
            {action.addedPrice != null && (
              <span className="font-mono-num text-muted">
                Einstieg: {action.addedPrice.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            )}
          </div>
        )}

        {action.validated && (
          <div className="mt-2 pt-2 border-t border-card-border/50 flex items-center justify-between text-[10px] text-muted">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-up" />
              Fundamentaldaten + Analysten verifiziert
            </div>
            <AnalyzeButton ticker={action.ticker} compact />
          </div>
        )}

        {!action.validated && (
          <div className="mt-2 pt-2 border-t border-card-border/50 flex justify-end">
            <AnalyzeButton ticker={action.ticker} compact />
          </div>
        )}
      </div>
    </Link>
  );
}

export default function ActionBoard({ actions }: { actions: Action[] }) {
  const sortOrder: Record<string, number> = {
    "STRONG BUY": 0,
    BUY: 1,
    SELL: 2,
    "STRONG SELL": 3,
    HOLD: 4,
  };
  const sorted = [...actions].sort(
    (a, b) => (sortOrder[a.signal] ?? 5) - (sortOrder[b.signal] ?? 5)
  );

  return (
    <section>
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-3 section-header">
        Action Board
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sorted.map((a) => (
          <ActionCard key={a.ticker} action={a} />
        ))}
      </div>
    </section>
  );
}
