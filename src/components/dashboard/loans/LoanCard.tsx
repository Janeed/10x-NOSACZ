import type { DashboardLoanVM } from "@/types/dashboard";
import { LoanProgressBar } from "./LoanProgressBar";
import { LoanStatusBadge } from "./LoanStatusBadge";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => {
  return currencyFormatter.format(value);
};

interface LoanCardProps {
  readonly loan: DashboardLoanVM;
}

export function LoanCard({ loan }: LoanCardProps) {
  return (
    <article className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Loan</p>
          <p className="text-base font-semibold text-foreground">
            {loan.loanId}
          </p>
        </div>
        <LoanStatusBadge isClosed={loan.isClosed} />
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Remaining balance</dt>
          <dd className="font-medium text-foreground">
            {formatCurrency(loan.remainingBalance)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Monthly payment</dt>
          <dd className="font-medium text-foreground">
            {formatCurrency(loan.monthlyPayment)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Interest saved</dt>
          <dd className="font-medium text-foreground">
            {formatCurrency(loan.interestSavedToDate)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Months remaining</dt>
          <dd className="font-medium text-foreground">
            {loan.monthsRemaining}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <LoanProgressBar
          progress={loan.progressPercent}
          isClosed={loan.isClosed}
        />
      </div>
    </article>
  );
}
