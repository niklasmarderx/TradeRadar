import type { IndicatorResults } from "@/lib/types";

interface IndicatorPanelProps {
  indicators: IndicatorResults;
  currentPrice: number;
}

function formatNum(n: number | null, decimals = 2): string {
  if (n === null) return "–";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function SignalLabel({ signal, labels }: { signal: string; labels: Record<string, { text: string; color: string }> }) {
  const config = labels[signal] ?? { text: signal, color: "text-muted" };
  return <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>{config.text}</span>;
}

const SCORE_COLORS: Record<string, string> = {
  "STRONG BUY": "text-up",
  BUY: "text-up",
  SELL: "text-down",
  "STRONG SELL": "text-down",
  HOLD: "text-muted",
};

const RSI_LABELS: Record<string, { text: string; color: string }> = {
  overbought: { text: "Ueberkauft", color: "text-down" },
  oversold: { text: "Ueberverkauft", color: "text-up" },
  neutral: { text: "Neutral", color: "text-muted" },
};

const MACD_LABELS: Record<string, { text: string; color: string }> = {
  bullish_cross: { text: "Bullish Cross", color: "text-up" },
  bearish_cross: { text: "Bearish Cross", color: "text-down" },
  bullish: { text: "Bullish", color: "text-up" },
  bearish: { text: "Bearish", color: "text-down" },
  neutral: { text: "Neutral", color: "text-muted" },
};

const TREND_LABELS: Record<string, { text: string; color: string }> = {
  strong_uptrend: { text: "Starker Aufwaertstrend", color: "text-up" },
  uptrend: { text: "Aufwaertstrend", color: "text-up" },
  downtrend: { text: "Abwaertstrend", color: "text-down" },
  strong_downtrend: { text: "Starker Abwaertstrend", color: "text-down" },
  neutral: { text: "Neutral", color: "text-muted" },
};

const STRENGTH_LABELS: Record<string, { text: string; color: string }> = {
  strong: { text: "Stark", color: "text-up" },
  moderate: { text: "Moderat", color: "text-accent" },
  weak: { text: "Schwach", color: "text-gold" },
  no_trend: { text: "Kein Trend", color: "text-muted" },
};

const BB_LABELS: Record<string, { text: string; color: string }> = {
  upper_squeeze: { text: "Obere Begrenzung", color: "text-down" },
  lower_squeeze: { text: "Untere Begrenzung", color: "text-up" },
  expanding: { text: "Expansion", color: "text-accent" },
  neutral: { text: "Neutral", color: "text-muted" },
};

function ScoreBar({ score }: { score: number }) {
  // Score from -100 to +100, map to 0-100 for display
  const pct = Math.max(0, Math.min(100, (score + 100) / 2));
  const color = score >= 50 ? "bg-up" : score >= 20 ? "bg-up/70" : score <= -50 ? "bg-down" : score <= -20 ? "bg-down/70" : "bg-muted";
  return (
    <div className="relative h-2 bg-background rounded-full overflow-hidden">
      <div className="absolute left-1/2 w-px h-full bg-card-border" />
      <div
        className={`absolute h-full rounded-full transition-all ${color}`}
        style={{
          left: score >= 0 ? "50%" : `${pct}%`,
          width: score >= 0 ? `${pct - 50}%` : `${50 - pct}%`,
        }}
      />
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, (value + 25) / 50 * 100));
  const color = value > 5 ? "bg-up" : value < -5 ? "bg-down" : "bg-muted";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-sub w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-background rounded-full overflow-hidden relative">
        <div className="absolute left-1/2 w-px h-full bg-card-border" />
        <div
          className={`absolute h-full rounded-full ${color}`}
          style={{
            left: value >= 0 ? "50%" : `${pct}%`,
            width: value >= 0 ? `${pct - 50}%` : `${50 - pct}%`,
          }}
        />
      </div>
      <span className={`font-mono-num text-[10px] w-8 text-right ${value > 5 ? "text-up" : value < -5 ? "text-down" : "text-muted"}`}>
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  );
}

