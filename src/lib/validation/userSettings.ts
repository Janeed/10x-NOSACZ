import { z } from 'zod';

import { validationError } from '../errors.ts';
import type { UpdateUserSettingsCommand } from '../../types.ts';

const MAX_MONTHLY_OVERPAYMENT_LIMIT = 9_999_999_999.99;
const DECIMAL_TOLERANCE = 1e-6;

const hasAtMostTwoDecimalPlaces = (value: number): boolean => {
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(value - rounded) <= DECIMAL_TOLERANCE;
};

const numericStringSchema = z
  .string()
  .trim()
  .min(1, 'monthlyOverpaymentLimit is required')
  .transform((raw, ctx) => {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'monthlyOverpaymentLimit must be numeric' });
      return z.NEVER;
    }
    return parsed;
  });

const monthlyOverpaymentLimitSchema = z
  .union([z.number(), numericStringSchema])
  .pipe(
    z
      .number({ invalid_type_error: 'monthlyOverpaymentLimit must be numeric' })
      .refine((value) => Number.isFinite(value), 'monthlyOverpaymentLimit must be a finite number')
      .refine((value) => value >= 0, 'monthlyOverpaymentLimit must be greater than or equal to 0')
      .refine((value) => value <= MAX_MONTHLY_OVERPAYMENT_LIMIT, 'monthlyOverpaymentLimit exceeds the allowed maximum')
      .refine(hasAtMostTwoDecimalPlaces, 'monthlyOverpaymentLimit must not include more than two decimal places'),
  );

export const userSettingsUpdateSchema = z
  .object({
    monthlyOverpaymentLimit: monthlyOverpaymentLimitSchema,
    reinvestReducedPayments: z.boolean({ invalid_type_error: 'reinvestReducedPayments must be a boolean' }),
  })
  .strict();

const mapIssuesToErrorCode = (issues: z.ZodIssue[]): { code: string; message: string } => {
  if (issues.some((issue) => issue.code === z.ZodIssueCode.unrecognized_keys)) {
    return { code: 'EXTRANEOUS_PROPERTY', message: 'Request body contains unsupported properties' };
  }

  if (
    issues.some(
      (issue) =>
        issue.path[0] === 'monthlyOverpaymentLimit' &&
        issue.message === 'monthlyOverpaymentLimit must be greater than or equal to 0',
    )
  ) {
    return { code: 'NEGATIVE_LIMIT', message: 'monthlyOverpaymentLimit must be greater than or equal to 0' };
  }

  if (issues.some((issue) => issue.code === z.ZodIssueCode.invalid_type && issue.path.length === 0)) {
    return { code: 'INVALID_BODY', message: 'Request body must be a JSON object' };
  }

  return { code: 'INVALID_FIELD_VALUE', message: 'Invalid user settings payload' };
};

export const parseUserSettingsUpdate = (input: unknown): UpdateUserSettingsCommand => {
  const result = userSettingsUpdateSchema.safeParse(input);

  if (!result.success) {
    const issues = result.error.issues;
    const { code, message } = mapIssuesToErrorCode(issues);
    throw validationError(code, message, { issues });
  }

  return result.data;
};
