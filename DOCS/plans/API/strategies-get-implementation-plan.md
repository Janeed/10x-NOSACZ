# API Endpoint Implementation Plan: GET /api/strategies

## 1. Endpoint Overview

Provides a static registry of supported debt payoff strategies (e.g. Avalanche, Snowball, Equal Distribution, Ratio Allocation) including human‑readable names and short descriptions. Enables the client to populate selection UIs and validate allowed `strategy` values prior to creating simulations. No persistence or user-specific state; data is configuration-driven and constant across requests. Still enforces authentication for consistency with `/api/*` namespace security posture.

### Contract (Summary)

- Input: No query params, no body.
- Auth: Bearer JWT required (Supabase). 401 if missing/invalid.
- Output: `200 OK` with JSON array of `StrategyDto`.
- Errors: 401 (unauthorized), 500 (unexpected internal failure). No 400/404 for static list.

## 2. Request Details

- HTTP Method: GET
- URL: `/api/strategies`
- Query Parameters:
  - Required: none
  - Optional: none (future extension could allow `?include=metadata`)
- Request Body: none
- Headers:
  - Required: `Authorization: Bearer <access_token>`
  - Response: echoes `X-Request-Id` from middleware.

## 3. Used Types

- Existing DTO: `StrategyDto` (from `src/types.ts`)
  - Shape: `{ id: string; name: string; description: string; }`
- Zod Schemas (to introduce in implementation file or dedicated validation module):
  - `const StrategySchema = z.object({ id: z.string(), name: z.string(), description: z.string() });`
  - `const StrategyListSchema = z.array(StrategySchema);`
    (No Command Model needed; read-only.)

## 4. Response Details

- Success `200 OK`:

```json
[
  {
    "id": "avalanche",
    "name": "Debt Avalanche",
    "description": "Pay highest interest first"
  },
  {
    "id": "snowball",
    "name": "Debt Snowball",
    "description": "Pay smallest balance first"
  },
  {
    "id": "equal",
    "name": "Equal Distribution",
    "description": "Distribute overpayment equally"
  },
  {
    "id": "ratio",
    "name": "Ratio Allocation",
    "description": "Allocate by interest share"
  }
]
```

- Error Responses:
  - `401 Unauthorized` JSON: `{ "error": "unauthorized", "message": "Missing or invalid token" }`
  - `500 Internal Server Error` JSON: `{ "error": "internal_error", "message": "Unexpected server error" }`

## 5. Data Flow

1. Astro route handler (`src/pages/api/strategies.ts`) receives GET request.
2. Middleware already attached sets `locals.supabase`, `locals.user`, `locals.requestId` after JWT verification.
3. Handler verifies user context (`locals.user` present); else early return 401.
4. Invoke `strategyService.listStrategies()` returning static in-memory array of `StrategyDto` objects.
5. Optionally validate list with `StrategyListSchema.parse(strategies)` in non-production or always (cheap cost).
6. Log success with requestId.
7. Send 200 response body array; set `X-Request-Id` header.
   (No database or external service calls.)

## 6. Security Considerations

- Authentication: Require valid Supabase JWT; rely on existing middleware for `getUser()` call. Check presence of `locals.user` explicitly.
- Authorization: All authenticated users may access; no role restriction.
- Input Validation: None needed (no params). Defensive check: reject any unexpected query params if future misuse occurs (not mandatory now).
- Output Integrity: Hard-coded constants reduce risk of injection; still ensure description strings do not contain user-supplied content.
- Rate Limiting: Existing global middleware rate limits apply—endpoint is inexpensive; no special handling required.
- Abuse Mitigation: Because data is static, caching at CDN/edge reduces repeated auth overhead; however ensure private data not included.

## 7. Error Handling

| Scenario                                | Status | Action                | Logged Fields                          |
| --------------------------------------- | ------ | --------------------- | -------------------------------------- |
| Missing/invalid Authorization header    | 401    | Return error JSON     | requestId, path, reason="auth_missing" |
| Supabase client failure (rare)          | 500    | Return internal error | requestId, path, error stack           |
| Unexpected runtime exception in service | 500    | Return internal error | requestId, path, error stack           |

