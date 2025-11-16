import type { FC } from "react";

import { Button } from "@/components/ui/button";
import type { LoanSortField, SortingState } from "@/lib/viewModels/loans";

interface LoansHeaderProps {
  readonly sorting: SortingState;
  readonly onAdd: () => void;
  readonly onChangeSortField: (field: LoanSortField) => void;
  readonly onToggleSortOrder: () => void;
  readonly isAddDisabled?: boolean;
}

const SORT_LABELS: Record<LoanSortField, string> = {
  created_at: "Newest",
  start_month: "Start month",
  remaining_balance: "Remaining balance",
};

const sortOptions: LoanSortField[] = [
  "created_at",
  "start_month",
  "remaining_balance",
];

export const LoansHeader: FC<LoansHeaderProps> = ({
  sorting,
  onAdd,
  onChangeSortField,
  onToggleSortOrder,
  isAddDisabled,
}) => {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Loans</h1>
        <p className="text-sm text-slate-600">
          Review balances, adjust terms, and keep your simulation data up to
          date.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <label
            className="text-xs font-medium text-slate-500"
            htmlFor="loan-sort-field"
          >
            Sort by
          </label>
          <select
            id="loan-sort-field"
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            value={sorting.field}
            onChange={(event) =>
              onChangeSortField(event.target.value as LoanSortField)
            }
          >
            {sortOptions.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onToggleSortOrder}
          >
            Order: {sorting.order === "asc" ? "Ascending" : "Descending"}
          </Button>
        </div>
        <Button
          type="button"
          onClick={onAdd}
          disabled={isAddDisabled}
          size="lg"
        >
          Add loan
        </Button>
      </div>
    </header>
  );
};
