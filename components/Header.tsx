import Link from "next/link";
import MarketPhase from "@/components/MarketPhase";
import SearchBar from "@/components/SearchBar";
import NotificationSettings from "@/components/NotificationSettings";

interface HeaderProps {
  marketPhase: "bullish" | "bearish" | "neutral" | "volatile";
  updated: string;
}

export default function Header({ marketPhase, updated }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-card-border bg-background/95 backdrop-blur-sm px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <h1 className="text-lg font-bold tracking-tight text-bright">
              TradeRadar
            </h1>
          </Link>
          <MarketPhase phase={marketPhase} />
          <Link
            href="/screener"
            className="hidden sm:block text-[10px] text-muted hover:text-accent uppercase tracking-wider transition-colors"
          >
            Screener
          </Link>
          <Link
            href="/heatmap"
            className="hidden sm:block text-[10px] text-muted hover:text-accent uppercase tracking-wider transition-colors"
          >
            Heatmap
          </Link>
          <Link
            href="/lists"
            className="hidden sm:block text-[10px] text-muted hover:text-accent uppercase tracking-wider transition-colors"
          >
            Listen
          </Link>
          <Link
            href="/smart-money"
            className="hidden sm:block text-[10px] text-muted hover:text-accent uppercase tracking-wider transition-colors"
          >
            Smart Money
          </Link>
          <Link
            href="/picks"
            className="hidden sm:block text-[10px] text-muted hover:text-accent uppercase tracking-wider transition-colors"
          >
            Picks
          </Link>
          <Link
            href="/portfolio"
            className="hidden sm:block text-[10px] text-muted hover:text-accent uppercase tracking-wider transition-colors"
          >
            Portfolio
          </Link>
          <Link
            href="/archive"
            className="hidden sm:block text-[10px] text-muted hover:text-accent uppercase tracking-wider transition-colors"
          >
            Archiv
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar />
          <NotificationSettings />
          <span className="hidden sm:block text-xs text-muted font-mono-num">
            {updated}
          </span>
        </div>
      </div>
    </header>
  );
}
