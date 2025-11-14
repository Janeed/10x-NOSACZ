# API Endpoint Implementation Plan: POST /auth/signin

## 1. Endpoint Overview
Authenticate an existing user via Supabase Auth using email and password and return a session containing access and refresh tokens. Mirrors signup flow but returns 200 OK (not 201). Must strictly validate input, prevent user enumeration, and avoid caching sensitive tokens.

## 2. Request Details
- HTTP Method: POST
- URL: /auth/signin
- Query Parameters: none (reject if any present)
- Required Headers:
  - Content-Type: application/json (case-insensitive) — reject otherwise.
- Request Body (JSON):
```json
{
  "email": "user@example.com",
  "password": "string"
}
```
- Field Constraints:
  - email: trimmed, 6–254 chars, valid email format, transformed to lowercase.
  - password: 8–128 chars (no transform; allow spaces; fail if shorter/longer).
- Body Size Limit: 10 KB (same as signup).
- Reject extra properties (strict schema).

## 3. Used Types
- AuthSigninRequest (alias of AuthSignupRequest) `{ email: string; password: string }`
- AuthSigninResponse (alias of AuthSignupResponse):
```ts
{
  user: { id: string; email: string };
  session: { accessToken: string; refreshToken: string };
}
```
- Internal Parsed Type: `AuthSigninParsed` via `authSigninSchema` (`z.infer<typeof authSigninSchema>`)
- Service Result: `SignInResult`:
```ts
type SignInResult = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};
```

## 4. Response Details
Successful (200 OK):
```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "session": { "accessToken": "jwt", "refreshToken": "string" }
}
```
Headers:
- Content-Type: application/json; charset=utf-8
- Cache-Control: no-store
- X-Request-Id: <uuid>

Error Response Format:
```json
{
  "error": { "code": "STRING_CODE", "message": "Human readable" },
  "requestId": "uuid" // present if available
}
```
Status Codes:
- 200: Success
- 400: Invalid input / malformed JSON / bad content type / unexpected query
- 401: Invalid credentials
- 429: Rate limited (Supabase throttle)
- 500: Internal / upstream failures

## 5. Data Flow
1. Route invoked (`POST /auth/signin`).
2. Generate `requestId` (UUID); record `startedAt` for latency.
3. Guards:
   - Ensure no query parameters.
   - Validate `Content-Type` includes `application/json`.
4. Read raw body (text) with size enforcement (<=10KB).
5. Parse JSON → if fail, throw `INVALID_JSON` (400).
6. Validate with `authSigninSchema` (strict). On failure produce `VALIDATION_ERROR` (400) with issues list.
7. Acquire Supabase client from `locals.supabase`; if missing throw `SUPABASE_CLIENT_MISSING` (500).
8. Hash email (SHA-256) for logging only; never log plaintext.
9. Call `signIn(supabase, { email, password })` service.
10. Service executes `supabase.auth.signInWithPassword({ email, password })`:
    - Network or SDK throw → `SUPABASE_UNAVAILABLE` (500).
    - `AuthApiError` handling: map status/message patterns.
      - status 429 → RATE_LIMITED (429)
      - status 400 & message /invalid (login )?credentials/i → INVALID_CREDENTIALS (401 via `unauthorizedError`)
      - other 4xx → VALIDATION_ERROR (400)
      - else → SUPABASE_ERROR (500)
    - Validate presence of user.id, user.email, session.access_token, session.refresh_token → else INCOMPLETE_RESPONSE (500).
11. Build `AuthSigninResponse` from result.
12. Log success (info) with event `auth.signin` including requestId, emailHash, latencyMs.
13. Return 200 JSON response with tokens.
14. On any error: map to `ApiError`, log (warn for 4xx, error for 5xx) including requestId, code, status, latencyMs, emailHash if available; respond with standardized error body.

## 6. Security Considerations
- Credential Handling: Password never logged or stored; only passed to Supabase.
- User Enumeration: Always respond with generic INVALID_CREDENTIALS (401) for bad credentials; do not differentiate nonexistent email vs wrong password.
- Rate Limiting: Leverage Supabase 429; plan future IP-based middleware throttle (e.g., in `middleware/`).
- Sensitive Response: `Cache-Control: no-store` to prevent caching access/refresh tokens.
- Transport Security: Assume HTTPS (Supabase + Astro deployment). Ensure no tokens in logs or query params.
- Payload Size: 10KB guard prevents oversized request DoS.
- Timing Consistency: Uniform error handling paths reduce potential timing leakage; avoid early short-circuit differences (beyond validation basics).
- Email Normalization: Lowercase transform ensures consistent auth behavior.
- Hashing PII: SHA-256 of email for observability without exposing raw PII.
- Dependency Risk: Handle unexpected Supabase SDK errors with sanitized internal error.

