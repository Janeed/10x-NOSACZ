# API Endpoint Implementation Plan: PUT /api/user-settings

## 1. Endpoint Overview
Upserts (create or update) the authenticated user's single `user_settings` row, which stores monthly overpayment configuration driving simulations. If no row exists it creates one (201 Created). If a row exists it updates mutable fields (200 OK) with optimistic concurrency control to prevent lost updates. A successful mutation marks any active simulations for the user as stale (`simulations.stale = true`) so downstream processes can recompute projections.

## 2. Request Details
- HTTP Method: PUT
- URL: `/api/user-settings`
- Query Parameters: none (reject any present with 400)
- Headers:
  - `Authorization: Bearer <JWT>` (required)
  - `If-Match: <etag>` (optional, recommended when updating; required to enforce optimistic locking)
  - `X-Request-Id` (optional inbound; middleware will generate if absent)
- Request Body (JSON):
```json
{
  "monthlyOverpaymentLimit": 1234.56,
  "reinvestReducedPayments": true
}
```
- Field Rules:
  - `monthlyOverpaymentLimit` (number | string numeric) >= 0, <= 9_999_999_999.99 (guard to prevent absurd values)
  - `reinvestReducedPayments` boolean
  - No additional properties (reject extraneous with 400)

## 3. Used Types
- `UpdateUserSettingsCommand` (from `src/types.ts`):
  - `{ monthlyOverpaymentLimit: number; reinvestReducedPayments: boolean }`
- `UserSettingsDto` response shape:
  - `{ userId: string; monthlyOverpaymentLimit: string | number; reinvestReducedPayments: boolean; updatedAt: string }`
- New internal service return model (proposed):
  - `UpsertUserSettingsResult = { dto: UserSettingsDto; created: boolean }`

## 4. Response Details
- Success (create): 201 Created
  - Body: `UserSettingsDto`
  - Headers: `X-Request-Id`, `ETag: <updatedAt ISO>`
- Success (update): 200 OK (same body & headers)
- Errors:
  - 400 Bad Request: validation failures (`INVALID_BODY`, `INVALID_FIELD_VALUE`, `NEGATIVE_LIMIT`, `EXTRANEOUS_PROPERTY`, `INVALID_QUERY`)
  - 401 Unauthorized: missing/invalid bearer token (`AUTH_REQUIRED`)
  - 409 Conflict: optimistic locking mismatch (`USER_SETTINGS_VERSION_MISMATCH`) or concurrent insert/update anomaly.
  - 500 Internal Server Error: unexpected failures (`SUPABASE_ERROR`, `SUPABASE_UNAVAILABLE`, `INTERNAL_ERROR`)
- Always mirror `X-Request-Id` header from middleware. On success, emit `ETag` using the persisted `updated_at` timestamp string.

## 5. Data Flow
1. Middleware authenticates request, sets `locals.userId`, `locals.supabase`, and `locals.requestId`.
2. Endpoint validates absence of query params.
3. Parse & validate JSON body using Zod schema (`userSettingsUpdateSchema`).
4. Extract `If-Match` header (expected previous `updatedAt`).
5. Call `upsertUserSettings(supabase, userId, command, ifMatch)`:
   - SELECT existing row: `user_settings` filtered by `user_id`.
   - If no row: INSERT with provided values (defaults enforced). Return created=true.
   - If row exists:
     - If `ifMatch` provided and `ifMatch !== existing.updated_at.toISOString()` → throw conflict.
     - Perform guarded UPDATE using timestamp match to enforce optimistic locking at DB layer: `update ... eq('user_id', userId) eq('updated_at', existing.updated_at)`; if update count = 0 → conflict.
     - Re-select row (or use returning) for fresh `updated_at`.
6. After successful upsert, mark active simulations stale:
   - `markActiveSimulationsStale(supabase, userId)` executes: `update simulations set stale = true where user_id = userId and is_active = true and stale = false`.
7. Build DTO (`UserSettingsDto`).
8. Log success with event `userSettings.put.success` including `{ created, userId, requestId }`.
9. Return `jsonResponse(dto, { status: created ? 201 : 200, headers: { 'X-Request-Id': requestId, 'ETag': dto.updatedAt } })`.
10. On error: map to `ApiError` via `toApiError`, log with appropriate severity and event name, respond via `errorResponse`.

