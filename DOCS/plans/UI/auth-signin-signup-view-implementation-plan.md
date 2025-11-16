## View Implementation Plan — Auth Sign In + Sign Up

### 1. Overview

- Purpose: Provide minimal, secure authentication flows for signing in and signing up with email/password, aligning with MVP and PRD user stories US-036 (Register), US-037 (Login), and US-040 (Session expiry behavior).
- Success: Valid input triggers API call, shows feedback, stores session tokens, and redirects to `/dashboard`. Invalid input or errors show accessible, generic messages (no email enumeration on sign-in).

### 2. View Routing

- Routes:
  - `/auth/signin` — Sign in view
  - `/auth/signup` — Sign up view
- Post-success redirect: `/dashboard`

### 3. Component Structure

- `AuthLayout` (shared)
  - `AuthHeader` (app name/logo optional)
  - `AuthCard`
    - `AuthFormHeading` (contextual title/subtitle)
    - `ErrorSummary` (global/server errors)
    - `AuthForm` (email + password form)
    - `FormActions` (Submit button + links)
  - `ToastHost` (toasts container)

Pages:
- `AuthSigninPage` → uses `AuthLayout` + `AuthForm(mode="signin")`
- `AuthSignupPage` → uses `AuthLayout` + `AuthForm(mode="signup")`

Shared UI:
- `TextInput` (email)
- `PasswordInput` (password, show/hide)
- `Button` (primary submit) [use existing `src/components/ui/button.tsx`]
- `InlineFieldError` (per-field errors)
- `ErrorSummary` (top list with focus on submit errors)
- `Toast` (success/info/neutral)

### 4. Component Details

#### AuthLayout
- Purpose: Consistent, accessible layout for auth pages (centered card, responsive, basic contrast).
- Elements: container, header, content card, footer note (links to switch view).
- Handled interactions: none (static layout).
- Validation: none.
- Types: none.
- Props: 
  - `title: string`
  - `subtitle?: string`
  - `children: ReactNode`

#### ErrorSummary
- Purpose: Render non-field specific errors (server or generic) in an ARIA live region, focusable on error.
- Elements: `div[role="alert"]`, list of messages, `data-test="error-summary"`.
- Interactions: receives errors via props; automatically focused after submit failure.
- Validation: shows when `serverError` or `formErrors._form` are present.
- Types:
  - `ErrorItem = { id?: string; message: string }`
- Props:
  - `errors: ErrorItem[]`

#### TextInput
- Purpose: Email field with label, description, and inline error.
- Elements: `label`, `input[type="email"]`, optional description, inline error below.
- Interactions: `onChange`, `onBlur`, Enter submits form.
- Validation (client): 
  - required; length 6..254; RFC email pattern; lowercase on submit.
- Types:
  - `FieldError = string`
- Props:
  - `id: string`
  - `label: string`
  - `value: string`
  - `onChange: (v: string) => void`
  - `onBlur?: () => void`
  - `error?: FieldError`
  - `description?: string`
  - `autoComplete?: "email"`
  - `disabled?: boolean`

#### PasswordInput
- Purpose: Password field with show/hide toggle and inline error.
- Elements: `label`, `input[type="password"]`, visibility toggle button, inline error.
- Interactions: `onChange`, `onBlur`, toggle visibility, Enter submits form.
- Validation (client): required; length 8..128 (per server schema).
- Props:
  - `id: string`
  - `label: string`
  - `value: string`
  - `onChange: (v: string) => void`
  - `onBlur?: () => void`
  - `error?: FieldError`
  - `autoComplete?: "current-password" | "new-password"`
  - `disabled?: boolean`

#### FormActions
- Purpose: Primary submit and secondary links (switch view and reset password link on signin).
- Elements: primary `Button`, secondary inline links.
- Interactions:
  - Submit button click
  - Links: `/auth/signup` from signin, `/auth/signin` from signup, reset link `/auth/reset-password` from signin
- Props:
  - `submitLabel: string`
  - `isSubmitting: boolean`
  - `secondaryLinks: Array<{ href: string; label: string; variant?: "link" | "ghost" }>`

