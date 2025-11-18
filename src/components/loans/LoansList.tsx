import type { FC } from "react";

import { Button } from "@/components/ui/button";
import type {
  LoanListItemVM,
  LoanSortField,
  SortingState,
} from "@/lib/viewModels/loans";

interface LoansListProps {
  readonly loans: LoanListItemVM[];
  readonly sorting: SortingState;
  readonly onSort: (field: LoanSortField) => void;
  readonly onEdit: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onQuickBalance: (id: string) => void;
}

interface LoanRowProps {
  readonly loan: LoanListItemVM;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onQuickBalance: () => void;
}

interface LoanRowActionsProps {
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onQuickBalance: () => void;
}

interface StatusBadgeProps {
  readonly isClosed: boolean;
}

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pl-PL", {
  style: "percent",
  maximumFractionDigits: 2,
});

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
});

const headers: (
  | { field: LoanSortField; label: string }
  | { field: null; label: string }
)[] = [
  { field: null, label: "Loan" },
  { field: "remaining_balance", label: "Remaining balance" },
  { field: null, label: "Annual rate" },
  { field: null, label: "Term" },
  { field: "start_month", label: "Start month" },
  { field: null, label: "Status" },
  { field: null, label: "Actions" },
];

const formatCurrency = (value: number) => {
  return currencyFormatter.format(value);
};

const formatRate = (value: number) => {
  return percentFormatter.format(value);
};

const formatTerm = (term: number, original: number) => {
  if (original && original !== term) {
    return `${term} / ${original}`;
  }
  return String(term);
};

const formatMonth = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return monthFormatter.format(date);
};

const formatLoanLabel = (loan: LoanListItemVM) => {
  const identifier = loan.id ?? "";
  if (identifier.length <= 8) {
    return `Loan #${identifier}`;
  }
  return `Loan #${identifier.slice(0, 8)}…`;
};

const isSortedColumn = (sorting: SortingState, field: LoanSortField | null) => {
  if (!field) {
    return false;
  }
  return sorting.field === field;
};

const arrowForOrder = (sorting: SortingState, field: LoanSortField | null) => {
  if (!field || sorting.field !== field) {
    return "";
  }
  return sorting.order === "asc" ? "↑" : "↓";
};

export const LoansList: FC<LoansListProps> = ({
  loans,
  sorting,
  onSort,
  onEdit,
  onDelete,
  onQuickBalance,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm text-slate-700">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {headers.map((column) => {
              if (column.field) {
                const sorted = isSortedColumn(sorting, column.field);
                return (
                  <th
                    key={column.label}
                    scope="col"
                    className="px-4 py-3"
                    aria-sort={
                      sorted
                        ? sorting.order === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                      onClick={() => onSort(column.field as LoanSortField)}
                    >
                      {column.label}
                      <span className="text-xs text-slate-400">
                        {arrowForOrder(sorting, column.field)}
                      </span>
                    </button>
                  </th>
                );
              }

              return (
                <th key={column.label} scope="col" className="px-4 py-3">
                  {column.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <LoanRow
              key={loan.id}
              loan={loan}
              onEdit={() => onEdit(loan.id)}
              onDelete={() => onDelete(loan.id)}
              onQuickBalance={() => onQuickBalance(loan.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LoanRow: FC<LoanRowProps> = ({
  loan,
  onEdit,
  onDelete,
  onQuickBalance,
}) => {
  return (
    <tr className="border-t border-slate-100 last:border-b">
      <td className="px-4 py-3 align-middle text-slate-900">
        <div className="flex flex-col">
          <span className="font-medium">{formatLoanLabel(loan)}</span>
          <span className="text-xs text-slate-500">
            Created {formatMonth(loan.createdAt)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="font-semibold text-slate-900">
          {formatCurrency(loan.remainingBalance)}
        </span>
        <span className="ml-1 text-xs text-slate-500">
          of {formatCurrency(loan.principal)}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span>{formatRate(loan.annualRate)}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="font-medium text-slate-900">
          {formatTerm(loan.termMonths, loan.originalTermMonths)}
        </span>
        <span className="ml-1 text-xs text-slate-500">months</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span>{formatMonth(loan.startMonth)}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <StatusBadge isClosed={loan.isClosed} />
      </td>
      <td className="px-4 py-3 align-middle">
        <LoanRowActions
          onEdit={onEdit}
          onDelete={onDelete}
          onQuickBalance={onQuickBalance}
        />
      </td>
    </tr>
  );
};

const LoanRowActions: FC<LoanRowActionsProps> = ({
  onEdit,
  onDelete,
  onQuickBalance,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
        Edit
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onQuickBalance}>
        Quick balance
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-red-600 hover:text-red-700"
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
};

const StatusBadge: FC<StatusBadgeProps> = ({ isClosed }) => {
  if (isClosed) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
        Closed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
      Active
    </span>
  );
};
