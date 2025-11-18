import { useMemo } from "react";

import type { ChartBalancePointVM } from "@/types/dashboard";

interface BalancesChartProps {
  readonly points: ChartBalancePointVM[] | undefined;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 400;
const PADDING_LEFT = 80;
const PADDING_RIGHT = 20;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 40;
const CHART_WIDTH = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
const BALANCE_COLOR = "#2563eb";

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

const formatMonthLabel = (value: string | Date, short = false) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return String(value);
  }
  if (short) {
    return date.toLocaleDateString("pl-PL", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
};

export function BalancesChart({ points }: BalancesChartProps) {
  const computed = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    const normalized = points.map((point) => {
      return {
        month: point.month,
        label: formatMonthLabel(point.month),
        shortLabel: formatMonthLabel(point.month, true),
        value: Number(point.totalRemaining ?? 0),
      };
    });

    const values = normalized.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const stepX =
      normalized.length > 1 ? CHART_WIDTH / (normalized.length - 1) : 0;

    const coordinates = normalized.map((point, index) => {
      const x = PADDING_LEFT + index * stepX;
      const percent = (point.value - minValue) / range;
      const y = PADDING_TOP + CHART_HEIGHT - percent * CHART_HEIGHT;
      return {
        x,
        y,
        month: point.month,
        label: point.label,
        shortLabel: point.shortLabel,
        value: point.value,
      };
    });

    // Y-axis ticks (7 values)
    const yTicks = Array.from({ length: 7 }, (_, i) => {
      const value = minValue + (range * i) / 6;
      const y = PADDING_TOP + CHART_HEIGHT - ((value - minValue) / range) * CHART_HEIGHT;
      return { value, y };
    });

    // X-axis ticks (show every nth month to avoid crowding)
    const xTickInterval = Math.max(1, Math.floor(normalized.length / 7));
    const xTicks = normalized
      .map((point, index) => ({
        index,
        x: PADDING_LEFT + index * stepX,
        label: point.shortLabel,
      }))
      .filter((_, i) => i % xTickInterval === 0 || i === normalized.length - 1);

    const linePoints = coordinates
      .map((point) => `${point.x},${point.y}`)
      .join(" ");
    const lastCoordinate = coordinates[coordinates.length - 1];
    const firstCoordinate = coordinates[0];
    const chartBottom = PADDING_TOP + CHART_HEIGHT;
    const areaPoints = `${linePoints} ${lastCoordinate?.x ?? PADDING_LEFT},${chartBottom} ${firstCoordinate?.x ?? PADDING_LEFT},${chartBottom}`;

    return {
      coordinates,
      linePoints,
      areaPoints,
      yTicks,
      xTicks,
      chartBottom,
      minValue,
      maxValue,
    };
  }, [points]);

  if (!computed) {
    return null;
  }

  return (
    <svg
      role="img"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="h-auto w-full"
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
      
      {/* Y-axis */}
      <line
        x1={PADDING_LEFT}
        y1={PADDING_TOP}
        x2={PADDING_LEFT}
        y2={computed.chartBottom}
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      
      {/* X-axis */}
      <line
        x1={PADDING_LEFT}
        y1={computed.chartBottom}
        x2={SVG_WIDTH - PADDING_RIGHT}
        y2={computed.chartBottom}
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      
      {/* Y-axis ticks and labels */}
      {computed.yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={PADDING_LEFT - 5}
            y1={tick.y}
            x2={PADDING_LEFT}
            y2={tick.y}
            stroke="#9ca3af"
            strokeWidth={1}
          />
          <line
            x1={PADDING_LEFT}
            y1={tick.y}
            x2={SVG_WIDTH - PADDING_RIGHT}
            y2={tick.y}
            stroke="#f3f4f6"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
          <text
            x={PADDING_LEFT - 10}
            y={tick.y}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-xs fill-gray-600"
            style={{ fontSize: '10px' }}
          >
            {currencyFormatter.format(tick.value)}
          </text>
        </g>
      ))}
      
      {/* X-axis ticks and labels */}
      {computed.xTicks.map((tick) => (
        <g key={tick.index}>
          <line
            x1={tick.x}
            y1={computed.chartBottom}
            x2={tick.x}
            y2={computed.chartBottom + 5}
            stroke="#9ca3af"
            strokeWidth={1}
          />
          <text
            x={tick.x}
            y={computed.chartBottom + 20}
            textAnchor="middle"
            className="text-xs fill-gray-600"
            style={{ fontSize: '10px' }}
          >
            {tick.label}
          </text>
        </g>
      ))}
      
      <polygon points={computed.areaPoints} fill="url(#balanceGradient)" />
      <polyline
        points={computed.linePoints}
        fill="none"
        stroke={BALANCE_COLOR}
        strokeWidth={2}
      />
      {computed.coordinates.map((point, i) => (
        <g key={i}>
          <circle cx={point.x} cy={point.y} r={4} fill={BALANCE_COLOR}>
            <title>{`${point.label}: ${currencyFormatter.format(point.value)}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
