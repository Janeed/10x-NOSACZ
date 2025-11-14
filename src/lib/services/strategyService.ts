import { z } from "zod";
import type { StrategyDto } from "../../types";

export const StrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

export const StrategyListSchema = z.array(StrategySchema);

const STRATEGIES: readonly StrategyDto[] = Object.freeze([
  {
    id: "avalanche",
    name: "Debt Avalanche",
    description: "Pay highest interest first",
  },
  {
    id: "snowball",
    name: "Debt Snowball",
    description: "Pay smallest balance first",
  },
  {
    id: "equal",
    name: "Equal Distribution",
    description: "Distribute overpayment equally",
  },
  {
    id: "ratio",
    name: "Ratio Allocation",
    description: "Allocate by interest share",
  },
]);

export function listStrategies(): StrategyDto[] {
  return STRATEGIES as StrategyDto[];
}
