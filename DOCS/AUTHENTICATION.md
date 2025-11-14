# Authentication & Session Handling

This document describes how the NOSACZ application authenticates users, what the backend expects on every request, and how the UI should manage session tokens.

## Supabase Session Basics

- Supabase Auth issues access and refresh tokens when a user signs in or signs up via `/api/auth/signin` or `/api/auth/signup`.
- The access token is a short-lived JWT that must be sent with subsequent API requests.
- The refresh token allows the UI to rotate the access token without requiring the user to re-enter credentials (token refresh flow is not yet exposed by our API but should be preserved client-side).

## Obtaining Tokens

1. Call `POST /api/auth/signin` (or `/api/auth/signup`).
2. On success, the response payload contains:
   ```jsonc
   {
     "user": { "id": "<uuid>", "email": "<email>" },
     "session": {
       "accessToken": "<jwt>",
       "refreshToken": "<token>",
     },
   }
   ```
3. Persist the tokens securely in the client (see "Client Responsibilities" below).

## Backend Expectations for Protected Routes

- **Authorization header**: Every protected endpoint (all `/api/*` routes except `/api/auth/signin` and `/api/auth/signup`) requires:
  ```http
  Authorization: Bearer <accessToken>
  ```
- **Request ID (optional)**: Clients may provide `X-Request-Id`. If omitted, middleware generates one. Supplying a stable ID helps correlate client logs with backend logs.
- **Content**: Routes may impose additional requirements (e.g., JSON body) documented per endpoint. Authentication middleware only validates tokens.

## Middleware Behavior

- Verifies the bearer token with `supabase.auth.getUser(token)`.
- Rejects missing/invalid tokens with `401 AUTH_REQUIRED`.
- Propagates Supabase rate limiting as `429 RATE_LIMITED`.
- Injects the authenticated user ID into `locals.userId`, making it available to downstream handlers.
- Sets/echoes an `X-Request-Id` header on all responses for traceability.

## Client Responsibilities

- **Store tokens** securely (e.g., memory, secure storage). Avoid putting tokens in local storage if possible; prefer HTTP-only cookies or in-memory storage linked to the runtime session.
- **Attach the access token** as a bearer token on every protected API call.
- **Handle refresh**: When the backend returns 401 due to an expired token, either prompt re-authentication or perform a refresh-token exchange (planned endpoint).
- **Respect rate limiting**: On `429 RATE_LIMITED`, surface a user-friendly message and back off before retrying.
- **Propagate request IDs** (optional but recommended) to tie together logs across client and server.

## Error Handling Summary

| Status | Code                       | Meaning                                   | Client Action                         |
| ------ | -------------------------- | ----------------------------------------- | ------------------------------------- |
| 401    | `AUTH_REQUIRED`            | Missing/invalid/expired access token      | Refresh session or redirect to signin |
| 429    | `RATE_LIMITED`             | Too many auth attempts                    | Backoff and retry later               |
| 500    | `AUTH_VERIFICATION_FAILED` | Supabase verification failed (unexpected) | Retry, if persistent escalate/report  |

## Security Considerations

- Never log raw tokens. If logging is required, hash the token first.
- Ensure HTTPS is always used between UI and backend to protect tokens in transit.
- Revoke tokens on explicit signout once the revoke endpoint is available.

## Next Steps for UI Integration

1. Implement signin/signup flows that capture the returned session tokens.
2. Create a request wrapper that injects `Authorization: Bearer <accessToken>` and optional `X-Request-Id` headers.
3. Centralize 401 and 429 handling to trigger token refresh, re-authentication, or user notifications.
4. Monitor for upcoming token refresh/logout endpoints to complete the lifecycle.
