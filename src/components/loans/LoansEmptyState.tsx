import type { FC } from "react";

import { Button } from "@/components/ui/button";

interface LoansEmptyStateProps {
  readonly onAdd: () => void;
  readonly isAddDisabled?: boolean;
}

export const LoansEmptyState: FC<LoansEmptyStateProps> = ({
  onAdd,
  isAddDisabled,
}) => {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">No loans yet</h2>
        <p>
          Track your mortgages, consumer loans, or other debts in one place to
          keep simulations accurate and make better overpayment decisions.
        </p>
      </div>
      <Button type="button" onClick={onAdd} disabled={isAddDisabled}>
        Add your first loan
      </Button>
    </div>
  );
};
