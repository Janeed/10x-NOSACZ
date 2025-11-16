import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { z } from "zod";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApiFetch } from "@/lib/hooks/useApiFetch";
import type { ApiFetchMeta } from "@/lib/hooks/useApiFetch";
import type {
  LoanFormErrors,
  LoanFormValues,
  LoanListItemVM,
  StaleTrigger,
} from "@/lib/viewModels/loans";
import type { CreateLoanCommand, LoanDto, UpdateLoanCommand } from "@/types";

interface LoanEditorSidebarProps {
  readonly open: boolean;
  readonly mode: "create" | "edit";
  readonly loan?: LoanListItemVM;
  readonly etag?: string;
  readonly onClose: () => void;
  readonly onSaved: (payload: {
    loan: LoanListItemVM;
    etag?: string | null;
    trigger: StaleTrigger;
    meta?: ApiFetchMeta | null;
  }) => void;
}

const MONTH_PATTERN = /^\d{4}-\d{2}-01$/;

const MONTH_OPTIONS: { value: string; label: string }[] = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_WINDOW_PAST = 60;
const YEAR_WINDOW_FUTURE = 40;

const buildIsoMonth = (year: string, month: string): string => {
  const normalizedYear = year.padStart(4, "0").slice(-4);
  const normalizedMonth = month.padStart(2, "0").slice(-2);
  return `${normalizedYear}-${normalizedMonth}-01`;
};

const parseIsoMonthParts = (value: string): { year: string; month: string } => {
  if (value && value.includes("-")) {
    const [yearPart, monthPart] = value.split("-");
    const year = (yearPart && yearPart.trim()) || String(CURRENT_YEAR);
    const month = (monthPart && monthPart.trim()) || "01";
    return {
      year: year.padStart(4, "0").slice(0, 4),
      month: month.padStart(2, "0").slice(-2),
    };
  }

  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
  };
};

const buildYearOptions = (seedYear: string): string[] => {
  const anchor = Number.parseInt(seedYear, 10);
  const start = CURRENT_YEAR - YEAR_WINDOW_PAST;
  const end = CURRENT_YEAR + YEAR_WINDOW_FUTURE;
  const options = new Set<string>();

  for (let year = start; year <= end; year += 1) {
    options.add(String(year));
  }

  if (Number.isFinite(anchor)) {
    options.add(String(anchor));
  }

  return Array.from(options).sort((a, b) => Number(a) - Number(b));
};

const formSchema = z
  .object({
    principal: z
      .number({ invalid_type_error: "Enter a valid principal." })
      .finite("Enter a valid principal.")
      .gt(0, "Principal must be greater than 0."),
    remainingBalance: z
      .number({ invalid_type_error: "Enter a valid remaining balance." })
      .finite("Enter a valid remaining balance.")
      .min(0, "Remaining balance cannot be negative.")
      .optional(),
    annualRatePercent: z
      .number({ invalid_type_error: "Enter a valid rate." })
      .finite("Enter a valid rate.")
      .gt(0, "Interest rate must be greater than 0%.")
      .max(100, "Interest rate cannot exceed 100%."),
    termMonths: z
      .number({ invalid_type_error: "Enter a valid term." })
      .int("Term must be a whole number.")
      .gt(0, "Term must be greater than 0."),
    originalTermMonths: z
      .number({ invalid_type_error: "Enter a valid original term." })
      .int("Original term must be a whole number.")
      .gt(0, "Original term must be greater than 0."),
    startMonth: z
      .string({ required_error: "Select a start month." })
      .regex(MONTH_PATTERN, "Select a valid month."),
    rateChangeEffective: z.enum(["current", "next"]),
  })
  .superRefine((data, ctx) => {
    if (
      typeof data.remainingBalance === "number" &&
      data.remainingBalance > data.principal
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["remainingBalance"],
        message: "Remaining balance cannot exceed principal.",
      });
    }

    if (data.originalTermMonths < data.termMonths) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originalTermMonths"],
        message: "Original term should be greater than or equal to term.",
      });
    }
  });

const toIsoMonth = (value: string): string => {
  if (!value) {
    return "";
  }
  const parts = parseIsoMonthParts(value);
  return buildIsoMonth(parts.year, parts.month);
};

