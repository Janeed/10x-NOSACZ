import { DashboardDataProvider } from "./DashboardDataProvider";
import { SimulationStatusBanner } from "./SimulationStatusBanner";
import { SimulationStaleBanner } from "./SimulationStaleBanner";
import { EmptyStateCTA } from "./EmptyStateCTA";
import { OverviewCards } from "./overview/OverviewCards";
import { CurrentMonthPanel } from "./currentMonth/CurrentMonthPanel";
import { LoansSection } from "./loans/LoansSection";
import { ChartsSection } from "./charts/ChartsSection";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { AppShell } from "@/components/layout/AppShell";

function DashboardContent() {
  const { activeSimulation, showEmptyState, isLoading, overviewCards, graphs } =
    useDashboardData();

  const hasActiveSimulation = Boolean(activeSimulation);
  const isStale = Boolean(activeSimulation?.stale);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Track your active simulation, review loan progress, and action this
          month’s payment plan.
        </p>
      </header>

      {hasActiveSimulation ? (
        <SimulationStatusBanner simulation={activeSimulation} />
      ) : null}

      {isStale ? <SimulationStaleBanner stale rerouteHref="/wizard" /> : null}

      {isLoading ? (
        <section
          aria-live="polite"
          className="rounded-xl border border-dashed border-muted/60 bg-muted/10 p-6 text-sm text-muted-foreground"
        >
          Loading dashboard data…
        </section>
      ) : null}

      {showEmptyState ? (
        <EmptyStateCTA />
      ) : (
        <div className="space-y-8">
          {overviewCards.length > 0 ? <OverviewCards /> : null}
          <CurrentMonthPanel />
          <LoansSection />
          <ChartsSection
            balancePoints={graphs?.monthlyBalances}
            interestPoints={graphs?.interestVsSaved}
            isLoading={isLoading}
          />
        </div>
      )}
    </main>
  );
}

export function DashboardPage() {
  return (
    <DashboardDataProvider>
      <AppShell activeNav="dashboard" title="Dashboard">
        <DashboardContent />
      </AppShell>
    </DashboardDataProvider>
  );
}
