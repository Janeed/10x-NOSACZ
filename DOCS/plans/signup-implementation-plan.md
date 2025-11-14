# API Endpoint Implementation Plan: POST /auth/signup

## 1. Endpoint Overview
Registers a new user account using Supabase Auth. Accepts an email and password, validates input, delegates creation to Supabase, and returns a normalized AuthSignupResponse containing user id/email and session tokens. Ensures proper status codes (201 on success) and secure handling of credentials. Provides consistent error mapping (400 validation, 409 conflict when email already exists, 500 unexpected).

## 2. Request Details
- HTTP Method: POST
- URL Structure: /auth/signup (Astro endpoint under `src/pages/api/auth/signup.ts`)
- Query Parameters: none (reject any unexpected query params with 400 to avoid silent misuse)
- Required Body Fields:
  - email: string (valid RFC 5322 email subset; normalized to lowercase)
  - password: string (minimum length; enforce complexity rules configurable)
- Optional Body Fields: none (fail fast if extras included unless we decide to ignore; recommend: allow only these two keys and reject unknown to prevent silent bugs)
- Content-Type: application/json (reject others with 400)
- Max Body Size: 10KB (prevent abuse; can be enforced at middleware or adapter)

### Input Contract (After Validation)
```
AuthSignupRequest {
  email: string; // lowercase, trimmed
  password: string; // raw password (not logged)
}
```

## 3. Used Types
- DTOs (from `src/types.ts`):
  - AuthSignupRequest
  - AuthSignupResponse
- Internal service result type (new):
  - SignUpResult = { userId: string; email: string; accessToken: string; refreshToken: string }
- Error model (internal):
  - ApiError { status: number; code: string; message: string; details?: unknown }

## 4. Response Details
### Success (201 Created)
```
{
  "user": { "id": "uuid", "email": "string" },
  "session": { "accessToken": "jwt", "refreshToken": "string" }
}
```
Notes:
- Uses camelCase token fields (`accessToken`, `refreshToken`) to align with `AuthSignupResponse` in `types.ts` while Supabase raw response provides `access_token` / `refresh_token` which are mapped internally.
Headers:
- Cache-Control: no-store
- Content-Type: application/json; charset=utf-8

### Error Responses
- 400 Bad Request: invalid email/password format or missing fields
  - code: VALIDATION_ERROR
- 409 Conflict: Supabase returns email already registered
  - code: EMAIL_EXISTS
- 429 Too Many Requests (optional future): rate limit exceeded
  - code: RATE_LIMITED
- 500 Internal Server Error: unexpected Supabase failure or unhandled exception
  - code: INTERNAL_ERROR

### Error Body Shape
```
{
  "error": { "code": "EMAIL_EXISTS", "message": "Email already registered" }
}
```
Note: A shared `ErrorResponse` type is not yet defined in `types.ts`; this plan anticipates adding one later. No changes to existing types per instructions.

## 5. Data Flow
1. Request arrives at Astro API route (`signup.ts`).
2. Middleware ensures `locals.supabase` client is available (per project rule) and parses JSON body.
3. Validate body via Zod schema (strict() to disallow unknown keys).
4. Call `authService.signUp(email, password)`; service wraps Supabase `supabase.auth.signUp({ email, password })`.
5. Service interprets Supabase response:
  - On success: extract `user.id`, `user.email` and map `session.access_token` → `accessToken`, `session.refresh_token` → `refreshToken`.
   - On known error (e.g., `AuthApiError` with status 422 or 400 + message containing 'already registered'): map to 409.
6. Controller builds DTO `AuthSignupResponse` and returns with 201.
7. Errors propagate through unified error handler converting `ApiError` to HTTP response.

## 6. Security Considerations
- Authentication: Endpoint itself is public (unauthenticated) but must not leak whether an email exists beyond 409—avoid differential messages (generic wording acceptable).
- Authorization: Not applicable (new account creation). Ensure no existing session privileges escalate.
- Input Validation: Strict Zod schema; reject invalid emails, enforce password length (e.g., >= 8), optionally complexity (1 upper, 1 lower, 1 digit). Avoid storing or logging raw password.
- Rate Limiting: Recommend IP + email attempt limit (e.g., 10/minute). If infrastructure not yet present, add TODO & interface hook.
- Brute Force Mitigation: Combined rate limit + enforced password complexity.
- Enumeration Risk: Uniform error phrasing. Still using 409 for existing email per spec; ensure message not more descriptive than necessary.
- Transport Security: Assumes HTTPS termination at platform.
- Secrets Handling: Use server-side Supabase service role only if needed (signup normally uses public anon key). Ensure not exposing service key to client.
- Logging Hygiene: Never log password or tokens; redaction of email acceptable if compliance required.
- Response Tokens: Mark response as no-store. Consider setting `HttpOnly` cookies (future) instead of returning raw tokens in body.
- Timing Attacks: Uniform validation path; quickly fail on malformed input.

## 7. Error Handling
Centralized error utility creates `ApiError`. Mappings:
- Zod validation issues -> 400 VALIDATION_ERROR (aggregate messages concise).
- Supabase duplicate email (status 422 or message contains 'already registered') -> 409 EMAIL_EXISTS.
- Supabase network/timeout -> 500 SUPABASE_UNAVAILABLE.
- Unexpected exception -> 500 INTERNAL_ERROR.
Logging:
- Log structured error (level=warn for 4xx, error for 5xx) with correlation id.
- Fields: event=signup, status, code, emailHash (SHA256 of lowercase email for privacy), latencyMs.
No error table specified; if an error audit table is added later, encapsulate insert in error logger.

