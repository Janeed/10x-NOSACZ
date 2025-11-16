import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { LoansTable } from "./LoansTable";

export function LoansSection() {
  const { loans, isLoading } = useDashboardData();

  const hasLoans = loans.length > 0;

  return (
    <section aria-labelledby="dashboard-loans-heading" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="dashboard-loans-heading"
            className="text-xl font-semibold text-foreground"
          >
            Loans overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor remaining balances, monthly payments, and interest savings
            per loan.
          </p>
        </div>
      </div>

      {isLoading && !hasLoans ? (
        <div className="rounded-xl border border-dashed border-muted/50 bg-muted/10 p-6 text-sm text-muted-foreground">
          Loading loans…
        </div>
      ) : null}

      {hasLoans ? (
        <LoansTable loans={loans} />
      ) : !isLoading ? (
        <div className="rounded-xl border border-dashed border-muted/50 bg-muted/10 p-6 text-sm text-muted-foreground">
          No loans available. Add loans to see progress metrics.
        </div>
      ) : null}
    </section>
  );
}
