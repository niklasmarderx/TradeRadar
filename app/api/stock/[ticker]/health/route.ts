import { NextResponse } from "next/server";
import { fetchFundamentals, fetchFinancialStatements } from "@/lib/api/yahoo-finance";
import {
  calculateAltmanZ,
  calculatePiotroskiF,
  calculateInterestCoverage,
  assessDividendSafety,
  calculateHealthGrade,
} from "@/lib/financial-health";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  const [fundamentals, statements] = await Promise.all([
    fetchFundamentals(ticker),
    fetchFinancialStatements(ticker),
  ]);

  if (!fundamentals) {
    return NextResponse.json(
      { error: "Keine Fundamentaldaten verfuegbar" },
      { status: 404 }
    );
  }

  const altmanZ = statements
    ? calculateAltmanZ(statements, fundamentals.marketCap)
    : null;

  const piotroskiF = statements
    ? calculatePiotroskiF(statements)
    : null;

  const interestCoverage = statements
    ? calculateInterestCoverage(statements.ebit, statements.interestExpense)
    : null;

  const dividendSafety = assessDividendSafety(
    fundamentals.dividendYield,
    fundamentals.payoutRatio,
    fundamentals.fiveYearAvgDividendYield
  );

  const healthGrade = calculateHealthGrade(
    altmanZ,
    piotroskiF,
    interestCoverage,
    fundamentals.currentRatio
  );

  // 52W high/low passed to client — it calculates position from current price
  return NextResponse.json({
    altmanZ,
    piotroskiF: piotroskiF ? { score: piotroskiF.score, criteria: piotroskiF.criteria, labels: piotroskiF.labels } : null,
    interestCoverage,
    currentRatio: fundamentals.currentRatio,
    quickRatio: fundamentals.quickRatio,
    healthGrade,
    dividendSafety,
    fiftyTwoWeekHigh: fundamentals.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: fundamentals.fiftyTwoWeekLow,
  });
}