## 8. Performance Considerations
- Supabase signUp is network-bound; typical latency <500ms.
- Validation is trivial CPU-wise; ensure schema compiled once (reuse exported schema object).
- Avoid extra Supabase queries—single call only.
- Enable HTTP keep-alive (framework default).

## 9. Implementation Steps
1. Define Zod schema in `src/lib/validation/auth.ts`:
   - `export const authSignupSchema = z.object({ email: z.string().trim().min(6).max(254).email().transform(v => v.toLowerCase()), password: z.string().min(8).max(128) }).strict();`
2. Create service `src/lib/services/authService.ts`:
   - `signUp(supabaseClient, { email, password }): Promise<SignUpResult>`
   - Handle Supabase response & map known error messages/status.
3. Add error utility `src/lib/errors.ts` with `class ApiError extends Error` and factory helpers (validationError, conflictError, internalError).
4. Add logger `src/lib/logger.ts` (simple wrapper around console with structured object logging).
5. Implement route handler `src/pages/api/auth/signup.ts`:
   - Parse JSON; guard Content-Type.
   - Validate with schema; on failure throw validation ApiError.
   - Acquire `locals.supabase` client.
   - Call `authService.signUp`.
   - Construct `AuthSignupResponse` aligning with `types.ts`.
   - Return 201.
6. Add centralized error handling (if not existing): pattern in each route or shared wrapper utility.
7. Add unit tests:
   - Validation success & failure (invalid email, short password, unknown fields).
   - Service mapping duplicate email to 409 (mock Supabase response).
   - Successful signup returns correct structure & status 201.
   - Unexpected service error returns 500.
8. Add rate-limit placeholder (middleware) `src/middleware/index.ts` (if not present) with TODO comment.
9. Update `README.md` (API section) documenting endpoint.
10. Security review: confirm no password logging; ensure tokens not cached.
11. Optional: Add correlation id generation in route (e.g., crypto.randomUUID()).
12. Manual integration test using HTTP client (e.g., curl) after build.

## 10. Zod Schema (Reference)
```ts
import { z } from 'zod';
export const authSignupSchema = z.object({
  email: z.string().trim().min(6).max(254).email().transform(v => v.toLowerCase()),
  password: z.string().min(8).max(128)
}).strict();
export type AuthSignupParsed = z.infer<typeof authSignupSchema>;
```

## 11. Service Pseudocode
```ts
export async function signUp(supabase: SupabaseClient, { email, password }: AuthSignupParsed): Promise<SignUpResult> {
  const start = performance.now();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (/already registered/i.test(error.message)) {
      throw conflictError('EMAIL_EXISTS', 'Email already registered');
    }
    throw internalError('SUPABASE_ERROR', 'Signup failed', { original: error.message });
  }
  if (!data.user || !data.session) {
    throw internalError('INCOMPLETE_RESPONSE', 'Missing user or session');
  }
  return {
    userId: data.user.id,
    email: data.user.email!,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  };
}
```

## 12. Testing Matrix
| Scenario | Input | Expected Status | Expected Body | Notes |
|----------|-------|-----------------|---------------|-------|
| Valid signup | new email & strong password | 201 | user + session tokens (camelCase) | Mock Supabase success |
| Duplicate email | existing email already registered | 409 | error.code=EMAIL_EXISTS | Simulate Supabase error message match |
| Invalid email | bad format ("foo@") | 400 | error.code=VALIDATION_ERROR | Zod email validation |
| Short password | length < 8 | 400 | error.code=VALIDATION_ERROR | Password min length |
| Extra field | { email, password, foo } | 400 | error.code=VALIDATION_ERROR | Schema .strict() rejects unknown |
| Missing password | { email } | 400 | error.code=VALIDATION_ERROR | Required field |
| Missing email | { password } | 400 | error.code=VALIDATION_ERROR | Required field |
| Supabase outage | network/timeout error | 500 | error.code=SUPABASE_UNAVAILABLE | Service converts connectivity error |
| Unexpected null session | Supabase returns user but no session | 500 | error.code=INCOMPLETE_RESPONSE | Defensive check |

Testing Approach Guidelines (no code changes to other files):
- Unit test Zod schema.
- Service unit tests with mocked Supabase client.
- Integration test route with in-memory Supabase mock or test project key.
- Ensure no logging of raw password or tokens (assert logger calls). 

## 13. Future Enhancements
- Email verification flow (Supabase supports).
- Metrics instrumentation (Prometheus counters: signup_attempts, signup_success, signup_conflict).
- Observability (OpenTelemetry span around service call).
- Password complexity configuration via env.

## 14. Assumptions
- Supabase anon key available in server context; service role not required for signUp.
- `locals.supabase` properly initialized earlier by middleware.
- No separate error persistence table yet (hence logging only).
- English-only error messages for MVP.

## 15. Acceptance Criteria
- Returns 201 with correct camelCase token fields matching `AuthSignupResponse`.
- Returns 409 on duplicate email with standardized error body.
- Strict validation rejects malformed input / unknown fields with 400.
- No password or token values logged (only hashed email allowed).
- Error mapping consistent (VALIDATION_ERROR, EMAIL_EXISTS, SUPABASE_UNAVAILABLE, INTERNAL_ERROR).
- Code follows project clean code guidelines (guard clauses, early returns).
- Tests cover success + main failure matrix entries.
