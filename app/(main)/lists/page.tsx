import Link from "next/link";
import { CURATED_LISTS, getCategoryLabel, type CuratedList } from "@/lib/curated-lists";

export const metadata = {
  title: "Aktien-Listen — TradeRadar",
  description: "Kuratierte Aktien-Listen nach Thema, Strategie und Region",
};

const ICON_COLORS: Record<string, string> = {
  AI: "bg-accent/15 text-accent border-accent/25",
  CHIP: "bg-purple/15 text-purple border-purple/25",
  GROWTH: "bg-up/15 text-up border-up/25",
  SOLAR: "bg-gold/15 text-gold border-gold/25",
  BIO: "bg-info/15 text-info border-info/25",
  ROCKET: "bg-sub/15 text-sub border-sub/25",
  DIV: "bg-up/15 text-up border-up/25",
  VALUE: "bg-accent/15 text-accent border-accent/25",
  DE: "bg-gold/15 text-gold border-gold/25",
  EU: "bg-info/15 text-info border-info/25",
  COIN: "bg-gold/15 text-gold border-gold/25",
  DEFI: "bg-purple/15 text-purple border-purple/25",
  SHORT: "bg-down/15 text-down border-down/25",
};

function ListCard({ list }: { list: CuratedList }) {
  return (
    <Link
      href={`/lists/${list.id}`}
      className="bg-card border border-card-border rounded-lg p-4 card-interactive block"
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-[10px] font-bold border ${
            ICON_COLORS[list.icon] ?? "bg-muted/15 text-muted border-muted/25"
          }`}
        >
          {list.icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-bright truncate">{list.name}</h3>
          <p className="text-[10px] text-sub mt-0.5">{list.description}</p>
          <p className="text-[10px] text-muted mt-1">{list.tickers.length} Aktien</p>
        </div>
      </div>
    </Link>
  );
}

export default function ListsPage() {
  const categories: CuratedList["category"][] = ["thematic", "strategy", "regional", "crypto"];

  return (
    <div className="space-y-8">
      {categories.map((cat) => {
        const lists = CURATED_LISTS.filter((l) => l.category === cat);
        if (lists.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-3 section-header">
              {getCategoryLabel(cat)}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {lists.map((l) => (
                <ListCard key={l.id} list={l} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