## 6. Security Considerations
- Authorization: Must have valid bearer token; rely on middleware (reject otherwise with 401).
- RLS: Supabase policies enforce row ownership; all mutations include `user_id = auth.uid()`, so no IDOR risk if only the authenticated user id is used (no userId passed from client).
- Optimistic Locking: Prevent lost updates via `If-Match` header tied to `updated_at`. Without header, allow update but log warning `userSettings.put.missingIfMatch` to encourage concurrency safety.
- Input Validation: Use Zod to strictly coerce and bound `monthlyOverpaymentLimit`; reject non-finite numbers or more than 2 decimal places (round or error — propose error for clarity). Enforce boolean type for `reinvestReducedPayments`.
- Logging: Avoid sensitive data; only log numeric limit and flags for debugging at debug level if needed (omit for info level unless required). Include `requestId` always.
- ETag Exposure: Using timestamp only (not hashing private values) is acceptable; timestamp doesn’t leak sensitive info.

## 7. Error Handling
| Scenario | Status | Code | Action |
|----------|--------|------|--------|
| Query params present | 400 | INVALID_QUERY | Fail fast before body parsing |
| Missing body | 400 | INVALID_BODY | Fail with validationError |
| Extra properties | 400 | EXTRANEOUS_PROPERTY | Validation error |
| monthlyOverpaymentLimit < 0 | 400 | NEGATIVE_LIMIT | Validation error |
| Invalid type (NaN, Infinity) | 400 | INVALID_FIELD_VALUE | Validation error |
| Missing auth | 401 | AUTH_REQUIRED | From middleware or manual check |
| If-Match mismatch | 409 | USER_SETTINGS_VERSION_MISMATCH | conflictError |
| Concurrent update lost (update count=0) | 409 | USER_SETTINGS_VERSION_MISMATCH | conflictError |
| Supabase network failure | 500 | SUPABASE_UNAVAILABLE | internalError |
| Supabase returned error on select/update | 500 | SUPABASE_ERROR | internalError |
| Unexpected exception | 500 | INTERNAL_ERROR | internalError |

Logging Pattern:
- validation failures: `logger.warn('userSettings.put.validationFailed', message, { code, requestId, userId })`
- conflict: `logger.warn('userSettings.put.conflict', message, { requestId, userId })`
- success: `logger.info('userSettings.put.success', 'Upserted user settings', { created, userId, requestId })`
- internal errors: `logger.error('userSettings.put.error', message, { code, requestId, userId })`

## 8. Performance Considerations
- Single-row upsert per user; negligible load.
- Two DB round-trips for update case (SELECT + guarded UPDATE returning); creation path can use INSERT returning to save one.
- Stale marking update is a lightweight set-based UPDATE filtered by `is_active=true`; minimal overhead.
- Avoid supabase `.upsert()` since it lacks granular optimistic lock control; explicit SELECT + conditional UPDATE ensures correct 409 semantics.
- Indexes: `user_settings` PK on `user_id` sufficient; `simulations` index on `(user_id)` and partial `is_active` ensures fast stale marking.
- JSON serialization small; no pagination overhead.

## 9. Implementation Steps
1. Validation Schema: Create `src/lib/validation/userSettings.ts` exporting `userSettingsUpdateSchema` (Zod) and `parseUserSettingsUpdate(body) => UpdateUserSettingsCommand`.
2. Service Extension (`userSettingsService.ts`):
   - Add `upsertUserSettings(supabase, userId, command, ifMatch?): Promise<UpsertUserSettingsResult>` implementing flow above with guarded update.
   - Add `markActiveSimulationsStale(supabase, userId): Promise<void>`.
3. Endpoint Update (`src/pages/api/user-settings.ts`):
   - Add `export const PUT: APIRoute` alongside existing GET.
   - Reuse query param guard; reject if any present.
   - Resolve requestId (existing helper) & userId.
   - Parse JSON body: `await request.json()` then pass through validator.
   - Extract `If-Match` header.
   - Call service; handle returned `{ dto, created }`.
   - Log success; return response with status 201 or 200 and headers.
   - Catch errors; map via existing error handling pattern mirroring GET.
4. ETag Support: In PUT response add `ETag` header with `dto.updatedAt`; OPTIONAL: also add to GET for consistency (out of scope unless requested, document next step).
5. Concurrency Warning: If existing row & no `If-Match` provided, log warn event `userSettings.put.missingIfMatch` (still proceed).
6. no Unit Test needed
7. No Documentation needed
8. Observability: Verify logs include `requestId`. Confirm error responses carry `X-Request-Id` already via middleware + `errorResponse`.
9. Edge Case Handling:
   - Very large numeric strings: parse and validate bounds.
   - High concurrency: Two simultaneous updates—one succeeds, second hits 409 due to timestamp mismatch.
   - Insert race: If SELECT sees no row but INSERT conflicts (rare), fallback to update path with fresh SELECT.
