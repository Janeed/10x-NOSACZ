import { Button } from "@/components/ui/button";

interface SkipActionControlProps {
  readonly canSkip: boolean;
  readonly disabled?: boolean;
  readonly onSkip: () => void;
}

export function SkipActionControl({
  canSkip,
  disabled,
  onSkip,
}: SkipActionControlProps) {
  if (!canSkip) {
    return <span className="text-xs text-muted-foreground">Not available</span>;
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onSkip}
      disabled={disabled}
    >
      Skip this month
    </Button>
  );
}
