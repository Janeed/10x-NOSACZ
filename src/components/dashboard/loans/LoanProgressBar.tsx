interface LoanProgressBarProps {
  readonly progress: number;
  readonly isClosed?: boolean;
}

const clamp = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value * 10) / 10;
};

export function LoanProgressBar({
  progress,
  isClosed = false,
}: LoanProgressBarProps) {
  const value = clamp(progress);
  const percentageLabel = `${value}%`;

  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Principal paid"
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${value}%`, opacity: isClosed ? 0.4 : 1 }}
        />
      </div>
      <p className="text-xs text-muted-foreground" aria-hidden>
        {isClosed ? "Closed" : percentageLabel} repaid
      </p>
    </div>
  );
}
