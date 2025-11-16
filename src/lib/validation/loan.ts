import { z } from "zod";

import type {
  CreateLoanCommand,
  LoanDto,
  LoanListQuery,
  PatchLoanCommand,
  UpdateLoanCommand,
} from "../../types.ts";

export interface LoanValidationIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  value?: T;
  errors?: LoanValidationIssue[];
}

const SORT_FIELDS = ["created_at", "start_month", "remaining_balance"] as const;

const ORDER_VALUES = ["asc", "desc"] as const;

const createIssue = (
  path: (string | number)[],
  message: string,
  code = "invalid",
): LoanValidationIssue => ({ path, message, code });

const mapIssues = (issues: z.ZodIssue[]): LoanValidationIssue[] => {
  return issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
    code: issue.code,
  }));
};

const parseFirstOfMonth = (
  value: string,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): string | typeof z.NEVER => {
  const trimmed = value.trim();
  if (!trimmed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "Value is required",
    });
    return z.NEVER;
  }

  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u.exec(trimmed);
  if (!match) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "Value must use YYYY-MM-DD format",
    });
    return z.NEVER;
  }

  const [, year, month, day] = match;
  const isoCandidate = `${year}-${month}-${day}`;
  const date = new Date(`${isoCandidate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "Value must be a valid calendar date",
    });
    return z.NEVER;
  }

  if (date.getUTCFullYear().toString().padStart(4, "0") !== year) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "Year component is invalid",
    });
    return z.NEVER;
  }

  const normalizedMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (normalizedMonth !== month) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "Month component is invalid",
    });
    return z.NEVER;
  }

  if (day !== "01") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "Date must represent the first day of the month",
    });
    return z.NEVER;
  }

  return `${year}-${normalizedMonth}-01`;
};

const firstOfMonthSchema = z
  .string({ invalid_type_error: "Value must be a string" })
  .transform((value, ctx) => parseFirstOfMonth(value, ctx, ctx.path));

const firstOfMonthNullableSchema = z
  .union([firstOfMonthSchema, z.null()])
  .optional();

const positiveInteger = (
  field: string,
  { minimum = 1 }: { minimum?: number } = {},
) =>
  z
    .number({ invalid_type_error: `${field} must be a number` })
    .int(`${field} must be an integer`)
    .refine((value) => value >= minimum, {
      message: `${field} must be greater than or equal to ${minimum}`,
    });

const positiveDecimal = (field: string) =>
  z
    .number({ invalid_type_error: `${field} must be a number` })
    .refine((value) => Number.isFinite(value), `${field} must be finite`)
    .refine((value) => value > 0, `${field} must be greater than 0`);

const nonNegativeDecimal = (field: string) =>
  z
    .number({ invalid_type_error: `${field} must be a number` })
    .refine((value) => Number.isFinite(value), `${field} must be finite`)
    .refine(
      (value) => value >= 0,
      `${field} must be greater than or equal to 0`,
    );

const rateDecimal = (field: string) =>
  z
    .number({ invalid_type_error: `${field} must be a number` })
    .refine((value) => Number.isFinite(value), `${field} must be finite`)
    .refine((value) => value > 0, `${field} must be greater than 0`)
    .refine((value) => value < 1, `${field} must be less than 1`);

const baseLoanSchema = z
  .object({
    id: z.string().uuid({ message: "id must be a valid UUID" }).optional(),
    principal: positiveDecimal("principal"),
    remainingBalance: nonNegativeDecimal("remainingBalance"),
    annualRate: rateDecimal("annualRate"),
    termMonths: positiveInteger("termMonths"),
    originalTermMonths: positiveInteger("originalTermMonths"),
    startMonth: firstOfMonthSchema,
  })
  .strict();

const updateLoanSchema = baseLoanSchema.extend({
  isClosed: z
    .boolean({ invalid_type_error: "isClosed must be a boolean" })
    .optional(),
  closedMonth: firstOfMonthNullableSchema,
});

const patchLoanSchema = z
  .object({
    principal: positiveDecimal("principal").optional(),
    remainingBalance: nonNegativeDecimal("remainingBalance").optional(),
    annualRate: rateDecimal("annualRate").optional(),
    termMonths: positiveInteger("termMonths").optional(),
    originalTermMonths: positiveInteger("originalTermMonths").optional(),
    startMonth: firstOfMonthSchema.optional(),
    isClosed: z
      .boolean({ invalid_type_error: "isClosed must be a boolean" })
      .optional(),
    closedMonth: firstOfMonthNullableSchema,
  })
  .strict();

const listQuerySchema = z
  .object({
    page: z
      .preprocess((value) => {
        if (value === undefined) {
          return undefined;
        }
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) {
            return undefined;
          }
          const parsed = Number(trimmed);
          return Number.isFinite(parsed) ? parsed : value;
        }
        return value;
      }, z.number().int().min(1))
      .default(1),
    pageSize: z
      .preprocess((value) => {
        if (value === undefined) {
          return undefined;
        }
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) {
            return undefined;
          }
          const parsed = Number(trimmed);
          return Number.isFinite(parsed) ? parsed : value;
        }
        return value;
      }, z.number().int().min(1).max(100))
      .default(20),
    isClosed: z
      .preprocess((value) => {
        if (value === undefined) {
          return undefined;
        }
        if (typeof value === "boolean") {
          return value;
        }
        if (typeof value !== "string") {
          return value;
        }
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
          return true;
        }
        if (normalized === "false") {
          return false;
        }
        return value;
      }, z.boolean())
      .optional(),
    sort: z.enum(SORT_FIELDS).default("created_at"),
    order: z.enum(ORDER_VALUES).default("desc"),
  })
  .strict();

export const validateListQuery = (
  input: unknown,
): ValidationResult<LoanListQuery> => {
  const result = listQuerySchema.safeParse(input ?? {});

  if (!result.success) {
    return { errors: mapIssues(result.error.issues) };
  }

  return { value: result.data };
};

const validateRemainingBalance = (
  principalValue: number,
  remainingBalance: number,
): LoanValidationIssue[] => {
  if (remainingBalance > principalValue) {
    return [
      createIssue(
        ["remainingBalance"],
        "remainingBalance must be less than or equal to principal",
      ),
    ];
  }

  return [];
};

const validateClosedState = (
  isClosed: boolean | undefined,
  remainingBalance: number,
  closedMonth: string | null | undefined,
): LoanValidationIssue[] => {
  const issues: LoanValidationIssue[] = [];
  if (closedMonth !== undefined && closedMonth !== null && isClosed !== true) {
    issues.push(
      createIssue(
        ["closedMonth"],
        "closedMonth is only allowed when isClosed is true",
      ),
    );
  }

  if (isClosed && remainingBalance > 0) {
    issues.push(
      createIssue(
        ["remainingBalance"],
        "remainingBalance must be 0 when loan is closed",
      ),
    );
  }

  return issues;
};

export const validateCreateLoan = (
  input: unknown,
): ValidationResult<CreateLoanCommand> => {
  const parsed = baseLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { errors: mapIssues(parsed.error.issues) };
  }

  const data = parsed.data;
  const issues = validateRemainingBalance(
    data.principal,
    data.remainingBalance,
  );
  if (issues.length > 0) {
    return { errors: issues };
  }

  return { value: data };
};

export const validateUpdateLoan = (
  input: unknown,
): ValidationResult<UpdateLoanCommand> => {
  const parsed = updateLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { errors: mapIssues(parsed.error.issues) };
  }

  const data = parsed.data;
  const issues: LoanValidationIssue[] = [];
  issues.push(
    ...validateRemainingBalance(data.principal, data.remainingBalance),
  );
  issues.push(
    ...validateClosedState(
      data.isClosed,
      data.remainingBalance,
      data.closedMonth,
    ),
  );

  if (issues.length > 0) {
    return { errors: issues };
  }

  return { value: data };
};

export const validatePatchLoan = (
  input: unknown,
  existing: LoanDto,
): ValidationResult<PatchLoanCommand> => {
  const parsed = patchLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { errors: mapIssues(parsed.error.issues) };
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return {
      errors: [
        createIssue(
          [],
          "Request body must include at least one supported field",
          "too_small",
        ),
      ],
    };
  }

  const principal = data.principal ?? existing.principal;
  const remainingBalance = data.remainingBalance ?? existing.remainingBalance;
  const isClosed = data.isClosed ?? existing.isClosed;
  const closedMonth =
    data.closedMonth !== undefined
      ? data.closedMonth
      : (existing.closedMonth ?? undefined);

  const issues: LoanValidationIssue[] = [];
  issues.push(...validateRemainingBalance(principal, remainingBalance));
  issues.push(
    ...validateClosedState(
      isClosed,
      remainingBalance,
      closedMonth ?? undefined,
    ),
  );

  if (issues.length > 0) {
    return { errors: issues };
  }

  return { value: data };
};