10. Future Enhancements (record only, not in MVP): Add retryable backoff for transient Supabase failures; add rate limiting & ETag on GET.

## 10. Zod Schema Sketch (For Reference Only)
```ts
import { z } from 'zod';

export const userSettingsUpdateSchema = z.object({
  monthlyOverpaymentLimit: z.union([z.number(), z.string()])
    .transform(v => typeof v === 'string' ? Number(v) : v)
    .refine(v => Number.isFinite(v), 'monthlyOverpaymentLimit must be a finite number')
    .refine(v => v >= 0, 'monthlyOverpaymentLimit must be >= 0')
    .refine(v => v <= 9_999_999_999.99, 'monthlyOverpaymentLimit too large')
    .refine(v => Number((v).toFixed(2)) === v, 'monthlyOverpaymentLimit must have at most 2 decimal places'),
  reinvestReducedPayments: z.boolean(),
}).strict();

export type UserSettingsUpdateInput = z.infer<typeof userSettingsUpdateSchema>;
```

## 11. Service Function Sketch (For Reference Only)
```ts
export async function upsertUserSettings(supabase, userId: string, cmd: UpdateUserSettingsCommand, ifMatch?: string): Promise<UpsertUserSettingsResult> {
  // 1. Load existing
  const existingRes = await supabase.from('user_settings')
    .select('user_id, monthly_overpayment_limit, reinvest_reduced_payments, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingRes.error) throw internalError('SUPABASE_ERROR', 'Failed to read user settings', { cause: existingRes.error });

  const existing = existingRes.data;
  if (!existing) {
    // create path
    const insertRes = await supabase.from('user_settings').insert({
      user_id: userId,
      monthly_overpayment_limit: cmd.monthlyOverpaymentLimit,
      reinvest_reduced_payments: cmd.reinvestReducedPayments,
    }).select('user_id, monthly_overpayment_limit, reinvest_reduced_payments, updated_at').maybeSingle();
    if (insertRes.error || !insertRes.data) throw internalError('SUPABASE_ERROR', 'Insert failed', { cause: insertRes.error });
    return { created: true, dto: {
      userId: insertRes.data.user_id,
      monthlyOverpaymentLimit: insertRes.data.monthly_overpayment_limit,
      reinvestReducedPayments: insertRes.data.reinvest_reduced_payments,
      updatedAt: insertRes.data.updated_at,
    }};
  }

  if (ifMatch && ifMatch !== existing.updated_at) {
    throw conflictError('USER_SETTINGS_VERSION_MISMATCH', 'Settings modified by another process');
  }

  // guarded update
  const updateRes = await supabase.from('user_settings').update({
    monthly_overpayment_limit: cmd.monthlyOverpaymentLimit,
    reinvest_reduced_payments: cmd.reinvestReducedPayments,
  }).eq('user_id', userId).eq('updated_at', existing.updated_at)
    .select('user_id, monthly_overpayment_limit, reinvest_reduced_payments, updated_at').maybeSingle();

  if (updateRes.error) throw internalError('SUPABASE_ERROR', 'Update failed', { cause: updateRes.error });
  if (!updateRes.data) {
    throw conflictError('USER_SETTINGS_VERSION_MISMATCH', 'Concurrent update detected');
  }

  return { created: false, dto: {
    userId: updateRes.data.user_id,
    monthlyOverpaymentLimit: updateRes.data.monthly_overpayment_limit,
    reinvestReducedPayments: updateRes.data.reinvest_reduced_payments,
    updatedAt: updateRes.data.updated_at,
  }};
}
```

## 12. Acceptance Criteria Checklist
- Reject query params (400) ✔️
- Reject invalid / negative limit (400) ✔️
- Supports create (201) if row absent ✔️
- Supports update (200) ✔️
- Returns `ETag` = `updatedAt` ✔️
- Enforces optimistic concurrency with `If-Match` (409) ✔️
- Marks active simulations stale ✔️
- Logs all outcomes with `requestId` ✔️
- Uses Zod validation ✔️
- Uses middleware-provided Supabase client ✔️
- Propagates `X-Request-Id` ✔️

## 13. Future Enhancements (Documented Only)
- Add `version INT` column for explicit optimistic locking instead of timestamp.
- Apply consistent ETag header to GET endpoint.
- Rate limit updates.
- Audit trail table for settings changes.

---
This plan aligns with existing service patterns, error handling utilities, logging conventions, and RLS-protected Supabase schema. Implement steps sequentially for minimal risk and clear testability.
