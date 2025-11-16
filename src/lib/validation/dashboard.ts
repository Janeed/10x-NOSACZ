import { InvalidIncludeError } from "../errors.ts";

export interface DashboardIncludeOptions {
  monthlyTrend: boolean;
  interestBreakdown: boolean;
  adherence: boolean;
}

const TOKEN_TO_FLAGS: Record<string, (keyof DashboardIncludeOptions)[]> = {
  graphs: ["monthlyTrend", "interestBreakdown"],
  adherence: ["adherence"],
  monthlyTrend: ["monthlyTrend"],
  interestBreakdown: ["interestBreakdown"],
};

const ALLOWED_INCLUDE_TOKENS = Object.keys(TOKEN_TO_FLAGS);

const DEFAULT_INCLUDE_WITH_PARAM: DashboardIncludeOptions = {
  monthlyTrend: false,
  interestBreakdown: false,
  adherence: false,
};

const DEFAULT_INCLUDE_NO_PARAM: DashboardIncludeOptions = {
  monthlyTrend: false,
  interestBreakdown: false,
  adherence: true,
};

const setFlag = (
  target: DashboardIncludeOptions,
  flag: keyof DashboardIncludeOptions,
) => {
  target[flag] = true;
};

export const parseInclude = (
  query: string | undefined,
): DashboardIncludeOptions => {
  if (!query) {
    return { ...DEFAULT_INCLUDE_NO_PARAM };
  }

  const tokens = query
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { ...DEFAULT_INCLUDE_NO_PARAM };
  }

  const include: DashboardIncludeOptions = {
    ...DEFAULT_INCLUDE_WITH_PARAM,
  };

  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const flags = TOKEN_TO_FLAGS[token];
    if (!flags) {
      invalidTokens.push(token);
      continue;
    }

    for (const flag of flags) {
      setFlag(include, flag);
    }
  }

  if (invalidTokens.length > 0) {
    throw new InvalidIncludeError(
      `Invalid include parameter: ${invalidTokens.join(", ")}. Allowed values: ${ALLOWED_INCLUDE_TOKENS.join(", ")}`,
    );
  }

  return include;
};
