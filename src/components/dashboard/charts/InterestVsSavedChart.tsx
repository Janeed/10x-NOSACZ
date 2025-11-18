import { useMemo } from "react";

import type { ChartInterestPointVM } from "@/types/dashboard";

interface InterestVsSavedChartProps {
  readonly points: ChartInterestPointVM[] | undefined;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 400;
const PADDING_LEFT = 80;
const PADDING_RIGHT = 20;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 40;
const CHART_WIDTH = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
const INTEREST_COLOR = "#1f2937"; // slate-800
const SAVED_COLOR = "#10b981"; // emerald-500

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

export function InterestVsSavedChart({ points }: InterestVsSavedChartProps) {
  const computed = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    const normalized = points.map((point) => {
      return {
        month: point.month,
        label: formatMonthLabel(point.month),
        shortLabel: formatMonthLabel(point.month, true),
        interest: Number(point.interest ?? 0),
        saved: Number(point.interestSaved ?? 0),
      };
    });

    const maxInterest = Math.max(...normalized.map((point) => point.interest));
    const maxSaved = Math.max(...normalized.map((point) => point.saved));
    const maxValue = Math.max(maxInterest, maxSaved, 1);
    const stepX =
      normalized.length > 1 ? CHART_WIDTH / (normalized.length - 1) : 0;

    const coordinates = normalized.map((point, index) => {
      const x = PADDING_LEFT + index * stepX;
      const interestPercent = point.interest / maxValue;
      const savedPercent = point.saved / maxValue;
      const interestY = PADDING_TOP + CHART_HEIGHT - interestPercent * CHART_HEIGHT;
      const savedY = PADDING_TOP + CHART_HEIGHT - savedPercent * CHART_HEIGHT;
      return {
        x,
        month: point.month,
        label: point.label,
        shortLabel: point.shortLabel,
        interestValue: point.interest,
        savedValue: point.saved,
        interestY,
        savedY,
      };
    });

    // Y-axis ticks (7 values)
    const yTicks = Array.from({ length: 7 }, (_, i) => {
      const value = (maxValue * i) / 6;
      const y = PADDING_TOP + CHART_HEIGHT - (value / maxValue) * CHART_HEIGHT;
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

    const buildPath = (
      extractor: (coord: (typeof coordinates)[number]) => number,
    ) => {
      return coordinates
        .map((coord) => `${coord.x},${extractor(coord)}`)
        .join(" ");
    };

    return {
      coordinates,
      interestPath: buildPath((coord) => coord.interestY),
      savedPath: buildPath((coord) => coord.savedY),
      yTicks,
      xTicks,
      chartBottom: PADDING_TOP + CHART_HEIGHT,
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
      <title>Monthly interest versus interest saved</title>
      <desc>
        Compares projected monthly interest charges against the interest saved
        by the active strategy.
      </desc>
      
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
      
      <polyline
        points={computed.interestPath}
        fill="none"
        stroke={INTEREST_COLOR}
        strokeWidth={2}
      />
      <polyline
        points={computed.savedPath}
        fill="none"
        stroke={SAVED_COLOR}
        strokeWidth={2}
      />
      {computed.coordinates.map((coord, i) => (
        <g key={i}>
          <circle
            cx={coord.x}
            cy={coord.interestY}
            r={4}
            fill={INTEREST_COLOR}
          >
            <title>
              {`${coord.label}: Odsetki ${currencyFormatter.format(coord.interestValue)}, Zaoszczędzone ${currencyFormatter.format(coord.savedValue)}`}
            </title>
          </circle>
          <circle cx={coord.x} cy={coord.savedY} r={4} fill={SAVED_COLOR}>
            <title>
              {`${coord.label}: Odsetki ${currencyFormatter.format(coord.interestValue)}, Zaoszczędzone ${currencyFormatter.format(coord.savedValue)}`}
            </title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
