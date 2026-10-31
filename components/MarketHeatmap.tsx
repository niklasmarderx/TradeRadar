"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import type { HeatmapSector, HeatmapTile } from "@/app/api/heatmap/route";

interface MarketHeatmapProps {
  initialData?: { sectors: HeatmapSector[]; meta: { total: number; scannedAt: string } };
}

function scoreToColor(score: number): string {
  if (score >= 50) return "#22c55e";
  if (score >= 20) return "#16a34a";
  if (score >= 5) return "rgba(34,197,94,0.4)";
  if (score > -5) return "#4b5563";
  if (score >= -20) return "rgba(239,68,68,0.4)";
  if (score >= -50) return "#dc2626";
  return "#ef4444";
}

function scoreToTextColor(score: number): string {
  if (score >= 20 || score <= -20) return "#ffffff";
  return "#d1d5db";
}

interface CustomTreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  score?: number;
  signal?: string;
  grade?: string;
  depth?: number;
  index?: number;
  root?: { name: string };
}

function CustomContent(props: CustomTreemapContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, name, score = 0, grade, depth } = props;

  if (depth !== 1 || width < 2 || height < 2) return null;

  const isCrypto = props.root?.name === "Crypto";
  const color = scoreToColor(score);
  const textColor = scoreToTextColor(score);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        fill={color}
        stroke={isCrypto ? "#f59e0b" : "#1a2235"}
        strokeWidth={isCrypto ? 1.5 : 1}
        style={{ cursor: "pointer" }}
      />
      {width > 45 && height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (height > 40 ? 6 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          fontSize={width > 80 ? 11 : 9}
          fontWeight="bold"
          fontFamily="var(--font-geist-mono)"
        >
          {name}
        </text>
      )}
      {width > 45 && height > 40 && grade && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          fontSize={9}
          fontFamily="var(--font-geist-mono)"
          opacity={0.8}
        >
          {grade} | {score > 0 ? "+" : ""}{score}
        </text>
      )}
    </g>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: HeatmapTile & { root?: { name: string } } }[];
}

function HeatmapTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  const fmt = (n: number) =>
    n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-card border border-card-border rounded-lg p-3 shadow-lg text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono-num font-bold text-bright">{data.name}</span>
        {data.grade && (
          <span className="text-accent font-bold">{data.grade}</span>
        )}
      </div>
      <p className="text-sub text-[10px] mb-1">{data.fullName}</p>
      <div className="flex items-center gap-3">
        <span className="font-mono-num text-foreground">{fmt(data.price)} €</span>
        <span className={`font-bold ${data.score >= 0 ? "text-up" : "text-down"}`}>
          {data.signal}
        </span>
        <span className="font-mono-num text-muted">Score: {data.score > 0 ? "+" : ""}{data.score}</span>
      </div>
    </div>
  );
}

export default function MarketHeatmap({ initialData }: MarketHeatmapProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [sizeMode, setSizeMode] = useState<"marketcap" | "equal">("marketcap");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/heatmap");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) fetchData();
  }, [initialData, fetchData]);

  if (loading || !data) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-8">
        <div className="flex items-center justify-center gap-3 text-muted">
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="text-sm">Heatmap wird geladen...</span>
        </div>
      </div>
    );
  }

  if (data.sectors.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-8 text-center text-muted text-sm">
        Keine Scanner-Daten verfügbar. Starte einen Scan für die Heatmap.
      </div>
    );
  }

  // Flatten to recharts nested treemap format
  const treemapData = data.sectors.map((sector) => ({
    name: sector.name,
    children: sector.children.map((tile) => ({
      ...tile,
      value: sizeMode === "equal" ? 1 : Math.max(tile.value, 1),
    })),
  }));

  // Summary stats
  const allTiles = data.sectors.flatMap((s) => s.children);
  const bullish = allTiles.filter((t) => t.score > 5).length;
  const bearish = allTiles.filter((t) => t.score < -5).length;
  const neutral = allTiles.length - bullish - bearish;

  function handleClick(node: HeatmapTile) {
    if (!node?.name) return;
    const ticker = node.name.includes("-") ? node.name + "-USD" : node.name;
    router.push(`/stock/${ticker}`);
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted">{allTiles.length} Aktien in {data.sectors.length} Sektoren</span>
          <span className="text-up">{bullish} bullish</span>
          <span className="text-muted">{neutral} neutral</span>
          <span className="text-down">{bearish} bearish</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSizeMode("marketcap")}
            className={`px-2 py-1 text-[10px] rounded border transition-colors ${
              sizeMode === "marketcap"
                ? "border-accent text-accent bg-accent/10"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            Marktkapitalisierung
          </button>
          <button
            onClick={() => setSizeMode("equal")}
            className={`px-2 py-1 text-[10px] rounded border transition-colors ${
              sizeMode === "equal"
                ? "border-accent text-accent bg-accent/10"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            Gleichgewicht
          </button>
          <button
            onClick={fetchData}
            className="px-2 py-1 text-[10px] text-muted hover:text-accent border border-card-border rounded transition-colors"
            title="Aktualisieren"
          >
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Sector legend */}
      <div className="flex flex-wrap items-center gap-2">
        {data.sectors.map((sector) => {
          const avgScore = sector.children.reduce((s, c) => s + c.score, 0) / sector.children.length;
          return (
            <span
              key={sector.name}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-background border border-card-border rounded"
            >
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ backgroundColor: scoreToColor(avgScore) }}
              />
              <span className="text-sub">{sector.name}</span>
              <span className="font-mono-num text-muted">({sector.children.length})</span>
            </span>
          );
        })}
      </div>

      {/* Treemap */}
      <div className="bg-card border border-card-border rounded-lg p-2 overflow-hidden">
        <ResponsiveContainer width="100%" height={500}>
          <Treemap
            data={treemapData}
            dataKey="value"
            nameKey="name"
            stroke="none"
            content={<CustomContent />}
            onClick={(node: Record<string, unknown>) => handleClick(node as unknown as HeatmapTile)}
          >
            <Tooltip content={<HeatmapTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Color legend */}
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted">
        <span>Bearish</span>
        <div className="flex gap-0.5">
          {[-70, -35, -10, 0, 10, 35, 70].map((s) => (
            <span
              key={s}
              className="inline-block w-5 h-3 rounded-sm"
              style={{ backgroundColor: scoreToColor(s) }}
            />
          ))}
        </div>
        <span>Bullish</span>
      </div>
    </div>
  );
}
