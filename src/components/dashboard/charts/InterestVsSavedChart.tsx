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

// Color palette for different loans (interest)
const INTEREST_COLORS = [
  "#1f2937", // slate-800
  "#7c2d12", // amber-900
  "#7f1d1d", // red-900
  "#4c1d95", // violet-900
  "#831843", // pink-900
  "#164e63", // cyan-900
];

// Color palette for different loans (saved)
const SAVED_COLORS = [
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
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
    return date.toLocaleDateString("pl-PL", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
};

export function InterestVsSavedChart({ points }: InterestVsSavedChartProps) {
  const computed = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    // Extract all unique loan IDs
    const allLoanIds = new Set<string>();
    points.forEach(point => {
      point.loans?.forEach(loan => allLoanIds.add(loan.loanId));
    });
    const loanIds = Array.from(allLoanIds);

    // Find global max across all loans
    let maxValue = 0;
    points.forEach(point => {
      point.loans?.forEach(loan => {
        maxValue = Math.max(maxValue, loan.interest, loan.interestSaved);
      });
    });
    if (maxValue === 0) maxValue = 1;

    const stepX = points.length > 1 ? CHART_WIDTH / (points.length - 1) : 0;

    // Build coordinates for each loan (interest and saved)
    const loanInterestLines: Record<string, Array<{ x: number; y: number; value: number; month: string; label: string }>> = {};
    const loanSavedLines: Record<string, Array<{ x: number; y: number; value: number; month: string; label: string }>> = {};
    loanIds.forEach(loanId => {
      loanInterestLines[loanId] = [];
      loanSavedLines[loanId] = [];
    });

    points.forEach((point, index) => {
      const x = PADDING_LEFT + index * stepX;
      point.loans?.forEach(loan => {
        const interestPercent = loan.interest / maxValue;
        const savedPercent = loan.interestSaved / maxValue;
        const interestY = PADDING_TOP + CHART_HEIGHT - interestPercent * CHART_HEIGHT;
        const savedY = PADDING_TOP + CHART_HEIGHT - savedPercent * CHART_HEIGHT;
        
        loanInterestLines[loan.loanId].push({
          x,
          y: interestY,
          value: loan.interest,
          month: point.month,
          label: formatMonthLabel(point.month),
        });
        
        loanSavedLines[loan.loanId].push({
          x,
          y: savedY,
          value: loan.interestSaved,
          month: point.month,
          label: formatMonthLabel(point.month),
        });
      });
    });

    // Build path strings for each loan
    const loanPaths = loanIds.map((loanId, index) => {
      const interestCoords = loanInterestLines[loanId];
      const savedCoords = loanSavedLines[loanId];
      if (interestCoords.length === 0) return null;
      
      const interestPathString = interestCoords.map(c => `${c.x},${c.y}`).join(" ");
      const savedPathString = savedCoords.map(c => `${c.x},${c.y}`).join(" ");
      
      return {
        loanId,
        interestColor: INTEREST_COLORS[index % INTEREST_COLORS.length],
        savedColor: SAVED_COLORS[index % SAVED_COLORS.length],
        interestPathString,
        savedPathString,
        interestCoordinates: interestCoords,
        savedCoordinates: savedCoords,
      };
    }).filter((loan): loan is NonNullable<typeof loan> => loan !== null);

    // Y-axis ticks (7 values)
    const yTicks = Array.from({ length: 7 }, (_, i) => {
      const value = (maxValue * i) / 6;
      const y = PADDING_TOP + CHART_HEIGHT - (value / maxValue) * CHART_HEIGHT;
      return { value, y };
    });

    // X-axis ticks (show every nth month to avoid crowding)
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
      
      {/* Interest lines for each loan */}
      {computed.loanPaths.map((loan) => (
        <g key={`interest-${loan.loanId}`}>
          <polyline
            points={loan.interestPathString}
            fill="none"
            stroke={loan.interestColor}
            strokeWidth={2}
          />
          {loan.interestCoordinates.map((coord, i) => (
            <circle
              key={i}
              cx={coord.x}
              cy={coord.y}
              r={3}
              fill={loan.interestColor}
            >
              <title>
                {`Kredyt ${loan.loanId} - ${coord.label}: Odsetki ${currencyFormatter.format(coord.value)}`}
              </title>
            </circle>
          ))}
        </g>
      ))}
      
      {/* Saved lines for each loan */}
      {computed.loanPaths.map((loan) => (
        <g key={`saved-${loan.loanId}`}>
          <polyline
            points={loan.savedPathString}
            fill="none"
            stroke={loan.savedColor}
            strokeWidth={2}
            strokeDasharray="4,4"
          />
          {loan.savedCoordinates.map((coord, i) => (
            <circle
              key={i}
              cx={coord.x}
              cy={coord.y}
              r={3}
              fill={loan.savedColor}
            >
              <title>
                {`Kredyt ${loan.loanId} - ${coord.label}: Zaoszczędzone ${currencyFormatter.format(coord.value)}`}
              </title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}
