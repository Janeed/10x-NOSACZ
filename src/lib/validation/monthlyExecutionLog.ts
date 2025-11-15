import { z } from "zod";

import { validationError } from "../errors";
import type {
  MonthlyExecutionLogListQuery,
  CreateMonthlyExecutionLogCommand,
  PatchMonthlyExecutionLogCommand,
} from "../../types.ts";

const DECIMAL_TOLERANCE = 1e-6;

const hasAtMostTwoDecimalPlaces = (value: number): boolean => {
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(value - rounded) <= DECIMAL_TOLERANCE;
};

const roundToTwoDecimals = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const isFirstOfMonth = (dateStr: string): boolean => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return day === 1;
};

const normalizeMonth = (dateStr: string): string => {
  const [year, month] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1)); // month is 0-based
  return date.toISOString().split('T')[0];
};

const monthStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "monthStart must be in YYYY-MM-DD format")
  .refine((value) => {
    const normalized = normalizeMonth(value);
    return normalized === value;
  }, "monthStart must be the first day of the month")
  .refine((value) => {
    const [year, month] = value.split('-').map(Number);
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1; // getUTCMonth() is 0-based
    return year < currentYear || (year === currentYear && month <= currentMonth);
  }, "monthStart cannot be in the future");

const amountSchema = z
  .number()
  .refine((value) => value >= 0, "Amount must be greater than or equal to 0")
  .refine(hasAtMostTwoDecimalPlaces, "Amount must not include more than two decimal places")
  .transform(roundToTwoDecimals);

const timestampSchema = z
  .string()
  .datetime();

const reasonCodeSchema = z
  .string()
  .trim()
  .max(500, "reasonCode must not exceed 500 characters");

const paymentStatusSchema = z.enum(["pending", "paid", "backfilled"]);

const overpaymentStatusSchema = z.enum(["scheduled", "executed", "skipped", "backfilled"]);

export const monthlyExecutionLogQuerySchema = z
  .object({
    loanId: z.string().uuid().optional(),
    monthStart: monthStartSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    overpaymentStatus: overpaymentStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
    sort: z.literal("month_start").default("month_start").optional(),
    order: z.enum(["asc", "desc"]).default("desc").optional(),
  })
  .strict()
  .transform((data) => data as MonthlyExecutionLogListQuery);

export const createMonthlyExecutionLogSchema = z
  .object({
    loanId: z.string().uuid(),
    monthStart: monthStartSchema,
    paymentStatus: z.enum(["pending", "backfilled"]),
    overpaymentStatus: z.enum(["scheduled", "backfilled"]),
    scheduledOverpaymentAmount: amountSchema.optional(),
    actualOverpaymentAmount: amountSchema.optional(),
    interestPortion: amountSchema.optional(),
    principalPortion: amountSchema.optional(),
    remainingBalanceAfter: amountSchema.optional(),
    reasonCode: reasonCodeSchema.optional(),
  })
  .strict()
  .refine((data) => {
    if (data.paymentStatus === "backfilled" && (!data.reasonCode || data.reasonCode.trim() === "")) {
      return false;
    }
    return true;
  }, "reasonCode is required when paymentStatus is backfilled")
  .refine((data) => {
    if (data.overpaymentStatus === "backfilled" && (!data.reasonCode || data.reasonCode.trim() === "")) {
      return false;
    }
    return true;
  }, "reasonCode is required when overpaymentStatus is backfilled")
  .refine((data) => {
    if (data.actualOverpaymentAmount !== undefined && data.overpaymentStatus === "scheduled") {
      return false;
    }
    return true;
  }, "actualOverpaymentAmount can only be set when overpaymentStatus is executed or backfilled")
  .refine((data) => {
    if (data.remainingBalanceAfter !== undefined && data.paymentStatus === "pending") {
      return false;
    }
    return true;
  }, "remainingBalanceAfter can only be set when paymentStatus is paid or backfilled")
  .transform((data) => data as CreateMonthlyExecutionLogCommand);

export const patchMonthlyExecutionLogSchema = z
  .object({
    paymentStatus: paymentStatusSchema.optional(),
    overpaymentStatus: overpaymentStatusSchema.optional(),
    paymentExecutedAt: timestampSchema.optional(),
    overpaymentExecutedAt: timestampSchema.optional(),
    reasonCode: reasonCodeSchema.optional(),
    actualOverpaymentAmount: amountSchema.optional(),
    scheduledOverpaymentAmount: amountSchema.optional(),
    remainingBalanceAfter: amountSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided")
  .refine((data) => {
    if (data.paymentExecutedAt && data.paymentStatus !== "paid" && data.paymentStatus !== "backfilled") {
      return false;
    }
    return true;
  }, "paymentExecutedAt can only be set when paymentStatus is paid or backfilled")
  .refine((data) => {
    if (data.overpaymentExecutedAt && data.overpaymentStatus !== "executed" && data.overpaymentStatus !== "backfilled") {
      return false;
    }
    return true;
  }, "overpaymentExecutedAt can only be set when overpaymentStatus is executed or backfilled")
  .refine((data) => {
    if (data.actualOverpaymentAmount !== undefined && data.overpaymentStatus !== "executed" && data.overpaymentStatus !== "backfilled") {
      return false;
    }
    return true;
  }, "actualOverpaymentAmount can only be set when overpaymentStatus is executed or backfilled")
  .refine((data) => {
    if (data.remainingBalanceAfter !== undefined && data.paymentStatus !== "paid" && data.paymentStatus !== "backfilled") {
      return false;
    }
    return true;
  }, "remainingBalanceAfter can only be set when paymentStatus is paid or backfilled")
  .refine((data) => {
    if (data.reasonCode && data.overpaymentStatus !== "skipped" && data.overpaymentStatus !== "backfilled") {
      return false;
    }
    return true;
  }, "reasonCode can only be set when overpaymentStatus is skipped or backfilled")
  .transform((data) => data as PatchMonthlyExecutionLogCommand);

export type MonthlyExecutionLogQuery = z.infer<typeof monthlyExecutionLogQuerySchema>;
export type CreateMonthlyExecutionLog = z.infer<typeof createMonthlyExecutionLogSchema>;
export type PatchMonthlyExecutionLog = z.infer<typeof patchMonthlyExecutionLogSchema>;