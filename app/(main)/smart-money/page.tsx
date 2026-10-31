import SmartMoney from "@/components/SmartMoney";
import { fetchCongressTrades } from "@/lib/api/smart-money";

export const dynamic = "force-dynamic";

export default async function SmartMoneyPage() {
  let trades: Awaited<ReturnType<typeof fetchCongressTrades>>;
  try {
    trades = await fetchCongressTrades();
  } catch {
    trades = [];
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-bright">
          Smart Money Tracker
        </h2>
        <span className="text-[10px] text-muted">
          Politiker-Trades · Whale Portfolios · Insider
        </span>
      </div>
      <SmartMoney initialCongress={trades} />
    </section>
  );
}
