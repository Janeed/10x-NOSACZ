# API Endpoint Implementation Plan: POST /api/auth/signout & POST /api/auth/reset-password

## 1. Endpoint Overview

### POST /api/auth/signout
Invalidates the currently authenticated Supabase session (revokes the refresh token). An idempotent operation: calling signout on an already invalid / revoked session still responds with success. Protected route requiring a valid `Authorization: Bearer <access_token>` header (middleware enforced).

### POST /api/auth/reset-password
Triggers Supabase to send a password reset email containing a magic link / code. Public route (does not require an existing session). Accepts an email address and returns 202 Accepted when the process is initiated. Per specification, returns 404 Not Found when the email is not registered (note: this introduces email enumeration risk—see Security Considerations).

## 2. Request Details

### POST /api/auth/signout
- HTTP Method: POST
- URL: `/api/auth/signout`
- Headers (required): `Authorization: Bearer <access_token>`
- Request Body: none (must be empty or `{}`)
- Query Parameters: none

### POST /api/auth/reset-password
- HTTP Method: POST
- URL: `/api/auth/reset-password`
- Headers: `Content-Type: application/json`
- Request Body (required):
  ```json
  { "email": "user@example.com" }
  ```
- Query Parameters: none

Parameters Classification:
- Required (signout): access token (header)
- Required (reset-password): `email`
- Optional (reset-password internal): redirect URL configured by env (`PUBLIC_RESET_PASSWORD_REDIRECT_URL` or fallback to site origin)

## 3. Used Types

Existing shared types from `src/types.ts`:
- `AuthSignoutResponse = void` (204 No Content)
- `AuthResetPasswordRequest { email: string }`
- `AuthResetPasswordResponse { accepted: boolean }`

New / Extended Validation Types (Zod to be added in `src/lib/validation/auth.ts`):
- `authResetPasswordSchema` → ensures: trimmed, lowercased, `.email()`, length 6–254.
- Inferred type: `AuthResetPasswordParsed`.

No additional DTOs required for signout since response body is empty.

## 4. Response Details

### POST /api/auth/signout
- Success: `204 No Content` (empty body)
- Errors:
  - `401 Unauthorized` (handled by middleware: missing or invalid token)
  - `429 Too Many Requests` (if Supabase returns rate limit status during revocation – optional surface)
  - `500 Internal Server Error` (unhandled Supabase failure / unexpected condition)

### POST /api/auth/reset-password
- Success: `202 Accepted`
  ```json
  { "accepted": true }
  ```
- Errors:
  - `400 Bad Request` (invalid / missing email field, malformed JSON)
  - `404 Not Found` (email not registered – per spec; see security note)
  - `429 Too Many Requests` (Supabase rate limit for password reset requests)
  - `500 Internal Server Error` (Supabase unreachable or unexpected error)

Standard Error Envelope (reuse existing error response helper):
```json
{
  "error": {
    "code": "ERR_CODE",
    "message": "Human readable message",
    "details": { /* optional structured context */ },
    "requestId": "uuid"
  }
}
```

## 5. Data Flow

### Signout
1. Request reaches middleware → validates bearer token, fetches user via `supabase.auth.getUser(accessToken)`; injects `locals.supabase`, `locals.userId`, `locals.requestId`.
2. Route handler (`POST`) calls `authService.signOut(supabase)`.
3. Service invokes `supabase.auth.signOut()` → Supabase revokes the refresh token.
4. On success → return `204` with `X-Request-Id` header set (middleware ensures if absent).
5. On Supabase error → map to appropriate custom error and return via `errorResponse` helper.

### Reset Password
1. Middleware sees public path → does not enforce authentication; sets `locals.supabase` and `locals.requestId` (no userId).
2. Route parses JSON body, validates against `authResetPasswordSchema`. Normalizes email.
3. Service `authService.resetPassword(supabase, { email })` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
4. Supabase returns success (no user object) → respond with `202` and `{ accepted: true }`.
5. If Supabase returns user-not-found (status 404) → respond with `404` (per spec) and structured error.
6. Rate limit or other errors mapped accordingly; log each failure with masked email.

## 6. Security Considerations
- Email Enumeration: Returning 404 exposes whether an email is registered. Mitigation option (future): always return 202 regardless; for now, adhere to spec and document risk.
- Rate Limiting: Implement IP+email throttling (e.g., max 5 reset requests per 10 minutes). For MVP, rely on Supabase 429 plus TODO note for custom limiter.
- Token Revocation: Ensure signout always runs after token validation (middleware precedence). Idempotent; no leak on repeated calls.
- PII Logging: Mask email in logs: transform `localPart` to first char + `***` + domain. Example: `u***@example.com`.
- Transport Security: Assume HTTPS enforced externally; no cookies used (Bearer strategy avoids CSRF).
- Brute Force / Spam: Add honey-time delay (e.g., 150–300ms jitter) before 202 to reduce enumeration timing signals (optional future enhancement).
- Redirect URL Safety: Validate `PUBLIC_RESET_PASSWORD_REDIRECT_URL` to ensure it’s an allowed origin controlled by the application.

## 7. Error Handling

Mapping Strategy (using existing error factories in `src/lib/errors.ts` and adding `notFoundError` if missing):

