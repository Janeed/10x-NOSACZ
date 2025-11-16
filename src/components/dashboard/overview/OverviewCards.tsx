import type { ReactNode } from "react";
import { Lightbulb, PieChart, PiggyBank, TrendingUp } from "lucide-react";

import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { OverviewCard } from "./OverviewCard";

const ICONS: Record<string, ReactNode> = {
  Strategy: <TrendingUp className="size-5" aria-hidden />,
  Goal: <Lightbulb className="size-5" aria-hidden />,
  "Projected payoff": <PieChart className="size-5" aria-hidden />,
  "Total interest saved": <PiggyBank className="size-5" aria-hidden />,
};

export function OverviewCards() {
  const { overviewCards } = useDashboardData();

  if (overviewCards.length === 0) {
    return null;
  }

  return (
    <section aria-label="Simulation overview" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <OverviewCard
            key={card.title}
            {...card}
            icon={ICONS[card.title] ?? null}
          />
        ))}
      </div>
    </section>
  );
}
