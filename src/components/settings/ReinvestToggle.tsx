import type { FC, ChangeEventHandler } from "react";
import { ReinvestTooltip } from "@/components/settings/ReinvestTooltip";

interface Props {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
}

export const ReinvestToggle: FC<Props> = ({ checked, disabled, onChange }) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center">
          <label
            htmlFor="reinvestReducedPayments"
            className="block text-sm font-medium"
          >
            Reinvest reduced payments
          </label>
          <ReinvestTooltip tooltipId="reinvestTooltipContent" />
        </div>
        <p id="reinvestHelp" className="text-xs text-slate-500">
          Adds any payment reductions to your overpayment pool instead of
          lowering monthly totals.
        </p>
      </div>
      <input
        id="reinvestReducedPayments"
        name="reinvestReducedPayments"
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-describedby="reinvestHelp reinvestTooltipContent"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-5 w-5 accent-primary disabled:opacity-70"
      />
    </div>
  );
};