| Scenario | Endpoint | Status | Error Code | Action |
|----------|----------|--------|------------|--------|
| Missing Authorization | signout | 401 | AUTH_REQUIRED | Middleware returns early |
| Invalid / expired token | signout | 401 | AUTH_REQUIRED | Middleware returns early |
| Supabase signOut 429 | signout | 429 | RATE_LIMITED | `tooManyRequestsError` |
| Supabase signOut generic 4xx | signout | 401 | INVALID_SESSION | Map to unauthorized |
| Supabase signOut server failure | signout | 500 | SUPABASE_ERROR | Internal error |
| Malformed JSON | reset-password | 400 | VALIDATION_ERROR | Zod parse failure |
| Missing email | reset-password | 400 | VALIDATION_ERROR | Zod parse failure |
| Invalid email format | reset-password | 400 | VALIDATION_ERROR | Zod parse failure |
| Email not registered | reset-password | 404 | EMAIL_NOT_FOUND | `notFoundError` |
| Supabase 429 | reset-password | 429 | RATE_LIMITED | `tooManyRequestsError` |
| Supabase generic 4xx | reset-password | 400 | VALIDATION_ERROR | validationError |
| Supabase unreachable | reset-password | 500 | SUPABASE_UNAVAILABLE | internalError |
| Unexpected exception | both | 500 | INTERNAL_ERROR | internalError |

Logging Pattern:
- Success: `auth.signout.success` / `auth.resetPassword.success` (masked email).
- Failure: `auth.signout.failure` / `auth.resetPassword.failure` with `error.code`, `supabaseStatus`, `requestId`.

## 8. Performance Considerations
- Single external call per request → negligible latency.
- Avoid redundant user fetch on signout (middleware already validated user, but Supabase signOut doesn’t need userId fetch again; current design still calls signOut only after middleware validation, not re-fetch).
- Rate limiting structure (future) should use an efficient in-memory LRU or Redis (if multi-instance) to avoid lock contention.
- JSON parsing & Zod validation cost trivial given tiny payload.
- Do not await extraneous logging operations; keep them synchronous minimal or offloaded.

## 9. Implementation Steps
1. Path Alignment: Confirm all auth routes reside under `/api/auth/*`. Adjust spec path for reset-password accordingly.
2. Middleware Update: Add `"/api/auth/reset-password"` to `PUBLIC_API_PATHS` set; ensure signout path is omitted so it remains protected.
3. Validation Schema: Extend `src/lib/validation/auth.ts` with:
   ```ts
   export const authResetPasswordSchema = z.object({
     email: z.string().trim().min(6).max(254).email().transform(v => v.toLowerCase())
   }).strict();
   export type AuthResetPasswordParsed = z.infer<typeof authResetPasswordSchema>;
   ```
4. Error Utilities: If `notFoundError` helper does not exist in `src/lib/errors.ts`, implement it following existing pattern (returns structured error with 404). Add tests (future task) or at least internal consistency.
5. Auth Service Additions (`src/lib/services/authService.ts`):
   - Implement `export async function signOut(supabase): Promise<void>` calling `supabase.auth.signOut()` with error mapping.
   - Implement `export async function resetPassword(supabase, { email }: AuthResetPasswordParsed): Promise<{ accepted: boolean }>` using `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
6. Email Mask Helper: Add helper (e.g., `maskEmail(email: string): string`) to `src/lib/utils.ts` or inline in auth service for logging.
7. API Route: Create `src/pages/api/auth/signout.ts`:
   - Export `export const POST: APIRoute = async ({ locals }) => { ... }`.
   - Call `signOut(locals.supabase)`. On success return `new Response(null, { status: 204, headers: { 'X-Request-Id': locals.requestId } })`.
   - Catch errors → return `errorResponse(err, locals.requestId)`.
8. API Route: Create `src/pages/api/auth/reset-password.ts`:
   - Parse JSON body; validate with `authResetPasswordSchema`.
   - Call `resetPassword(locals.supabase, parsed)`.
   - Return `202` with body `{ accepted: true }`.
   - Handle Zod errors via `validationError` mapping (like signup/signin patterns).
9. Rate Limiting (Optional MVP Stub): In `reset-password.ts`, implement simple in-memory throttle (Map keyed by email+IP → timestamps) with early return `tooManyRequestsError` if threshold exceeded; document future Redis move.
10. Logging: Use `logger.info/warn/error` with event keys, masked email, requestId.
11. Tests (Future / Next Step): Add integration tests simulating success & failure for both routes using a mocked Supabase client. Edge cases: invalid email, unregistered email, rate limit, signout with invalid token.
12. Documentation: Update `DOCS/API-PLAN.md` (if necessary) to reflect path normalization `/api/auth/reset-password` and note enumeration risk under Security section.
13. Observability: Confirm responses always include `X-Request-Id` (middleware ensures; route should not override incorrectly).
14. Deployment Config: Ensure `PUBLIC_RESET_PASSWORD_REDIRECT_URL` (or similar) is set in environment; fallback strategy (origin detection) documented with TODO for strict allowlist.
15. Post-Deployment Verification: Manually trigger reset password for known and unknown email; confirm expected status codes & absence of raw email in structured logs.

## 10. Edge Cases & Decisions Log
- Idempotent Signout: Always 204; no error if already revoked.
- 404 Email Lookup: Accepted per spec despite enumeration risk; mitigation documented.
- Optional Rate Limit: Not strictly in spec; added as recommended improvement.
- No Caching: Not needed—operations are immediate, single external call.

## 11. Future Enhancements (Non-blocking)
- Uniform response for reset-password (always 202) controlled by config flag `MASK_ACCOUNT_EXISTENCE`.
- Add structured audit table for security-sensitive actions (password resets & signouts) with hashed email + timestamp for anomaly detection.
- Implement distributed rate limiting via Redis or Supabase Edge Functions.
- Add Sentry (or similar) integration for auth service error tracing.

---
Implementation plan complete. Follow steps sequentially; code changes confined to validation, auth service, middleware list, and two new route files plus optional error helper addition.