#### AuthForm
- Purpose: Reusable form for both modes (`signin` | `signup`), handling state, validation, API calls, and success flow.
- Elements: `form`, `TextInput`, `PasswordInput`, `ErrorSummary`, `FormActions`.
- Interactions:
  - Input changes and blurs update local state and field errors
  - Submit triggers client validation → API call → result handling
  - Disable submit while submitting; keyboard-accessible; focus management on error/success
- Validation (client, mirrors server zod):
  - Email: required, 6..254 chars, valid email, lowercased on submit
  - Password: required, 8..128 chars
  - On failure: show inline field errors; on server 400/401/409/429/500 map to `ErrorSummary` generic messages (no email enumeration on sign-in)
- Types:
  - `AuthMode = "signin" | "signup"`
  - `AuthFormViewModel = { email: string; password: string; touched: { email: boolean; password: boolean }; fieldErrors: { email?: string; password?: string; _form?: string }; serverError?: string; isSubmitting: boolean }`
  - Uses DTOs from `src/types.ts`: `AuthSigninRequest`, `AuthSigninResponse`, `AuthSignupRequest`, `AuthSignupResponse`
  - Error response shape (from API): `{ error: { code: string; message: string }, requestId?: string }`
- Props:
  - `mode: AuthMode`
  - `onSuccess?: (session: { accessToken: string; refreshToken: string }) => void` (default: save + redirect `/dashboard`)

#### ToastHost
- Purpose: Global toast container for success and informative messages.
- Elements: position-fixed region with queued toasts; ARIA live polite.
- Interactions: programmatic show on success; auto-dismiss.
- Props:
  - none (context/global) or `toasts: ToastMessage[]`

### 5. Types

- From `src/types.ts`:
  - `AuthSigninRequest = { email: string; password: string }`
  - `AuthSigninResponse = { user: { id: string; email: string }, session: { accessToken: string; refreshToken: string } }`
  - `AuthSignupRequest = { email: string; password: string }`
  - `AuthSignupResponse` — same shape as signin response
- New view-model/types:
  - `AuthMode = "signin" | "signup"`
  - `AuthFormViewModel` (see above)
  - `AuthApiErrorResponse = { error: { code: string; message: string }, requestId?: string }`
  - `SessionTokens = { accessToken: string; refreshToken: string }`
  - `ToastMessage = { id: string; title?: string; description: string; variant?: "default" | "success" | "destructive" }`

### 6. State Management

- Local component state (React) within `AuthForm`:
  - `email`, `password`
  - `touched.email`, `touched.password`
  - `fieldErrors.email`, `fieldErrors.password`, `fieldErrors._form`
  - `serverError`
  - `isSubmitting`
- Custom hooks:
  - `useAuthApi()` — wraps fetch calls for signin/signup; maps API errors to typed results.
  - `useSession()` — read/write `SessionTokens` in `sessionStorage`; exposes `saveSession`, `clearSession`, `getAccessToken`.
  - Optional `useToast()` — show success/info messages (shadcn/ui convention).

### 7. API Integration

- Base endpoints (match implementation under `src/pages/api/...` via middleware):
  - `POST /api/auth/signin`
  - `POST /api/auth/signup`
  - Optional session check (if present): `GET /api/session` (or probe a protected endpoint with `Authorization: Bearer <accessToken>`)
- Requests:
  - Headers: `Content-Type: application/json`
  - Body for both: `AuthSigninRequest | AuthSignupRequest`
- Success responses:
  - `200 OK` (signin), `201 Created` (signup) with `AuthSigninResponse | AuthSignupResponse`
  - On success: `saveSession({ accessToken, refreshToken })` and `location.assign("/dashboard")`
- Error responses (shape): `{ error: { code, message }, requestId? }`
  - Sign-in: 
    - 401 `INVALID_CREDENTIALS` → show generic message “Invalid email or password” (no email enumeration)
    - 429 `RATE_LIMITED` → “Too many attempts. Try again later.”
    - 400 `VALIDATION_ERROR` → show “Check your input and try again.” (plus client inline errors)
    - 500 `INTERNAL_ERROR` → “Something went wrong. Please try again.”
  - Sign-up:
    - 409 `EMAIL_EXISTS` → “Email already registered.” (acceptable for signup per API plan)
    - 429/400/500 handled like above

