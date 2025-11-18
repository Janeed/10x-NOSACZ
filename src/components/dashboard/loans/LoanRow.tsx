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

interface LoanRowProps {
  readonly loan: DashboardLoanVM;
  readonly index: number;
}

export function LoanRow({ loan, index }: LoanRowProps) {
  return (
    <tr className="border-b border-border/40 last:border-none hover:bg-muted/40">
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-foreground">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Loan {index}</span>
          <LoanStatusBadge isClosed={loan.isClosed} />
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {formatCurrency(loan.remainingBalance)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {formatCurrency(loan.monthlyPayment)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {formatCurrency(loan.interestSavedToDate)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {loan.monthsRemaining}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        <LoanProgressBar
          progress={loan.progressPercent}
          isClosed={loan.isClosed}
        />
      </td>
    </tr>
  );
}
