import { z } from "zod";

const simulationStatusEnum = z.enum([
  "running",
  "active",
  "completed",
  "stale",
  "cancelled",
  "error",
]);
const goalTypeEnum = z.enum(["fastest_payoff", "payment_reduction"]);

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const simulationListQuerySchema = paginationSchema
  .extend({
    status: simulationStatusEnum.optional(),
    isActive: z.coerce.boolean().optional(),
    stale: z.coerce.boolean().optional(),
    sort: z
      .enum(["created_at", "completed_at"])
      .optional()
      .default("created_at"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .strict();

const strategyEnum = z.enum(["avalanche", "snowball", "equal", "ratio"]);

export const createSimulationSchema = z
  .object({
    strategy: strategyEnum,
    goal: goalTypeEnum,
    reinvestReducedPayments: z.boolean(),
    monthlyOverpaymentLimit: z.number().min(0).optional(),
    paymentReductionTarget: z.number().positive().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.goal === "payment_reduction" &&
      val.paymentReductionTarget == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "paymentReductionTarget required for payment_reduction goal",
      });
    }
  });

export const simulationIdParamSchema = z.string().uuid();
export const includeParamSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) {
      return undefined;
    }

    const segments = val
      .split(",")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    return segments.length > 0 ? segments : undefined;
  })
  .refine(
    (val) => {
      if (!val) return true;
      return val.every((v) => v === "loanSnapshots");
    },
    { message: "Invalid include value. Only 'loanSnapshots' is supported." },
  );

export type SimulationListQuerySchema = typeof simulationListQuerySchema;
export type SimulationListQueryParsed = z.infer<
  typeof simulationListQuerySchema
>;

export type CreateSimulationSchema = typeof createSimulationSchema;
export type CreateSimulationParsed = z.infer<typeof createSimulationSchema>;

export type SimulationIdParamSchema = typeof simulationIdParamSchema;
export type SimulationIdParamParsed = z.infer<typeof simulationIdParamSchema>;

export type IncludeParamSchema = typeof includeParamSchema;
export type IncludeParamParsed = z.infer<typeof includeParamSchema>;