const getCurrentMonth = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-01`;
};

const buildDefaultValues = (): LoanFormValues => {
  return {
    principal: "",
    remainingBalance: "",
    annualRate: "",
    termMonths: "",
    originalTermMonths: "",
    startMonth: getCurrentMonth(),
    rateChangeEffective: "current",
  };
};

const mapLoanToValues = (loan: LoanListItemVM): LoanFormValues => {
  return {
    principal: Number(loan.principal ?? 0),
    remainingBalance: Number(loan.remainingBalance ?? 0),
    annualRate: Number((loan.annualRate ?? 0) * 100),
    termMonths: Number(loan.termMonths ?? 0),
    originalTermMonths: Number(loan.originalTermMonths ?? 0),
    startMonth: loan.startMonth ?? getCurrentMonth(),
    rateChangeEffective: "current",
  };
};

const inputDisplay = (value: number | "") => {
  if (value === "") {
    return "";
  }
  return Number.isFinite(value) ? String(value) : "";
};

const parseNumberInput = (raw: string): number | "" => {
  if (raw === "") {
    return "";
  }
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? "" : parsed;
};

export const LoanEditorSidebar = ({
  open,
  mode,
  loan,
  etag,
  onClose,
  onSaved,
}: LoanEditorSidebarProps) => {
  const { apiFetch } = useApiFetch();
  const [values, setValues] = useState<LoanFormValues>(buildDefaultValues);
  const [errors, setErrors] = useState<LoanFormErrors>({});
  const [nonFieldError, setNonFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "edit" && loan) {
      setValues(mapLoanToValues(loan));
    } else {
      setValues(buildDefaultValues());
    }
    setErrors({});
    setNonFieldError(null);
  }, [loan, mode, open]);

  const title = useMemo(() => {
    return mode === "create" ? "Add loan" : "Edit loan";
  }, [mode]);

  const description = useMemo(() => {
    return mode === "create"
      ? "Provide details about the loan to begin tracking it."
      : "Update loan details and adjust future calculations.";
  }, [mode]);

  const updateField = useCallback(
    <K extends keyof LoanFormValues>(field: K, value: LoanFormValues[K]) => {
      setValues((current) => ({
        ...current,
        [field]: value,
      }));
      setErrors((current) => ({
        ...current,
        [field]: undefined,
      }));
      if (field !== "rateChangeEffective") {
        setNonFieldError(null);
      }
    },
    [],
  );

  const handleNumberChange = useCallback(
    (
      field: keyof Pick<
        LoanFormValues,
        | "principal"
        | "remainingBalance"
        | "annualRate"
        | "termMonths"
        | "originalTermMonths"
      >,
    ) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        updateField(field, parseNumberInput(event.target.value));
      },
    [updateField],
  );

  const startMonthParts = useMemo(
    () => parseIsoMonthParts(values.startMonth),
    [values.startMonth],
  );

  const yearOptions = useMemo(
    () => buildYearOptions(startMonthParts.year),
    [startMonthParts.year],
  );

  const handleStartMonthMonthChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      updateField(
        "startMonth",
        buildIsoMonth(startMonthParts.year, event.target.value),
      );
    },
    [startMonthParts.year, updateField],
  );

  const handleStartMonthYearChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      updateField(
        "startMonth",
        buildIsoMonth(event.target.value, startMonthParts.month),
      );
    },
    [startMonthParts.month, updateField],
  );

  const handleRateEffectiveChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateField(
        "rateChangeEffective",
        event.target.value as LoanFormValues["rateChangeEffective"],
      );
    },
    [updateField],
  );

  const resetSubmittingState = useCallback(() => {
    setIsSubmitting(false);
  }, []);

  const buildCommandPayload = useCallback(
    (
      formData: z.infer<typeof formSchema>,
    ): {
      command: CreateLoanCommand | UpdateLoanCommand;
      trigger: StaleTrigger;
    } => {
      const annualRateDecimal = formData.annualRatePercent / 100;
      const base: CreateLoanCommand = {
        principal: formData.principal,
        remainingBalance: formData.remainingBalance ?? formData.principal,
        annualRate: annualRateDecimal,
        termMonths: formData.termMonths,
        originalTermMonths: formData.originalTermMonths,
        startMonth: formData.startMonth,
      };

      if (mode === "create") {
        return {
          command: base,
          trigger: "create",
        };
      }

      const updated: UpdateLoanCommand = {
        ...base,
      };

      const originalRate = loan?.annualRate ?? null;
      const rateChanged =
        typeof originalRate === "number" &&
        Math.abs(annualRateDecimal - originalRate) > 0.000001;

      const trigger: StaleTrigger =
        rateChanged && formData.rateChangeEffective === "next"
          ? "rate_change"
          : "edit";

      return { command: updated, trigger };
    },
    [loan, mode],
  );

  const clearErrors = useCallback(() => {
    setErrors({});
    setNonFieldError(null);
  }, []);

  const assignIssueToErrors = (
    target: LoanFormErrors,
    path: string | undefined,
    message: string,
  ) => {
    switch (path) {
      case "principal":
        target.principal = message;
        break;
      case "remainingBalance":
        target.remainingBalance = message;
        break;
      case "annualRate":
      case "annualRatePercent":
        target.annualRate = message;
        break;
      case "termMonths":
        target.termMonths = message;
        break;
      case "originalTermMonths":
        target.originalTermMonths = message;
        break;
      case "startMonth":
        target.startMonth = message;
        break;
      case "rateChangeEffective":
        target.rateChangeEffective = message;
        break;
      default:
        target.nonFieldError = message;
        break;
    }
  };

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) {
        return;
      }

      const principal =
        values.principal === "" ? Number.NaN : Number(values.principal);
      const remainingBalance =
        values.remainingBalance === ""
          ? undefined
          : Number(values.remainingBalance);
      const annualRatePercent =
        values.annualRate === "" ? Number.NaN : Number(values.annualRate);
      const termMonths =
        values.termMonths === "" ? Number.NaN : Number(values.termMonths);
      const originalTermMonths =
        values.originalTermMonths === ""
          ? Number.NaN
          : Number(values.originalTermMonths);
      const normalizedMonth = values.startMonth
        ? toIsoMonth(values.startMonth)
        : "";

      const parsed = formSchema.safeParse({
        principal,
        remainingBalance,
        annualRatePercent,
        termMonths,
        originalTermMonths,
        startMonth: normalizedMonth,
        rateChangeEffective: values.rateChangeEffective,
      });

      if (!parsed.success) {
        const nextErrors: LoanFormErrors = {};
        parsed.error.issues.forEach((issue) => {
          const path = String(issue.path[0] ?? "nonFieldError");
          assignIssueToErrors(nextErrors, path, issue.message);
        });
        setErrors(nextErrors);
        setNonFieldError("Please correct the highlighted fields.");
        return;
      }

      if (mode === "edit" && !loan) {
        setNonFieldError("Loan data unavailable. Please reload the page.");
        return;
      }

      clearErrors();
      setIsSubmitting(true);

      const { command, trigger } = buildCommandPayload(parsed.data);
      let path = "/api/loans";
      let method: "POST" | "PUT" = "POST";
      const headers: Record<string, string> = {};

      if (mode === "edit" && loan) {
        path = `/api/loans/${loan.id}`;
        method = "PUT";
        if (etag) {
          headers["If-Match"] = etag;
        }
      }

      const result = await apiFetch<
        LoanDto,
        CreateLoanCommand | UpdateLoanCommand
      >({
        path,
        method,
        body: command,
        headers,
      });

      if (!result.ok || !result.data) {
        resetSubmittingState();
        const apiMessage = result.ok
          ? "Unable to save loan."
          : result.error.message;
        setNonFieldError(apiMessage);
        const nextErrors: LoanFormErrors = {};
        if (!result.ok && result.error.issues) {
          result.error.issues.forEach((issue) => {
            if (!issue.message) {
              return;
            }
            const resolvedPath =
              typeof issue.path === "string"
                ? issue.path.split(".").pop()
                : issue.path;
            assignIssueToErrors(nextErrors, resolvedPath, issue.message);
          });
        }
        setErrors(nextErrors);
        return;
      }

      const savedLoan: LoanListItemVM = {
        ...result.data,
        etag: result.meta?.etag ?? undefined,
      };

      onSaved({
        loan: savedLoan,
        etag: result.meta?.etag ?? null,
        trigger,
        meta: result.meta ?? null,
      });

      resetSubmittingState();
    },
    [
      apiFetch,
      buildCommandPayload,
      clearErrors,
      etag,
      isSubmitting,
      loan,
      mode,
      onSaved,
      resetSubmittingState,
      values,
    ],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="absolute inset-0 bg-slate-900/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close loan editor"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>
        <form
          className="flex flex-1 flex-col overflow-y-auto px-6 py-4"
          onSubmit={handleSubmit}
        >
          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="loan-principal"
              >
                Principal amount
              </label>
              <input
                id="loan-principal"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                value={inputDisplay(values.principal)}
                onChange={handleNumberChange("principal")}
                required
              />
              {errors.principal ? (
                <p className="mt-1 text-xs text-red-600">{errors.principal}</p>
              ) : null}
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="loan-remaining-balance"
              >
                Remaining balance
              </label>
              <input
                id="loan-remaining-balance"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                value={inputDisplay(values.remainingBalance)}
                onChange={handleNumberChange("remainingBalance")}
              />
              <p className="mt-1 text-xs text-slate-500">
                Leave blank when creating a new loan to use the principal
                amount.
              </p>
              {errors.remainingBalance ? (
                <p className="mt-1 text-xs text-red-600">
                  {errors.remainingBalance}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="loan-annual-rate"
              >
                Annual interest rate (% per year)
              </label>
              <input
                id="loan-annual-rate"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                value={inputDisplay(values.annualRate)}
                onChange={handleNumberChange("annualRate")}
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Example: enter 7.25 for a 7.25% annual interest rate.
              </p>
              {errors.annualRate ? (
                <p className="mt-1 text-xs text-red-600">{errors.annualRate}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="loan-term-months"
                >
                  Remaining term (months)
                </label>
                <input
                  id="loan-term-months"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                  value={inputDisplay(values.termMonths)}
                  onChange={handleNumberChange("termMonths")}
                  required
                />
                {errors.termMonths ? (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.termMonths}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="loan-original-term-months"
                >
                  Original term (months)
                </label>
                <input
                  id="loan-original-term-months"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                  value={inputDisplay(values.originalTermMonths)}
                  onChange={handleNumberChange("originalTermMonths")}
                  required
                />
                {errors.originalTermMonths ? (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.originalTermMonths}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="loan-start-month-month"
              >
                Start month
              </label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <label className="sr-only" htmlFor="loan-start-month-month">
                    Start month (month)
                  </label>
                  <select
                    id="loan-start-month-month"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                    value={startMonthParts.month}
                    onChange={handleStartMonthMonthChange}
                    required
                  >
                    {MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="sr-only" htmlFor="loan-start-month-year">
                    Start month (year)
                  </label>
                  <select
                    id="loan-start-month-year"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                    value={startMonthParts.year}
                    onChange={handleStartMonthYearChange}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {errors.startMonth ? (
                <p className="mt-1 text-xs text-red-600">{errors.startMonth}</p>
              ) : null}
            </div>

            <fieldset className="space-y-1 rounded-md border border-slate-200 px-3 py-2">
              <legend className="px-1 text-sm font-medium text-slate-700">
                Interest rate effective date
              </legend>
              <p className="text-xs text-slate-500">
                Choose when the new rate should take effect. Selecting next
                month will mark simulations as stale.
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="rate-effective"
                    value="current"
                    checked={values.rateChangeEffective === "current"}
                    onChange={handleRateEffectiveChange}
                  />
                  Current month
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="rate-effective"
                    value="next"
                    checked={values.rateChangeEffective === "next"}
                    onChange={handleRateEffectiveChange}
                  />
                  Next month
                </label>
              </div>
              {errors.rateChangeEffective ? (
                <p className="mt-1 text-xs text-red-600">
                  {errors.rateChangeEffective}
                </p>
              ) : null}
            </fieldset>

            {nonFieldError ? (
              <p className="text-sm text-red-600">{nonFieldError}</p>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save loan"}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
};
