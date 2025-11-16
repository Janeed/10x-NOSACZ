import { Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateCTAProps {
  readonly title?: string;
  readonly description?: string;
  readonly ctaHref?: string;
  readonly ctaLabel?: string;
}

const DEFAULT_TITLE = "No active simulation";
const DEFAULT_DESCRIPTION =
  "Create a simulation to unlock personalized loan overpayment recommendations.";
const DEFAULT_CTA_LABEL = "Start simulation";
const DEFAULT_CTA_HREF = "/wizard";

export function EmptyStateCTA({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  ctaHref = DEFAULT_CTA_HREF,
  ctaLabel = DEFAULT_CTA_LABEL,
}: EmptyStateCTAProps) {
  return (
    <section
      aria-label="Create simulation call-to-action"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-muted/60",
        "bg-muted/10 px-6 py-12 text-center",
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Rocket className="size-6" aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-prose">
          {description}
        </p>
      </div>
      <Button asChild size="lg">
        <a href={ctaHref}>{ctaLabel}</a>
      </Button>
    </section>
  );
}
