import { useCallback, useId, useState, type FC } from "react";
import { Info } from "lucide-react";

interface Props {
  readonly tooltipId?: string;
}

export const ReinvestTooltip: FC<Props> = ({ tooltipId }) => {
  const autoId = useId();
  const contentId = tooltipId ?? `reinvest-tooltip-${autoId}`;
  const [open, setOpen] = useState(false);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((c) => !c), []);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="What does reinvest reduced payments mean?"
        aria-haspopup="dialog"
        aria-controls={contentId}
        aria-expanded={open}
        onMouseEnter={show}
        onFocus={show}
        onMouseLeave={hide}
        onBlur={hide}
        onClick={toggle}
        className="ml-2 inline-flex items-center rounded p-1 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
      <span
        id={contentId}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 mt-2 w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow ${
          open ? "block" : "hidden"
        }`}
      >
        If enabled, any monthly payment reductions achieved under the payment
        reduction goal are added to future overpayment allocation instead of
        lowering your ongoing monthly payment total.
      </span>
    </span>
  );
};