export default function IndicatorPanel({ indicators, currentPrice }: IndicatorPanelProps) {
  const { latestValues: v, signals: s, compositeScore: cs } = indicators;

  return (
    <div className="bg-card border border-card-border rounded-lg p-4 space-y-4">

      {/* Composite Score - the headline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="section-header text-xs font-semibold uppercase tracking-widest text-sub">
            Composite Score
          </h3>
          <span className={`text-lg font-bold font-mono-num ${SCORE_COLORS[cs.signal]}`}>
            {cs.score > 0 ? "+" : ""}{cs.score}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
            cs.signal === "STRONG BUY" ? "bg-up/20 text-up border-up/40" :
            cs.signal === "BUY" ? "bg-up/10 text-up border-up/30" :
            cs.signal === "SELL" || cs.signal === "STRONG SELL" ? "bg-down/20 text-down border-down/40" :
            "bg-muted/20 text-muted border-muted/40"
          }`}>
            {cs.signal}
          </span>
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${
                i < (cs.confidence === "hoch" ? 3 : cs.confidence === "mittel" ? 2 : 1)
                  ? "bg-accent" : "bg-card-border"
              }`} />
            ))}
          </div>
          <span className="text-[9px] text-muted">{cs.convergence}/4 Konvergenz</span>
        </div>

        <ScoreBar score={cs.score} />

        {/* Breakdown */}
        <div className="space-y-1 pt-1">
          <BreakdownBar label="Trend" value={cs.breakdown.trend} />
          <BreakdownBar label="Momentum" value={cs.breakdown.momentum} />
          <BreakdownBar label="Volatilitaet" value={cs.breakdown.volatility} />
          <BreakdownBar label="Volumen" value={cs.breakdown.volume} />
        </div>

        {/* Kelly + Entry/Target/Stop */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-background rounded px-2 py-1">
            <span className="text-[8px] text-muted uppercase block">Kelly</span>
            <span className="font-mono-num text-xs text-bright">{cs.kellySize}%</span>
          </div>
          <div className="bg-background rounded px-2 py-1">
            <span className="text-[8px] text-muted uppercase block">R/R</span>
            <span className="font-mono-num text-xs text-bright">
              1:{((cs.suggestedTarget - cs.suggestedEntry) / Math.abs(cs.suggestedEntry - cs.suggestedStop)).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* RSI */}
      <div className="space-y-1.5 pt-2 border-t border-card-border">
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-muted uppercase tracking-wider">RSI (14)</span>
          <span className="font-mono-num text-sm text-bright">{formatNum(v.rsi, 1)}</span>
        </div>
        {v.rsi !== null && (
          <div className="h-1.5 bg-background rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                v.rsi > 70 ? "bg-down" : v.rsi < 30 ? "bg-up" : "bg-accent"
              }`}
              style={{ width: `${Math.min(100, v.rsi)}%` }}
            />
          </div>
        )}
        <SignalLabel signal={s.rsiSignal} labels={RSI_LABELS} />
      </div>

      {/* Stochastic */}
      <div className="space-y-1.5 pt-2 border-t border-card-border">
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-muted uppercase tracking-wider">Stochastik (14,3)</span>
          <span className="font-mono-num text-xs text-bright">K:{formatNum(v.stochasticK, 1)} D:{formatNum(v.stochasticD, 1)}</span>
        </div>
        <SignalLabel signal={s.stochasticSignal} labels={{
          overbought: { text: "Ueberkauft", color: "text-down" },
          oversold: { text: "Ueberverkauft", color: "text-up" },
          bullish_cross: { text: "Bullish Cross", color: "text-up" },
          bearish_cross: { text: "Bearish Cross", color: "text-down" },
          neutral: { text: "Neutral", color: "text-muted" },
        }} />
      </div>

      {/* MACD */}
      <div className="space-y-1.5 pt-2 border-t border-card-border">
        <span className="text-[10px] text-muted uppercase tracking-wider">MACD</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span className="text-[10px] text-sub">Linie</span>
          <span className="font-mono-num text-xs text-bright text-right">{formatNum(v.macdLine)}</span>
          <span className="text-[10px] text-sub">Signal</span>
          <span className="font-mono-num text-xs text-bright text-right">{formatNum(v.macdSignal)}</span>
          <span className="text-[10px] text-sub">Histogramm</span>
          <span className={`font-mono-num text-xs text-right ${
            v.macdHistogram !== null && v.macdHistogram >= 0 ? "text-up" : "text-down"
          }`}>{formatNum(v.macdHistogram)}</span>
        </div>
        <SignalLabel signal={s.macdSignal} labels={MACD_LABELS} />
      </div>

      {/* ADX + ATR */}
      <div className="space-y-1.5 pt-2 border-t border-card-border">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-muted uppercase tracking-wider block">ADX (14)</span>
            <span className="font-mono-num text-sm text-bright">{formatNum(v.adx, 1)}</span>
            <div className="mt-0.5">
              <SignalLabel signal={s.trendStrength} labels={STRENGTH_LABELS} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-muted uppercase tracking-wider block">ATR (14)</span>
            <span className="font-mono-num text-sm text-bright">{formatNum(v.atr)}</span>
            <span className="text-[9px] text-muted ml-1">({formatNum(v.atrPercent, 1)}%)</span>
          </div>
        </div>
      </div>

      {/* Bollinger Bands */}
      <div className="space-y-1.5 pt-2 border-t border-card-border">
        <span className="text-[10px] text-muted uppercase tracking-wider">Bollinger Bands</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span className="text-[10px] text-sub">Obere</span>
          <span className="font-mono-num text-xs text-bright text-right">{formatNum(v.bollingerUpper)}</span>
          <span className="text-[10px] text-sub">Mitte</span>
          <span className="font-mono-num text-xs text-bright text-right">{formatNum(v.bollingerMiddle)}</span>
          <span className="text-[10px] text-sub">Untere</span>
          <span className="font-mono-num text-xs text-bright text-right">{formatNum(v.bollingerLower)}</span>
        </div>
        <SignalLabel signal={s.bollingerSignal} labels={BB_LABELS} />
      </div>

      {/* Moving Averages */}
      <div className="space-y-1.5 pt-2 border-t border-card-border">
        <span className="text-[10px] text-muted uppercase tracking-wider">Gleitende Durchschnitte</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span className="text-[10px] text-sub">SMA 20</span>
          <span className={`font-mono-num text-xs text-right ${
            v.sma20 !== null && currentPrice > v.sma20 ? "text-up" : "text-down"
          }`}>{formatNum(v.sma20)}</span>
          <span className="text-[10px] text-sub">SMA 50</span>
          <span className={`font-mono-num text-xs text-right ${
            v.sma50 !== null && currentPrice > v.sma50 ? "text-up" : "text-down"
          }`}>{formatNum(v.sma50)}</span>
          <span className="text-[10px] text-sub">SMA 200</span>
          <span className={`font-mono-num text-xs text-right ${
            v.sma200 !== null && currentPrice > v.sma200 ? "text-up" : "text-down"
          }`}>{formatNum(v.sma200)}</span>
        </div>
        <SignalLabel signal={s.trendSignal} labels={TREND_LABELS} />
      </div>

      {/* Support / Resistance */}
      <div className="space-y-1.5 pt-2 border-t border-card-border">
        <span className="text-[10px] text-muted uppercase tracking-wider">Support / Resistance</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span className="text-[10px] text-sub">Support</span>
          <span className="font-mono-num text-xs text-up text-right">{formatNum(indicators.supportResistance.support)}</span>
          <span className="text-[10px] text-sub">Resistance</span>
          <span className="font-mono-num text-xs text-down text-right">{formatNum(indicators.supportResistance.resistance)}</span>
        </div>
      </div>
    </div>
  );
}
