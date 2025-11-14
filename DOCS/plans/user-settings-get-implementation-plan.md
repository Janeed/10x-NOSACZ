# API Endpoint Implementation Plan: GET /api/user-settings

## 1. Endpoint Overview
Retrieve the authenticated user’s loan overpayment configuration (`user_settings` single-row per user). Returns current limits and behavioral flags influencing simulation runs. If the user has never customized settings (row absent), respond with 404 (settings not initialized). Does not create defaults implicitly to avoid silent state coupling with simulations.

## 2. Request Details
- HTTP Method: GET
- URL: `/api/user-settings`
- Parameters:
  - Required: none (user identity comes from auth token / middleware injected `userId`).
  - Optional: none
- Headers:
  - `Authorization: Bearer <JWT>` (Supabase access token) — required.
  - `X-Request-Id` (optional inbound; if middleware sets one, echo on response).
- Request Body: none

### Preconditions / Guards
1. Valid authenticated session (Supabase `auth.getUser` already performed in middleware).
2. `userId` present in `Astro.locals`.

## 3. Used Types
- Domain DTO: `UserSettingsDto` (from `src/types.ts`).
  ```ts
  type UserSettingsDto = {
    userId: string; // UUID
    monthlyOverpaymentLimit: string | number; // NUMERIC(14,2) from Supabase (may arrive as string)
    reinvestReducedPayments: boolean;
    updatedAt: string; // ISO timestamp
  };
  ```
- Internal Row Mapping (Supabase): columns `user_id`, `monthly_overpayment_limit`, `reinvest_reduced_payments`, `updated_at`.

## 4. Response Details
### Success (200 OK)
```json
{
  "userId": "uuid",
  "monthlyOverpaymentLimit": "decimal",
  "reinvestReducedPayments": true,
  "updatedAt": "timestamp"
}
```

### Error Responses
| Status | Code | Message | When |
|--------|------|---------|------|
| 401 | AUTH_REQUIRED | Missing or invalid bearer token | Middleware rejects / no userId |
| 404 | USER_SETTINGS_NOT_FOUND | User settings not initialized | No row for user_id |
| 429 | RATE_LIMITED | Too many requests | Upstream rate limiter |
| 500 | INTERNAL_ERROR | Internal server error | Unexpected DB / mapping failure |

Error payload format (from `errorResponse` helper):
```json
{
  "error": { "code": "USER_SETTINGS_NOT_FOUND", "message": "User settings not initialized" },
  "requestId": "..." // if available
}
```

## 5. Data Flow
1. Middleware authenticates JWT via Supabase client -> injects `userId` in `locals`.
2. Handler (`GET`) obtains Supabase client from `Astro.locals.supabase` (rule: use context, not direct import).
3. Service layer `userSettingsService.getUserSettings(userId)` executes:
   - `supabase.from('user_settings')`
   - `.select('user_id, monthly_overpayment_limit, reinvest_reduced_payments, updated_at')`
   - `.eq('user_id', userId).maybeSingle()` (avoids thrown error when not found)
4. If `data` is `null` => throw `ApiError` (404 USER_SETTINGS_NOT_FOUND).
5. Map row fields to camelCase DTO. Preserve numeric precision by emitting as string (no float parse) to prevent rounding drift.
6. Return 200 JSON response via `jsonResponse(dto, { status: 200 })`.
7. Errors bubble and are converted with `errorResponse()`.

## 6. Security Considerations
- Authentication: Requires valid Supabase JWT; rely on existing middleware (`supabase.auth.getUser`).
- Authorization: Row-Level Security (RLS) ensures only the owner can SELECT their row. Query filtered by `user_id = auth.uid()` implicitly enforced by RLS and explicit `.eq`.
- Least Exposure: Selecting explicit column list (no wildcard) prevents accidental leakage of added future columns.
- IDOR Prevention: No external identifiers accepted; `userId` solely from token — eliminates horizontal access risk.
- Timing Attacks: 404 reveals absence (acceptable per spec). No distinction between uninitialized vs unauthorized once middleware passes.
- Injection Safety: Supabase client uses prepared statements; no interpolated raw SQL.
- Logging: Use structured logging without leaking token. Include `requestId` for correlation.

## 7. Error Handling
- Not Found: Return 404 with code `USER_SETTINGS_NOT_FOUND`.
- Unauthorized: Middleware short-circuits with 401 `AUTH_REQUIRED` before handler executes.
- Rate Limit: Middleware returns 429 `RATE_LIMITED`.
- Internal: Unexpected Supabase errors -> wrap with `internalError('INTERNAL_ERROR', 'Internal server error')` including original cause.
- Validation: None (no input), but if `userId` missing treat as unauthorized safeguard.
- Observability: Log at `info` for successful fetch (event `userSettings.fetch.success`). Log at `warn` for 404. Log at `error` for internal failures including cause snapshot.

## 8. Performance Considerations
- Single-row primary key lookup; latency dominated by network; minimal optimization needed.
- Select only required columns (already minimal). Avoid `single()` that may cost extra error handling; use `maybeSingle()`.
- JSON serialization trivial; ensure no expensive transformations.

## 9. Implementation Steps
1. Service Creation: `src/lib/services/userSettingsService.ts`
   - Export `getUserSettings(supabase: SupabaseClient, userId: string): Promise<UserSettingsDto>`.
   - Query with `.maybeSingle()`, throw `not found` ApiError if `data === null`.
   - Map fields (use string returns for NUMERIC values as received). Guard `reinvest_reduced_payments` boolean integrity.
2. Error Codes: Add constants (optional) or inline strings: `USER_SETTINGS_NOT_FOUND`.
3. Endpoint File: `src/pages/api/user-settings.ts` (Astro API route)
   - `export const GET: APIRoute = async ({ locals, request }) => { ... }`
   - Extract `userId` from `locals.userId`; if absent -> `errorResponse(unauthorizedError('AUTH_REQUIRED', 'Authentication required'))`.
   - Call service; build dto; return `jsonResponse(dto, { status: 200, headers: withRequestId })`.
4. Logging: In handler add:
   - success: `logger.info('userSettings.fetch.success', 'Fetched user settings', { userId })`
   - not found: inside catch for 404: `logger.warn('userSettings.fetch.notFound', 'Settings not initialized', { userId })`
   - error: `logger.error('userSettings.fetch.error', 'Failed fetching user settings', { userId, error: toApiError(e) })`
5. Response ID: If middleware sets `requestId`, include header `X-Request-Id` on success; errorResponse already handles this.

## 10. Edge Cases & Notes
- Fresh user (no row) -> 404.
- Concurrent creation by another endpoint (PUT) between authorization and fetch is benign (row appears -> 200).
- Numeric precision: Keep as string if Supabase returns string; avoid Number coercion for values > 2^53 boundary (not expected but consistent practice for monetary fields).
- RLS misconfiguration fallback: If Supabase returns permission error (status 401/403), wrap as internal or unauthorized as appropriate (prefer 401 if token invalid, else 500 with code `INTERNAL_ERROR`).
