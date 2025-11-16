import { z } from "zod";
import { InvalidIncludeError } from "../errors";

const ALLOWED_INCLUDE_TOKENS = ["interestBreakdown", "monthlyTrend"] as const;

const includeSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return [];
    const tokens = val
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const invalidTokens = tokens.filter(
      (t) =>
        !ALLOWED_INCLUDE_TOKENS.includes(
          t as (typeof ALLOWED_INCLUDE_TOKENS)[number],
        ),
    );
    if (invalidTokens.length > 0) {
      throw new InvalidIncludeError(
        `Invalid include parameter: ${invalidTokens.join(", ")}. Allowed values: ${ALLOWED_INCLUDE_TOKENS.join(", ")}`,
      );
    }
    return tokens as string[];
  });

export const parseInclude = (query: string | undefined): string[] => {
  try {
    const includes = includeSchema.parse(query);
    return includes;
  } catch (error) {
    if (error instanceof InvalidIncludeError) {
      throw error;
    }
    throw new InvalidIncludeError("Invalid include parameter format");
  }
};