All errors use shared response helper (see `src/lib/http/responses.ts`) for consistency if available; else implement minimal helper. Ensure not to expose stack in `message` for production.

## 8. Performance Considerations

- Static list: O(1) time and memory; negligible.
- Caching: Safe to set `Cache-Control: public, max-age=3600` because list identical for all users and not sensitive. (Optional MVP enhancement.)
- Avoid re-validating with Zod on each request if profiling shows micro overhead; can freeze validated constant.
- Low latency path (no I/O). Logging should be structured and minimal.

## 9. Implementation Steps

1. Create `src/lib/services/strategyService.ts` if absent.
   - Export `listStrategies(): StrategyDto[]` returning frozen constant `STRATEGIES`.
   - Define `STRATEGIES` array with four strategies (ids align with database `strategy` field expectations).
   - (Optional) Export Zod schemas or keep them in `src/lib/validation/strategies.ts` if pattern established.
2. Add validation schema (Zod) file if project convention: `src/lib/validation/strategies.ts` with `StrategySchema` & `StrategyListSchema`.
3. Implement Astro route: `src/pages/api/strategies.ts`.
   - `export const GET: APIRoute = async ({ locals }) => { ... }`.
   - Guard: if no `locals.user` return 401 using shared error helper.
   - Fetch list via service; (optional) validate.
   - Return 200 with JSON array.
   - Set headers: `Content-Type: application/json`, `X-Request-Id`.
   - (Optional) Add `Cache-Control` header.
4. Logging: Use existing `logger.ts`. Log at info level: `{ requestId, endpoint: '/api/strategies', count: strategies.length }`.
5. Add unit test (if test framework present) or script:
   - Assert 200 with valid auth, body length > 0, structure matches schema.
   - Assert 401 without Authorization header (simulate missing middleware user context).
6. Update documentation:
   - Ensure `DOCS/API-PLAN.md` already lists endpoint; confirm it matches final descriptions (no change needed unless adding strategies beyond avalanche).
7. (Optional) Add export of strategies to front-end consumption (e.g. for building forms) via a shared module if necessary.
8. (Optional) Verify TypeScript build and lint pass; run project start to manually hit endpoint.
9. Future extensibility note: If strategies gain parameter requirements, evolve `StrategyDto` to include `requiredParameters: string[]` and update service & schema.

## 10. Edge Cases & Future Enhancements

- Edge Cases: Missing auth only; internal exception. Empty list theoretically possible if array mutated—guard with freeze.
- Enhancements: Introduce registry table for dynamic strategies; versioning, parameter metadata, i18n descriptions.
- Observability: Could add timing metrics; trivial now.

## 11. Sample Implementation Sketch (Illustrative Only)

```ts
// src/lib/services/strategyService.ts
import { StrategyDto } from "../../types";
import { z } from "zod";
const StrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});
const StrategyListSchema = z.array(StrategySchema);
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
export { StrategySchema, StrategyListSchema };
```

```ts
// src/pages/api/strategies.ts
import type { APIRoute } from "astro";
import { listStrategies } from "../../lib/services/strategyService";
import { StrategyListSchema } from "../../lib/services/strategyService";
import { ok, unauthorized, internalError } from "../../lib/http/responses";
export const GET: APIRoute = async ({ locals }) => {
  const { user, requestId } = locals as any;
  if (!user) return unauthorized("Missing or invalid token", requestId);
  try {
    const data = listStrategies();
    StrategyListSchema.parse(data); // cheap validation
    return ok(data, requestId, { "Cache-Control": "public, max-age=3600" });
  } catch (err) {
    return internalError("Unexpected server error", requestId, err);
  }
};
```

(Actual implementation will adapt existing response helper signatures.)

## 12. Acceptance Criteria

- Authenticated request returns 200 JSON array with >= 1 strategy.
- Unauthenticated request returns 401.
- Response contains `X-Request-Id` header.
- Each object matches `StrategyDto` shape; TypeScript passes build.
- Lint passes; optional basic test green.
- No database queries executed.

---

This plan provides the development team with clear, actionable steps to implement `/api/strategies` consistently with project conventions.
