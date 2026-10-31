import { Index } from "@/lib/types";

function TickerItem({ index }: { index: Index }) {
  const color = index.direction === "up" ? "text-up" : "text-down";
  const arrow = index.direction === "up" ? "\u25B2" : "\u25BC";
  return (
    <div className="flex items-center gap-2 px-5 whitespace-nowrap">
      <span className="text-xs text-muted font-semibold">{index.symbol}</span>
      <span className="font-mono-num text-sm">{index.value}</span>
      <span className={`font-mono-num text-xs ${color}`}>
        {arrow} {index.change}
      </span>
    </div>
  );
}

function Separator() {
  return <span className="text-card-border px-1">|</span>;
}

export default function TickerBar({ indices }: { indices: Index[] }) {
  const items = [...indices, ...indices, ...indices];
  return (
    <div className="w-full overflow-hidden bg-secondary/50 border-y border-card-border py-2">
      <div className="flex items-center ticker-animate" style={{ width: "max-content" }}>
        {items.map((idx, i) => (
          <div key={`${idx.symbol}-${i}`} className="flex items-center">
            {i > 0 && i % indices.length === 0 && <Separator />}
            <TickerItem index={idx} />
            {(i + 1) % indices.length !== 0 && <Separator />}
          </div>
        ))}
      </div>
    </div>
  );
}
