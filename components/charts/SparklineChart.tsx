"use client";

import { SparklinePoint } from "@/lib/types";
import { LineChart, Line, YAxis } from "recharts";

interface SparklineChartProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color?: string;
}

export default function SparklineChart({
  data,
  width = 120,
  height = 32,
  color,
}: SparklineChartProps) {
  if (!data || data.length < 2) return null;

  const trend = data[data.length - 1].value >= data[0].value;
  const strokeColor = color ?? (trend ? "#22c55e" : "#ef4444");

  return (
    <div style={{ width, height }} className="pointer-events-none">
      <LineChart width={width} height={height} data={data}>
        <YAxis domain={["dataMin", "dataMax"]} hide />
        <Line
          type="monotone"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  );
}
