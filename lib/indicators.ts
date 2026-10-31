import { RSI, MACD, BollingerBands, SMA, EMA, Stochastic, ADX, ATR } from "technicalindicators";
import type { IndicatorResults, CompositeScore, OHLCVPoint } from "./types";

/** Pad shorter array with nulls at front to match target length */
function padFront<T>(arr: T[], targetLen: number): (T | null)[] {
  const padding = targetLen - arr.length;
  if (padding <= 0) return arr;
  return [...Array(padding).fill(null), ...arr];
}

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null) return arr[i];
  }
  return null;
}

/**
 * Detect divergence between price and an indicator (RSI or MACD).
 * Bullish: price makes lower low, indicator makes higher low.
 * Bearish: price makes higher high, indicator makes lower high.
 */
function detectDivergence(
  closes: number[],
  indicator: (number | null)[],
  lookback: number = 20,
): "bullish_divergence" | "bearish_divergence" | "none" {
  const n = closes.length;
  if (n < lookback + 5) return "none";

  const slice = closes.slice(-lookback);
  const indSlice = indicator.slice(-lookback);

  // Find local minima and maxima (5-bar pattern: lower-lower-low-higher-higher)
  const minima: { idx: number; price: number; ind: number }[] = [];
  const maxima: { idx: number; price: number; ind: number }[] = [];

  for (let i = 2; i < slice.length - 2; i++) {
    const indVal = indSlice[i];
    if (indVal === null) continue;

    if (slice[i] <= slice[i - 1] && slice[i] <= slice[i - 2] &&
        slice[i] <= slice[i + 1] && slice[i] <= slice[i + 2]) {
      minima.push({ idx: i, price: slice[i], ind: indVal });
    }
    if (slice[i] >= slice[i - 1] && slice[i] >= slice[i - 2] &&
        slice[i] >= slice[i + 1] && slice[i] >= slice[i + 2]) {
      maxima.push({ idx: i, price: slice[i], ind: indVal });
    }
  }

  // Bullish divergence: last two lows — price lower, indicator higher
  if (minima.length >= 2) {
    const prev = minima[minima.length - 2];
    const curr = minima[minima.length - 1];
    if (curr.price < prev.price && curr.ind > prev.ind) {
      return "bullish_divergence";
    }
  }

  // Bearish divergence: last two highs — price higher, indicator lower
  if (maxima.length >= 2) {
    const prev = maxima[maxima.length - 2];
    const curr = maxima[maxima.length - 1];
    if (curr.price > prev.price && curr.ind < prev.ind) {
      return "bearish_divergence";
    }
  }

  return "none";
}

/**
 * Find nearest support/resistance using clustering.
 * Groups nearby levels within 1% and counts touches. 3+ touches = strong.
 */
function findSupportResistance(
  highs: number[],
  lows: number[],
  closes: number[],
): { support: number; resistance: number; supportStrength: number; resistanceStrength: number } {
  const lookback = Math.min(120, closes.length);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);
  const price = closes[closes.length - 1];

  // Collect all potential levels
  const allLevels = [...recentHighs, ...recentLows];

  // Cluster levels within 1% of each other
  const clusters: { center: number; count: number }[] = [];
  const clusterThreshold = 0.01; // 1%

  for (const level of allLevels) {
    let foundCluster = false;
    for (const cluster of clusters) {
      if (Math.abs(level - cluster.center) / cluster.center < clusterThreshold) {
        cluster.center = (cluster.center * cluster.count + level) / (cluster.count + 1);
        cluster.count++;
        foundCluster = true;
        break;
      }
    }
    if (!foundCluster) {
      clusters.push({ center: level, count: 1 });
    }
  }

  // Sort clusters by touch count (strongest first)
  clusters.sort((a, b) => b.count - a.count);

  // Find best support (strongest cluster below price)
  let support = price * 0.95;
  let supportStrength = 0;
  for (const c of clusters) {
    if (c.center < price && c.count >= 2) {
      support = c.center;
      supportStrength = c.count;
      break;
    }
  }

  // Find best resistance (strongest cluster above price)
  let resistance = price * 1.05;
  let resistanceStrength = 0;
  for (const c of clusters) {
    if (c.center > price && c.count >= 2) {
      resistance = c.center;
      resistanceStrength = c.count;
      break;
    }
  }

  return { support, resistance, supportStrength, resistanceStrength };
}