## 7. Error Handling
Centralized via `ApiError` factories.
Add `unauthorizedError` factory (401) in `errors.ts`:
```ts
export const unauthorizedError = (code: string, message: string, details?: unknown): ApiError =>
  createApiError(401, code, message, { details });
```
Error Mapping Table:
| Scenario | Code | Status |
|----------|------|--------|
| Missing / wrong Content-Type | INVALID_CONTENT_TYPE | 400 |
| Query params present | INVALID_QUERY | 400 |
| Oversized body | PAYLOAD_TOO_LARGE | 400 |
| Invalid JSON | INVALID_JSON | 400 |
| Schema validation fail | VALIDATION_ERROR | 400 |
| Invalid credentials | INVALID_CREDENTIALS | 401 |
| Rate limited | RATE_LIMITED | 429 |
| Supabase client missing | SUPABASE_CLIENT_MISSING | 500 |
| Upstream network failure | SUPABASE_UNAVAILABLE | 500 |
| Upstream auth error (non-mapped) | SUPABASE_ERROR | 500 |
| Incomplete upstream response | INCOMPLETE_RESPONSE | 500 |
| Catch-all unexpected | INTERNAL_ERROR | 500 |

Logging Strategy:
- Success: logger.info(event, 'Signin succeeded', { requestId, emailHash, latencyMs })
- Client errors (4xx): logger.warn(...)
- Server errors (5xx): logger.error(...)

## 8. Performance Considerations
- Single external call — latency dominated by Supabase. Minimal CPU (hash + validation).
- Avoid unnecessary object cloning; return direct typed response.
- JSON stringify once via `jsonResponse` helper.
- Future scaling: Introduce circuit breaker or retry only for transient 5xx (not needed MVP). Consider metrics integration later.

## 9. Implementation Steps
1. Extend `errors.ts` with `unauthorizedError` factory (status 401).
2. Add `authSigninSchema` in `validation/auth.ts` (could alias to signup schema for DRY):
   ```ts
   export const authSigninSchema = authSignupSchema; // identical constraints
   export type AuthSigninParsed = z.infer<typeof authSigninSchema>;
   ```
3. Implement `signIn` in `services/authService.ts`:
   - Signature: `async function signIn(supabase: SupabaseClient<Database>, { email, password }: AuthSigninParsed): Promise<SignInResult>`
   - Call `supabase.auth.signInWithPassword({ email, password })`.
   - Map errors per table; detect invalid credential phrase -> `unauthorizedError('INVALID_CREDENTIALS', 'Invalid email or password')`.
   - Validate presence of required fields.
4. Create route `src/pages/api/auth/signin.ts` (pattern from signup):
   - Copy structural guards (query, content type, body size, JSON parse).
   - Use `authSigninSchema` validation.
   - Use `signIn` service.
   - Hash email for logging.
   - Return 200 with `AuthSigninResponse` shape.
5. Add tests (if test harness exists or plan for future):
   - Unit: service error mapping (mock Supabase client returning crafted errors).
   - Integration: route returns 400 for invalid payload, 401 for wrong credentials (simulate via mocked response), 200 success.
6. Update documentation: link this plan in overarching API docs if needed.
7. Optional Refactor (future): Extract shared body parsing & header guards into utility (e.g., `lib/http/guard.ts`).
8. Observability (future): Add metrics counter for success vs invalid credential attempts.
9. Security Hardening (future): Add IP-based rate limiter or exponential backoff after consecutive failures; integrate account lock logic (if required).

## 10. Edge Cases & Decisions
- Treat any supabase 400 containing "Invalid login credentials" (case-insensitive) as 401 to meet spec.
- Do not differentiate disabled/unconfirmed email vs wrong password (uniform 401 response).
- If Supabase later adds explicit 401 status, the mapping still consistent (401 passes through or is rewrapped).
- DRY decision: alias schema rather than duplicate — preserves single source of truth for constraints.
- Logging email hash only prevents PII leakage while enabling correlation for anomaly detection.

## 11. Success Criteria
- Returns 200 with expected structure on valid credentials.
- Returns 401 for invalid credentials with uniform message.
- No plaintext email or password in logs.
- Input validation rejects malformed requests (400) consistently.
- All errors use standardized error body and include requestId.

## 12. Rollout & Verification
1. Implement changes on feature branch.
2. Manual test via HTTP client (e.g., curl / Postman) using valid and invalid credentials.
3. Verify logs show hashed emails, correct latency.
4. Security quick check: ensure response headers include `Cache-Control: no-store`.
5. Merge after code review focusing on error mapping and absence of sensitive logging.

## 13. Future Enhancements
- Add refresh token rotation endpoint / session management.
- Introduce audit trail table for authentication events (if regulatory needs).
- Implement adaptive throttling (increasing delays after sequential failures).
- Integrate structured metrics (Prometheus / OpenTelemetry) for auth events.

---
This plan provides full guidance to implement `POST /auth/signin` aligned with existing project patterns and security best practices.
