import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FormActionLink {
  readonly href: string;
  readonly label: string;
  readonly variant?: "link" | "ghost";
}

interface FormActionsProps {
  readonly submitLabel: string;
  readonly isSubmitting: boolean;
  readonly isDisabled?: boolean;
  readonly disabledLabel?: string;
  readonly secondaryLinks?: FormActionLink[];
  readonly className?: string;
}

/**
 * Groups primary submission control with contextual secondary navigation links.
 */
export function FormActions({
  submitLabel,
  isSubmitting,
  isDisabled = false,
  disabledLabel,
  secondaryLinks = [],
  className,
}: FormActionsProps) {
  const buttonLabel = isSubmitting
    ? "Processing..."
    : isDisabled
      ? disabledLabel ?? submitLabel
      : submitLabel;

  return (
    <div className={cn("space-y-4", className)}>
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || isDisabled}
        aria-live={isSubmitting || isDisabled ? "polite" : undefined}
      >
        {buttonLabel}
      </Button>

      {secondaryLinks.length > 0 ? (
        <nav aria-label="Secondary actions" className="flex flex-wrap justify-center gap-4 text-sm">
          {secondaryLinks.map((link) => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              className={cn(
                "font-medium text-primary underline-offset-4 hover:underline",
                link.variant === "ghost" &&
                  "text-muted-foreground hover:text-primary",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