export interface IndicatorParams {
  smaPeriods?: [number, number, number];
  rsiPeriod?: number;
  stochPeriod?: number;
  stochSignalPeriod?: number;
  macdPeriods?: [number, number, number];
  atrPeriod?: number;
  bbPeriod?: number;
  atrStopMultiplier?: number;
  atrTargetMultiplier?: number;
}

export function calculateIndicators(
  closes: number[],
  volumes?: number[],
  highs?: number[],
  lows?: number[],
  params?: IndicatorParams,
): IndicatorResults {
  const len = closes.length;
  const h = highs ?? closes;
  const l = lows ?? closes;

  const smaP = params?.smaPeriods ?? [20, 50, 200];
  const rsiP = params?.rsiPeriod ?? 14;
  const stochP = params?.stochPeriod ?? 14;
  const stochSigP = params?.stochSignalPeriod ?? 3;
  const macdP = params?.macdPeriods ?? [12, 26, 9];
  const atrP = params?.atrPeriod ?? 14;
  const bbP = params?.bbPeriod ?? 20;
  const stopMult = params?.atrStopMultiplier ?? 2;
  const targetMult = params?.atrTargetMultiplier ?? 4;

  // SMA
  const rawSma20 = SMA.calculate({ period: smaP[0], values: closes });
  const rawSma50 = SMA.calculate({ period: smaP[1], values: closes });
  const rawSma200 = SMA.calculate({ period: smaP[2], values: closes });

  // EMA
  const rawEma20 = EMA.calculate({ period: smaP[0], values: closes });

  // RSI
  const rawRsi = RSI.calculate({ period: rsiP, values: closes });

  // Stochastic
  const rawStoch = Stochastic.calculate({
    high: h,
    low: l,
    close: closes,
    period: stochP,
    signalPeriod: stochSigP,
  });

  // ADX
  const rawAdx = ADX.calculate({
    high: h,
    low: l,
    close: closes,
    period: rsiP,
  });

  // ATR
  const rawAtr = ATR.calculate({
    high: h,
    low: l,
    close: closes,
    period: atrP,
  });

  // MACD
  const rawMacd = MACD.calculate({
    values: closes,
    fastPeriod: macdP[0],
    slowPeriod: macdP[1],
    signalPeriod: macdP[2],
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  // Bollinger Bands
  const rawBB = BollingerBands.calculate({
    period: bbP,
    values: closes,
    stdDev: 2,
  });

  // Pad all to match closes length
  const sma20 = padFront(rawSma20, len);
  const sma50 = padFront(rawSma50, len);
  const sma200 = padFront(rawSma200, len);
  const ema20 = padFront(rawEma20, len);
  const rsi14 = padFront(rawRsi, len);
  const adx = padFront(rawAdx.map((a) => a.adx), len);
  const pdi = padFront(rawAdx.map((a) => a.pdi), len);
  const mdi = padFront(rawAdx.map((a) => a.mdi), len);
  const atr14 = padFront(rawAtr, len);

  const stochastic: IndicatorResults["stochastic"] = [
    ...Array(len - rawStoch.length).fill({ k: null, d: null }),
    ...rawStoch.map((s) => ({ k: s.k, d: s.d })),
  ];

  const macd: IndicatorResults["macd"] = [
    ...Array(len - rawMacd.length).fill({ macd: null, signal: null, histogram: null }),
    ...rawMacd.map((m) => ({
      macd: m.MACD ?? null,
      signal: m.signal ?? null,
      histogram: m.histogram ?? null,
    })),
  ];

  const bollingerBands: IndicatorResults["bollingerBands"] = [
    ...Array(len - rawBB.length).fill({ upper: null, middle: null, lower: null }),
    ...rawBB.map((b) => ({
      upper: b.upper,
      middle: b.middle,
      lower: b.lower,
    })),
  ];

  // Support/Resistance with clustering
  const supportResistance = findSupportResistance(h, l, closes);

  // Latest values
  const latestRsi = lastNonNull(rsi14);
  const latestMacd = macd[macd.length - 1];
  const latestBB = bollingerBands[bollingerBands.length - 1];
  const latestStoch = stochastic[stochastic.length - 1];
  const latestAdx = lastNonNull(adx);
  const latestPdi = lastNonNull(pdi);
  const latestMdi = lastNonNull(mdi);
  const latestAtr = lastNonNull(atr14);
  const price = closes[closes.length - 1];

  const latestValues = {
    rsi: latestRsi,
    stochasticK: latestStoch?.k ?? null,
    stochasticD: latestStoch?.d ?? null,
    adx: latestAdx,
    atr: latestAtr,
    atrPercent: latestAtr !== null && price > 0 ? (latestAtr / price) * 100 : null,
    macdLine: latestMacd?.macd ?? null,
    macdSignal: latestMacd?.signal ?? null,
    macdHistogram: latestMacd?.histogram ?? null,
    sma20: lastNonNull(sma20),
    sma50: lastNonNull(sma50),
    sma200: lastNonNull(sma200),
    bollingerUpper: latestBB?.upper ?? null,
    bollingerLower: latestBB?.lower ?? null,
    bollingerMiddle: latestBB?.middle ?? null,
  };

  // ── Signal Generation ──

  const rsiSignal: IndicatorResults["signals"]["rsiSignal"] =
    latestRsi !== null && latestRsi > 70 ? "overbought"
    : latestRsi !== null && latestRsi < 30 ? "oversold"
    : "neutral";

  // Stochastic signal
  let stochasticSignal: IndicatorResults["signals"]["stochasticSignal"] = "neutral";
  if (stochastic.length >= 2) {
    const curr = stochastic[stochastic.length - 1];
    const prev = stochastic[stochastic.length - 2];
    if (curr && prev && curr.k !== null && curr.d !== null && prev.k !== null && prev.d !== null) {
      if (prev.k <= prev.d && curr.k > curr.d && curr.k < 20) stochasticSignal = "bullish_cross";
      else if (prev.k >= prev.d && curr.k < curr.d && curr.k > 80) stochasticSignal = "bearish_cross";
      else if (curr.k > 80) stochasticSignal = "overbought";
      else if (curr.k < 20) stochasticSignal = "oversold";
    }
  }

  // MACD signal
  let macdSignal: IndicatorResults["signals"]["macdSignal"] = "neutral";
  if (macd.length >= 2) {
    const curr = macd[macd.length - 1];
    const prev = macd[macd.length - 2];
    if (curr && prev && curr.macd !== null && curr.signal !== null && prev.macd !== null && prev.signal !== null) {
      if (prev.macd <= prev.signal && curr.macd > curr.signal) macdSignal = "bullish_cross";
      else if (prev.macd >= prev.signal && curr.macd < curr.signal) macdSignal = "bearish_cross";
      else if (curr.histogram !== null && curr.histogram > 0) macdSignal = "bullish";
      else if (curr.histogram !== null && curr.histogram < 0) macdSignal = "bearish";
    }
  }

  // Trend signal
  const s50 = lastNonNull(sma50);
  const s200 = lastNonNull(sma200);
  let trendSignal: IndicatorResults["signals"]["trendSignal"] = "neutral";
  if (s50 !== null && s200 !== null) {
    if (price > s50 && s50 > s200) trendSignal = "strong_uptrend";
    else if (price > s200) trendSignal = "uptrend";
    else if (price < s50 && s50 < s200) trendSignal = "strong_downtrend";
    else if (price < s200) trendSignal = "downtrend";
  }

  // Trend strength via ADX
  const trendStrength: IndicatorResults["signals"]["trendStrength"] =
    latestAdx !== null && latestAdx > 40 ? "strong"
    : latestAdx !== null && latestAdx > 25 ? "moderate"
    : latestAdx !== null && latestAdx > 15 ? "weak"
    : "no_trend";

  // Bollinger signal
  let bollingerSignal: IndicatorResults["signals"]["bollingerSignal"] = "neutral";
  if (latestBB && latestBB.upper !== null && latestBB.lower !== null && latestBB.middle !== null) {
    const bandwidth = (latestBB.upper - latestBB.lower) / (latestBB.middle || 1);
    if (price >= latestBB.upper * 0.99) bollingerSignal = "upper_squeeze";
    else if (price <= latestBB.lower * 1.01) bollingerSignal = "lower_squeeze";
    else if (bandwidth > 0.1) bollingerSignal = "expanding";
  }

  // Volume signal
  let volumeSignal: IndicatorResults["signals"]["volumeSignal"] = "normal";
  if (volumes && volumes.length >= 20) {
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const lastVol = volumes[volumes.length - 1];
    if (lastVol > avgVol * 1.5) volumeSignal = "high_volume";
    else if (lastVol < avgVol * 0.5) volumeSignal = "low_volume";
  }

  // ── New Phase 2 signals ──

  // RSI divergence
  const rsiDivergence = detectDivergence(closes, rsi14);

  // MACD divergence (use MACD line values)
  const macdLines = macd.map((m) => m.macd);
  const macdDivergence = detectDivergence(closes, macdLines);

  // RSI midline crossover (RSI crossing 50)
  let rsiMidlineCross: IndicatorResults["signals"]["rsiMidlineCross"] = "none";
  if (rsi14.length >= 2) {
    const currRsi = rsi14[rsi14.length - 1];
    const prevRsi = rsi14[rsi14.length - 2];
    if (currRsi !== null && prevRsi !== null) {
      if (prevRsi <= 50 && currRsi > 50) rsiMidlineCross = "bullish_cross";
      else if (prevRsi >= 50 && currRsi < 50) rsiMidlineCross = "bearish_cross";
    }
  }

  // MACD histogram momentum (3 consecutive rising/falling bars)
  let macdHistogramMomentum: IndicatorResults["signals"]["macdHistogramMomentum"] = "none";
  if (macd.length >= 4) {
    const h3 = macd[macd.length - 3].histogram;
    const h2 = macd[macd.length - 2].histogram;
    const h1 = macd[macd.length - 1].histogram;
    if (h1 !== null && h2 !== null && h3 !== null) {
      if (h1 > h2 && h2 > h3) macdHistogramMomentum = "accelerating";
      else if (h1 < h2 && h2 < h3) macdHistogramMomentum = "decelerating";
    }
  }

  // Bollinger Squeeze detection: bandwidth in bottom 10th percentile of last 120 bars
  let bollingerSqueeze = false;
  const bbSlice = bollingerBands.slice(-Math.min(120, bollingerBands.length));
  const bandwidths: number[] = [];
  for (const bb of bbSlice) {
    if (bb.upper !== null && bb.lower !== null && bb.middle !== null && bb.middle > 0) {
      bandwidths.push((bb.upper - bb.lower) / bb.middle);
    }
  }
  if (bandwidths.length >= 20) {
    const sorted = [...bandwidths].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const currentBw = bandwidths[bandwidths.length - 1];
    if (currentBw <= p10) bollingerSqueeze = true;
  }

  const signals = {
    rsiSignal, stochasticSignal, macdSignal, trendSignal, trendStrength,
    bollingerSignal, volumeSignal,
    rsiDivergence, macdDivergence, rsiMidlineCross, macdHistogramMomentum, bollingerSqueeze,
  };

  // ── Composite Score Calculation ──
  const compositeScore = calculateCompositeScore(
    price, latestValues, signals, supportResistance,
    latestPdi, latestMdi, trendSignal, stopMult, targetMult,
  );

  return {
    sma20, sma50, sma200, ema20, rsi14, stochastic, adx, atr14, macd, bollingerBands,
    supportResistance, latestValues, signals, compositeScore,
  };
}

/** Calculate composite trading score from -100 to +100 */
function calculateCompositeScore(
  price: number,
  v: IndicatorResults["latestValues"],
  s: IndicatorResults["signals"],
  sr: IndicatorResults["supportResistance"],
  pdiValue: number | null,
  mdiValue: number | null,
  trendSignal: IndicatorResults["signals"]["trendSignal"],
  atrStopMult = 2,
  atrTargetMult = 4,
): CompositeScore {
  // ── Trend Score (-25 to +25) ──
  let trendScore = 0;
  // SMA alignment
  if (v.sma20 && v.sma50 && v.sma200) {
    if (price > v.sma20 && v.sma20 > v.sma50 && v.sma50 > v.sma200) trendScore += 20;
    else if (price > v.sma50 && v.sma50 > v.sma200) trendScore += 12;
    else if (price > v.sma200) trendScore += 5;
    else if (price < v.sma20 && v.sma20 < v.sma50 && v.sma50 < v.sma200) trendScore -= 20;
    else if (price < v.sma50 && v.sma50 < v.sma200) trendScore -= 12;
    else if (price < v.sma200) trendScore -= 5;
  }

  // ADX strength multiplier — FIXED: only amplify when |trendScore| >= 10
  // AND DI+/DI- confirms the trend direction
  if (s.trendStrength === "strong" && Math.abs(trendScore) >= 10) {
    const diConfirms = pdiValue !== null && mdiValue !== null
      ? (trendScore > 0 && pdiValue > mdiValue) || (trendScore < 0 && mdiValue > pdiValue)
      : false;
    if (diConfirms) {
      trendScore = Math.round(trendScore * 1.25);
    }
  } else if (s.trendStrength === "no_trend") {
    trendScore = Math.round(trendScore * 0.3);
  }
  trendScore = Math.max(-25, Math.min(25, trendScore));

  // ── Momentum Score (-25 to +25) ──
  let momentumScore = 0;
  // RSI contribution
  if (v.rsi !== null) {
    if (v.rsi < 30) momentumScore += 10; // Oversold = buy opportunity
    else if (v.rsi > 70) momentumScore -= 10; // Overbought = sell signal
    else if (v.rsi > 50 && v.rsi < 60) momentumScore += 3; // Healthy uptrend
    else if (v.rsi < 50 && v.rsi > 40) momentumScore -= 3;
  }
  // RSI midline cross
  if (s.rsiMidlineCross === "bullish_cross") momentumScore += 3;
  else if (s.rsiMidlineCross === "bearish_cross") momentumScore -= 3;

  // MACD contribution
  if (s.macdSignal === "bullish_cross") momentumScore += 10;
  else if (s.macdSignal === "bearish_cross") momentumScore -= 10;
  else if (s.macdSignal === "bullish") momentumScore += 3;
  else if (s.macdSignal === "bearish") momentumScore -= 3;

  // MACD histogram momentum
  if (s.macdHistogramMomentum === "accelerating") momentumScore += 3;
  else if (s.macdHistogramMomentum === "decelerating") momentumScore -= 3;

  // Stochastic contribution
  if (s.stochasticSignal === "bullish_cross") momentumScore += 5;
  else if (s.stochasticSignal === "bearish_cross") momentumScore -= 5;
  else if (s.stochasticSignal === "oversold") momentumScore += 3;
  else if (s.stochasticSignal === "overbought") momentumScore -= 3;

  // Divergence signals (strong leading indicators)
  if (s.rsiDivergence === "bullish_divergence") momentumScore += 7;
  else if (s.rsiDivergence === "bearish_divergence") momentumScore -= 7;
  if (s.macdDivergence === "bullish_divergence") momentumScore += 7;
  else if (s.macdDivergence === "bearish_divergence") momentumScore -= 7;

  momentumScore = Math.max(-25, Math.min(25, momentumScore));

  // ── Volatility Score (-25 to +25) ──
  let volatilityScore = 0;
  // Bollinger Bands position
  if (s.bollingerSignal === "lower_squeeze") volatilityScore += 12; // Bounce from lower band = buy
  else if (s.bollingerSignal === "upper_squeeze") volatilityScore -= 12;

  // Bollinger Squeeze: imminent breakout → boost in trend direction
  if (s.bollingerSqueeze) {
    const squeezeDirection = trendSignal.includes("up") ? 1 : trendSignal.includes("down") ? -1 : 0;
    volatilityScore += squeezeDirection * 8;
  }

  // Support/Resistance proximity — double bonus for strong levels (3+ touches)
  const distToSupport = (price - sr.support) / price;
  const distToResist = (sr.resistance - price) / price;
  const supportMultiplier = sr.supportStrength >= 3 ? 2 : 1;
  const resistMultiplier = sr.resistanceStrength >= 3 ? 2 : 1;
  if (distToSupport < 0.02) volatilityScore += 8 * supportMultiplier;
  else if (distToResist < 0.02) volatilityScore -= 8 * resistMultiplier;

  // Low ATR = less risk for entry
  if (v.atrPercent !== null && v.atrPercent < 2) volatilityScore += 5;
  else if (v.atrPercent !== null && v.atrPercent > 5) volatilityScore -= 5;
  volatilityScore = Math.max(-25, Math.min(25, volatilityScore));

  // ── Volume Score (-25 to +25) ──
  let volumeScore = 0;
  if (s.volumeSignal === "high_volume") {
    // High volume confirms the trend direction
    if (trendScore > 0) volumeScore += 15;
    else if (trendScore < 0) volumeScore -= 15;
    else volumeScore += 5; // High volume on neutral = something brewing
  } else if (s.volumeSignal === "low_volume") {
    // Low volume = less conviction, dampen signal
    volumeScore = -Math.sign(trendScore) * 5;
  }
  volumeScore = Math.max(-25, Math.min(25, volumeScore));

  // ── Total Score ──
  const score = Math.max(-100, Math.min(100, trendScore + momentumScore + volatilityScore + volumeScore));

  // ── Signal from score ──
  let signal: CompositeScore["signal"];
  if (score >= 50) signal = "STRONG BUY";
  else if (score >= 20) signal = "BUY";
  else if (score <= -50) signal = "STRONG SELL";
  else if (score <= -20) signal = "SELL";
  else signal = "HOLD";

  // ── Confidence from indicator convergence ──
  const bullishCount = [
    trendScore > 5, momentumScore > 5, volatilityScore > 5, volumeScore > 5,
  ].filter(Boolean).length;
  const bearishCount = [
    trendScore < -5, momentumScore < -5, volatilityScore < -5, volumeScore < -5,
  ].filter(Boolean).length;
  const convergence = Math.max(bullishCount, bearishCount);

  let confidence: CompositeScore["confidence"];
  if (convergence >= 3 && Math.abs(score) >= 40) confidence = "hoch";
  else if (convergence >= 2 && Math.abs(score) >= 20) confidence = "mittel";
  else confidence = "niedrig";

  // ── Kelly Criterion position size ──
  const estimatedWinRate = 0.5 + (convergence * 0.05) + (Math.abs(score) / 400);
  const estimatedPayoff = 2.0;
  const kelly = (estimatedWinRate * estimatedPayoff - (1 - estimatedWinRate)) / estimatedPayoff;
  const kellySize = Math.max(0, Math.min(0.25, kelly * 0.5)); // Half-Kelly, max 25%

  // ── ATR-based entry/stop/target ──
  const atr = v.atr ?? price * 0.02;
  const isBullish = score > 0;
  const suggestedStop = isBullish
    ? Math.round((price - atr * atrStopMult) * 100) / 100
    : Math.round((price + atr * atrStopMult) * 100) / 100;
  const suggestedEntry = Math.round(price * 100) / 100;
  const suggestedTarget = isBullish
    ? Math.round((price + atr * atrTargetMult) * 100) / 100
    : Math.round((price - atr * atrTargetMult) * 100) / 100;

  return {
    score,
    signal,
    confidence,
    convergence,
    breakdown: { trend: trendScore, momentum: momentumScore, volatility: volatilityScore, volume: volumeScore },
    kellySize: Math.round(kellySize * 1000) / 10,
    suggestedStop,
    suggestedTarget,
    suggestedEntry,
  };
}
