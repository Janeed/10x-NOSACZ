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

// Color palette for different loans
const LOAN_COLORS = [
  "#2563eb", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

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
    return date.toLocaleDateString("pl-PL", {
      month: "short",
      year: "2-digit",
    });
  }
  return date.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
};

export function BalancesChart({ points }: BalancesChartProps) {
  const computed = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    // Extract all unique loan IDs with their amounts
    const allLoanIds = new Set<string>();
    const loanAmounts = new Map<string, number>();
    points.forEach((point) => {
      point.loans?.forEach((loan) => {
        allLoanIds.add(loan.loanId);
        if (!loanAmounts.has(loan.loanId)) {
          loanAmounts.set(loan.loanId, loan.loanAmount);
        }
      });
    });
    const loanIds = Array.from(allLoanIds);

    // Find global min/max across all loans
    let minValue = Infinity;
    let maxValue = 0;
    points.forEach((point) => {
      const totalRemaining = point.totalRemaining || 0;
      if (totalRemaining > 0) {
        maxValue = Math.max(maxValue, totalRemaining);
      }
      point.loans?.forEach((loan) => {
        if (loan.remaining > 0) {
          minValue = Math.min(minValue, loan.remaining);
          maxValue = Math.max(maxValue, loan.remaining);
        }
      });
    });
    if (minValue === Infinity) minValue = 0;
    const range = maxValue - minValue || 1;

    const stepX = points.length > 1 ? CHART_WIDTH / (points.length - 1) : 0;

    // Build coordinates for each loan
    const loanLines: Record<
      string,
      {
        x: number;
        y: number;
        value: number;
        month: string;
        label: string;
        loanAmount: number;
      }[]
    > = {};
    loanIds.forEach((loanId) => {
      loanLines[loanId] = [];
    });

    points.forEach((point, index) => {
      const x = PADDING_LEFT + index * stepX;
      point.loans?.forEach((loan) => {
        const percent = (loan.remaining - minValue) / range;
        const y = PADDING_TOP + CHART_HEIGHT - percent * CHART_HEIGHT;
        loanLines[loan.loanId].push({
          x,
          y,
          value: loan.remaining,
          month: point.month,
          label: formatMonthLabel(point.month),
          loanAmount: loan.loanAmount,
        });
      });
    });

    // Build path strings for each loan
    const loanPaths = loanIds
      .map((loanId, index) => {
        const coords = loanLines[loanId];
        if (coords.length === 0) return null;
        const pathString = coords.map((c) => `${c.x},${c.y}`).join(" ");
        return {
          loanId,
          color: LOAN_COLORS[index % LOAN_COLORS.length],
          pathString,
          coordinates: coords,
        };
      })
      .filter(Boolean);

    // Y-axis ticks (7 values)
    const yTicks = Array.from({ length: 7 }, (_, i) => {
      const value = minValue + (range * i) / 6;
      const y =
        PADDING_TOP +
        CHART_HEIGHT -
        ((value - minValue) / range) * CHART_HEIGHT;
      return { value, y };
    });

    // X-axis ticks
    const xTickInterval = Math.max(1, Math.floor(points.length / 7));
    const xTicks = points
      .map((point, index) => ({
        index,
        x: PADDING_LEFT + index * stepX,
        label: formatMonthLabel(point.month, true),
      }))
      .filter((_, i) => i % xTickInterval === 0 || i === points.length - 1);

    return {
      loanPaths,
      yTicks,
      xTicks,
      chartBottom: PADDING_TOP + CHART_HEIGHT,
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
            style={{ fontSize: "10px" }}
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
            style={{ fontSize: "10px" }}
          >
            {tick.label}
          </text>
        </g>
      ))}

      {/* Draw a line for each loan */}
      {computed.loanPaths.map((loanPath, index) => (
        <g key={loanPath?.loanId || index}>
          {loanPath && (
            <>
              <polyline
                points={loanPath.pathString}
                fill="none"
                stroke={loanPath.color}
                strokeWidth={2}
              />
              {loanPath.coordinates.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill={loanPath.color}
                >
                  <title>{`Loan ${currencyFormatter.format(point.loanAmount)}: ${point.label} - ${currencyFormatter.format(point.value)}`}</title>
                </circle>
              ))}
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
