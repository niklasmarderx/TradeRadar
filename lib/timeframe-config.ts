/**
 * Timeframe Configuration — Central config for short/medium/long scan modes.
 * All timeframe-dependent parameters in one place.
 */

export type ScanTimeframe = "short" | "medium" | "long";

export interface TimeframeConfig {
  label: string;
  holdingPeriod: string;
  // Indicator periods
  smaPeriods: [number, number, number];
  rsiPeriod: number;
  stochPeriod: number;
  stochSignalPeriod: number;
  macdPeriods: [number, number, number]; // [fast, slow, signal]
  atrPeriod: number;
  bbPeriod: number;
  // ATR multipliers for entry/stop/target
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  // Scenario multipliers (bull/base/bear)
  scenarioBull: number;
  scenarioBase: number;
  scenarioBear: number;
  // Data config
  dataYears: number;
  minDataPoints: number;
}

const CONFIGS: Record<ScanTimeframe, TimeframeConfig> = {
  short: {
    label: "Kurzfristig",
    holdingPeriod: "1-5 Tage",
    smaPeriods: [10, 20, 50],
    rsiPeriod: 7,
    stochPeriod: 7,
    stochSignalPeriod: 3,
    macdPeriods: [8, 17, 9],
    atrPeriod: 7,
    bbPeriod: 10,
    atrStopMultiplier: 1.5,
    atrTargetMultiplier: 3,
    scenarioBull: 4,
    scenarioBase: 3,
    scenarioBear: 1.5,
    dataYears: 1,
    minDataPoints: 20,
  },
  medium: {
    label: "Mittelfristig",
    holdingPeriod: "2-8 Wochen",
    smaPeriods: [20, 50, 200],
    rsiPeriod: 14,
    stochPeriod: 14,
    stochSignalPeriod: 3,
    macdPeriods: [12, 26, 9],
    atrPeriod: 14,
    bbPeriod: 20,
    atrStopMultiplier: 2,
    atrTargetMultiplier: 4,
    scenarioBull: 6,
    scenarioBase: 4,
    scenarioBear: 1.5,
    dataYears: 2,
    minDataPoints: 50,
  },
  long: {
    label: "Langfristig",
    holdingPeriod: "3-12 Monate",
    smaPeriods: [50, 100, 200],
    rsiPeriod: 21,
    stochPeriod: 21,
    stochSignalPeriod: 5,
    macdPeriods: [19, 39, 9],
    atrPeriod: 21,
    bbPeriod: 30,
    atrStopMultiplier: 3,
    atrTargetMultiplier: 6,
    scenarioBull: 8,
    scenarioBase: 6,
    scenarioBear: 2,
    dataYears: 5,
    minDataPoints: 200,
  },
};

export function getTimeframeConfig(tf: ScanTimeframe): TimeframeConfig {
  return CONFIGS[tf];
}

export function isValidTimeframe(s: string): s is ScanTimeframe {
  return s === "short" || s === "medium" || s === "long";
}
