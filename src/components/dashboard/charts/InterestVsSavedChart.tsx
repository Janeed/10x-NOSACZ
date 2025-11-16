import { useMemo } from "react";

import type { ChartInterestPointVM } from "@/types/dashboard";

interface InterestVsSavedChartProps {
  readonly points: ChartInterestPointVM[] | undefined;
}

const SVG_WIDTH = 640;
const SVG_HEIGHT = 240;
const INTEREST_COLOR = "#1f2937"; // slate-800
const SAVED_COLOR = "#10b981"; // emerald-500

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

export function InterestVsSavedChart({ points }: InterestVsSavedChartProps) {
  const computed = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    const normalized = points.map((point) => {
      return {
        label: formatMonthLabel(point.month),
        interest: Number(point.interest ?? 0),
        saved: Number(point.interestSaved ?? 0),
      };
    });

    const maxInterest = Math.max(...normalized.map((point) => point.interest));
    const maxSaved = Math.max(...normalized.map((point) => point.saved));
    const maxValue = Math.max(maxInterest, maxSaved, 1);
    const stepX =
      normalized.length > 1 ? SVG_WIDTH / (normalized.length - 1) : 0;

    const coordinates = normalized.map((point, index) => {
      const x = index * stepX;
      const interestPercent = point.interest / maxValue;
      const savedPercent = point.saved / maxValue;
      const interestY = SVG_HEIGHT - interestPercent * SVG_HEIGHT;
      const savedY = SVG_HEIGHT - savedPercent * SVG_HEIGHT;
      return {
        x,
        label: point.label,
        interestValue: point.interest,
        savedValue: point.saved,
        interestY,
        savedY,
      };
    });

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
    };
  }, [points]);

  if (!computed) {
    return null;
  }

  return (
    <svg
      role="img"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-60 w-full"
    >
      <title>Monthly interest versus interest saved</title>
      <desc>
        Compares projected monthly interest charges against the interest saved
        by the active strategy.
      </desc>
      <polyline
        points={computed.interestPath}
        fill="none"
        stroke={INTEREST_COLOR}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={computed.savedPath}
        fill="none"
        stroke={SAVED_COLOR}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {computed.coordinates.map((coord) => (
        <g key={coord.label}>
          <circle
            cx={coord.x}
            cy={coord.interestY}
            r={4}
            fill={INTEREST_COLOR}
          />
          <circle cx={coord.x} cy={coord.savedY} r={4} fill={SAVED_COLOR} />
          <title>
            {`${coord.label}: Interest ${currencyFormatter.format(coord.interestValue)}, Saved ${currencyFormatter.format(coord.savedValue)}`}
          </title>
        </g>
      ))}
    </svg>
  );
}
