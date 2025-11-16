import { useMemo } from "react";

import type { ChartBalancePointVM } from "@/types/dashboard";

interface BalancesChartProps {
  readonly points: ChartBalancePointVM[] | undefined;
}

const SVG_WIDTH = 640;
const SVG_HEIGHT = 240;
const BALANCE_COLOR = "#2563eb";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatMonthLabel = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return String(value);
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

export function BalancesChart({ points }: BalancesChartProps) {
  const computed = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    const normalized = points.map((point) => {
      return {
        label: formatMonthLabel(point.month),
        value: Number(point.totalRemaining ?? 0),
      };
    });

    const values = normalized.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const stepX =
      normalized.length > 1 ? SVG_WIDTH / (normalized.length - 1) : 0;

    const coordinates = normalized.map((point, index) => {
      const x = index * stepX;
      const percent = (point.value - minValue) / range;
      const y = SVG_HEIGHT - percent * SVG_HEIGHT;
      return {
        x,
        y,
        label: point.label,
        value: point.value,
      };
    });

    const linePoints = coordinates
      .map((point) => `${point.x},${point.y}`)
      .join(" ");
    const lastCoordinate = coordinates[coordinates.length - 1];
    const areaPoints = `${linePoints} ${lastCoordinate?.x ?? 0},${SVG_HEIGHT} 0,${SVG_HEIGHT}`;

    return {
      coordinates,
      linePoints,
      areaPoints,
    };
  }, [points]);

  if (!computed) {
    return null;
  }

  return (
    <svg
      role="img"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="h-60 w-full"
      preserveAspectRatio="none"
    >
      <title>Remaining balance trend over upcoming months</title>
      <desc>
        Visualizes projected remaining balances for each month under the active
        strategy.
      </desc>
      <defs>
        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BALANCE_COLOR} stopOpacity={0.25} />
          <stop offset="100%" stopColor={BALANCE_COLOR} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={computed.areaPoints} fill="url(#balanceGradient)" />
      <polyline
        points={computed.linePoints}
        fill="none"
        stroke={BALANCE_COLOR}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {computed.coordinates.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r={4} fill={BALANCE_COLOR} />
          <title>{`${point.label}: ${currencyFormatter.format(point.value)}`}</title>
        </g>
      ))}
    </svg>
  );
}
