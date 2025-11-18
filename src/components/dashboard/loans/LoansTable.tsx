import type { DashboardLoanVM } from "@/types/dashboard";
import { LoanRow } from "./LoanRow";
import { LoanCard } from "./LoanCard";

interface LoansTableProps {
  readonly loans: DashboardLoanVM[];
}

export function LoansTable({ loans }: LoansTableProps) {
  if (loans.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <table className="hidden w-full min-w-max table-fixed border-collapse text-sm md:table">
        <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">
              Loan
            </th>
            <th scope="col" className="px-4 py-3">
              Remaining balance
            </th>
            <th scope="col" className="px-4 py-3">
              Monthly payment
            </th>
            <th scope="col" className="px-4 py-3">
              Interest saved
            </th>
            <th scope="col" className="px-4 py-3">
              Months remaining
            </th>
            <th scope="col" className="px-4 py-3">
              Progress
            </th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan, index) => (
            <LoanRow key={loan.loanId} loan={loan} index={index} />
          ))}
        </tbody>
      </table>

      <div className="grid gap-4 p-4 md:hidden">
        {loans.map((loan) => (
          <LoanCard key={loan.loanId} loan={loan} />
        ))}
      </div>
    </div>
  );
}