### 8. User Interactions

- Typing into inputs updates local state and clears corresponding inline error for that field.
- Blur triggers inline validation for that field.
- Pressing Enter within any input submits if form is valid and not submitting.
- Clicking Submit:
  - Runs client validation; if ok, disables submit, calls API, re-enables on completion.
  - On success: show toast “Signed in”/“Account created” and redirect to `/dashboard`.
  - On error: focus `ErrorSummary`, render generic/server message; do not reveal whether an email exists on sign-in.
- Links:
  - Sign-in view: “Create account” → `/auth/signup`, “Forgot password?” → `/auth/reset-password`
  - Sign-up view: “Already have an account?” → `/auth/signin`

### 9. Conditions and Validation

- Client validation (mirrors server zod in `src/lib/validation/auth.ts`):
  - Email: required, 6..254 chars, must be valid email; lower-case on submit
  - Password: required, 8..128 chars
- Submit button disabled when:
  - `isSubmitting === true`
  - Client validation invalid (optional immediate disable) — at minimum, prevent submit handler from proceeding
- Accessibility:
  - Associate `label` with `input` via `htmlFor`
  - `aria-invalid="true"` on invalid fields
  - `aria-describedby` links input to error text
  - `ErrorSummary` uses `role="alert"` and receives focus on error
  - Buttons are keyboard focusable and operable

### 10. Error Handling

- Map API codes to stable, generic messages on sign-in (avoid email enumeration).
- Display `requestId` in a collapsible “More details” section for support (optional, hidden by default).
- Network failures/timeouts: “Network error. Please check your connection and try again.”
- Rate limiting (429): show message and optionally disable submit for N seconds (simple cooldown) to thwart rapid retries.
- Form input sanitation: trim email and password on submit; lower-case email.
- On 500: show generic message, allow retry.

### 11. Implementation Steps

1. Create shared `AuthLayout` and `ErrorSummary` components with accessible semantics.
2. Implement `TextInput` and `PasswordInput` with labels, descriptions, inline error rendering, and `aria-*` bindings.
3. Implement `FormActions` using existing `Button` (`src/components/ui/button.tsx`) and secondary links.
4. Build `useSession()` to persist `SessionTokens` in `sessionStorage` under a namespaced key (e.g., `nosacz.auth.session`).
5. Build `useAuthApi()` exposing `signin(payload)` and `signup(payload)`:
   - Use `fetch` to `POST /api/auth/signin` and `POST /api/auth/signup`
   - Parse success to `{ accessToken, refreshToken }`
   - Parse errors to `{ code, message, requestId? }`
6. Implement `AuthForm(mode)`:
   - Local state: fields, touched, fieldErrors, serverError, isSubmitting
   - Client validation mirrors server schema
   - Submit handler: if valid → call API via `useAuthApi()`, save session via `useSession()`, show toast, redirect `/dashboard`
   - Error handling: set `serverError` from API mapping, focus `ErrorSummary`
7. Create `AuthSigninPage` at `/auth/signin` composing `AuthLayout` + `AuthForm(mode="signin")` with reset and signup links.
8. Create `AuthSignupPage` at `/auth/signup` composing `AuthLayout` + `AuthForm(mode="signup")` with link to sign in.
9. Add `ToastHost` (if not present) or integrate shadcn/ui toast primitives.
10. QA:
    - Keyboard-only flows, screen reader announcements, error focus
    - Validation: short/long emails, invalid formats, short passwords
    - API: 200/201, 400, 401 (signin), 409 (signup), 429, 500
    - Session: after success, subsequent protected API calls include `Authorization: Bearer <accessToken>`

---

Implementation aligns with PRD user stories US-036, US-037, US-040 and the existing API contract in `src/pages/api/auth/*` with middleware-enforced bearer authentication for protected routes.


