import MarketHeatmap from "@/components/MarketHeatmap";

export const metadata = {
  title: "Market Heatmap — TradeRadar",
  description: "Treemap-Visualisierung aller gescannten Aktien nach Sektor",
};

export default function HeatmapPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest section-header">
        Market Heatmap
      </h2>
      <MarketHeatmap />
    </div>
  );
}
