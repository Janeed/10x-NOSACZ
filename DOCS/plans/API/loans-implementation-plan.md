# API Endpoint Implementation Plan: Loans Suite (`/api/loans`)

## 1. Endpoint Overview
The Loans suite manages user-owned loan records and supports lifecycle actions: listing, creation, retrieval, full replacement, partial update, and deletion. Mutations can invalidate any active simulation plan by marking it stale. Each change may produce an audit `loan_change_events` row. The endpoints enforce strict validation aligned with database constraints and normalization rules (month-first day, fractional rates, bounded amounts). Concurrency control on full replacement uses ETags to avoid lost updates. Deletion cascades dependent artifacts and may trigger simulation staleness if active simulations reference the loan.

Endpoints:
- `GET /api/loans` — Paginated list with filters and sorting.
- `POST /api/loans` — Create a new loan (optional client-supplied id).
- `GET /api/loans/{loanId}` — Fetch single loan if owned.
- `PUT /api/loans/{loanId}` — Full replacement with optional close-flow.
- `PATCH /api/loans/{loanId}` — Partial update of selected fields.
- `DELETE /api/loans/{loanId}` — Remove loan and cascade related data.

## 2. Request Details
### Common
- Authentication: `Authorization: Bearer <JWT>` (middleware injects `userId`).
- Headers (conditional):
  - `If-Match: <ETag>` required for `PUT` (optimistic concurrency).
  - `X-Client-Confirmation` required for `DELETE` (mitigate accidental destructive actions).
  - `X-Request-Id` echoed from middleware for observability.

### GET /api/loans
- Query Params (all optional):
  - `page` (int >=1, default 1)
  - `pageSize` (int >=1, max 100, default 20)
  - `isClosed` (boolean)
  - `sort` (enum: `created_at | start_month | remaining_balance`, default `created_at`)
  - `order` (enum: `asc | desc`, default `desc`)

### POST /api/loans
- Body (JSON):
```json
{
  "id": "uuid?",               // optional client supplied
  "principal": "decimal",      // > 0
  "remainingBalance": "decimal", // >=0 & <= principal
  "annualRate": "decimal",     // 0 < rate < 1
  "termMonths": 360,            // >0
  "originalTermMonths": 360,    // >0 (initial term snapshot)
  "startMonth": "YYYY-MM-01"   // normalized first-of-month
}
```

### GET /api/loans/{loanId}
- Path: `loanId` (UUID)
- No body.

### PUT /api/loans/{loanId}
- Path: `loanId` (UUID)
- Body: same as POST plus optional close state:
```json
{
  "principal": "decimal",
  "remainingBalance": "decimal",
  "annualRate": "decimal",
  "termMonths": 360,
  "originalTermMonths": 360,
  "startMonth": "YYYY-MM-01",
  "isClosed": false,
  "closedMonth": null
}
```
- Rules:
  - `closedMonth` allowed only if `isClosed=true`.
  - If switching to closed state and `remainingBalance>0` -> 400.

### PATCH /api/loans/{loanId}
- Path: `loanId` (UUID)
- Body: Partial subset of PUT fields, e.g.:
```json
{
  "remainingBalance": "decimal"
}
```
- Additional allowed fields: `annualRate`, `termMonths`, `principal` (rare), `isClosed`, `closedMonth`.

### DELETE /api/loans/{loanId}
- Path: `loanId` (UUID)
- Headers: `X-Client-Confirmation` must match non-empty token.
- No body.

## 3. Response Details
### Common Loan Object
```json
{
  "id": "uuid",
  "principal": "decimal",
  "remainingBalance": "decimal",
  "annualRate": "decimal",
  "termMonths": 360,
  "originalTermMonths": 360,
  "startMonth": "YYYY-MM-01",
  "isClosed": false,
  "closedMonth": null,
  "createdAt": "timestamp",
  "staleSimulation": false // only present on mutation responses when active simulation invalidated
}
```

### GET /api/loans
```json
{
  "items": [<Loan>],
  "page": 1,
  "pageSize": 20,
  "totalItems": 42,
  "totalPages": 3
}
```
Status: 200

### POST /api/loans
- Status: 201
- Body: Loan object.
- Headers: `Location: /api/loans/{id}`; `ETag`.

### GET /api/loans/{loanId}
- Status: 200; Body: Loan object; Headers: `ETag`.

### PUT /api/loans/{loanId}
- Status: 200; Body: updated Loan (+ optional `staleSimulation`); Headers: new `ETag`.

### PATCH /api/loans/{loanId}
- Status: 200; Body: updated Loan (+ optional `staleSimulation`); Headers: new `ETag`.

### DELETE /api/loans/{loanId}
- Status: 204; No body.

### Error Response Shape (standardized)
```json
{
  "error": {
    "code": "ERR_VALIDATION|ERR_NOT_FOUND|ERR_CONFLICT|ERR_PRECONDITION|ERR_UNAUTHORIZED|ERR_SERVER",
    "message": "Human readable",
    "details": {"fieldErrors": {"principal": "Must be > 0"}}
  }
}
```
Codes map to HTTP statuses: 400,404,409,412,401,500.

## 4. Data Flow
1. Middleware authenticates JWT → extracts `userId`, attaches `requestId`.
2. Endpoint handler parses query/path/body → builds command/query DTO.
3. Validation layer (`validation/loan.ts`) applies rules (numbers, ranges, normalization, relationships). Fails fast with structured errors.
4. Service (`LoanService`) executes logic:
   - For list: constructs Supabase query with filters, ordering, pagination; counts total; maps rows to `LoanDto`.
   - For create: optional uniqueness check if id provided; insert row; if active simulation exists -> mark stale.
   - For get: select by id & userId.
   - For put: fetch row, verify ETag, compute field differences; validate closed state; update row transactionally; create `loan_change_events` entries for each changed attribute (rate, balance, term, principal) with appropriate `change_type`; mark simulation stale if differences affect simulation inputs.
   - For patch: similar to put but only provided fields; may require a read-modify-write; generate change events for changed fields.
   - For delete: conflict check (running simulation referencing loan) via simulation service; perform delete; mark active simulation stale.
5. Service returns domain DTO(s) to handler.
6. Handler sets headers (`ETag`, `X-Request-Id`, `Location` where relevant) and sends JSON.
7. Logger records outcome: success or error with requestId, userId, latency.

## 5. Security Considerations
- Authorization: Enforced both at API (must have valid userId) and database RLS (all queries include user context automatically through Supabase client).
- Ownership: Every selection and mutation filters by `user_id = currentUser` preventing horizontal data access even before RLS.
- ETag Optimistic Lock: Prevents lost updates on PUT. ETag strategy: `hash(id + createdAt + principal + remainingBalance + annualRate + termMonths + isClosed + closedMonth)` or simpler `W/"loan:<id>:<updated_at_epoch>"` if we add `updated_at` column (if absent, derive from created_at; consider adding `updated_at` later).
- Input Sanitization: Numerics parsed via safe decimal library (if added) or JS number with explicit range checks; `startMonth` validated by regex plus date parse; reject invalid dates.
- Closed State Integrity: `closedMonth` cannot exist unless `isClosed=true`; if `isClosed=true` enforce `remainingBalance=0`.
- Conflict Checks: Delete validates no running simulation job referencing loan (via `simulations.status='running'` and snapshot existence); if found → 409.
- Rate Limiting: Page size capped to 100 to reduce scanning cost; may integrate global middleware throttle.
- Error Leakage: Server and DB errors mapped to generic codes; no raw SQL or stack traces returned.
- Headers: Mandatory Authorization; protective `X-Client-Confirmation` for DELETE reduces accidental destructive calls.

## 6. Error Handling
| Scenario | Status | Code | Notes |
|----------|--------|------|-------|
| Invalid pagination params | 400 | ERR_VALIDATION | page/pageSize/enum mismatch |
| Validation fail (POST/PUT/PATCH) | 400 | ERR_VALIDATION | Numeric/range/date rules |
| Duplicate client-provided id | 409 | ERR_CONFLICT | Same id already exists for user |
| Loan not found / not owned | 404 | ERR_NOT_FOUND | Generic message |
| closedMonth without isClosed | 409 | ERR_CONFLICT | Business rule conflict |
| RemainingBalance > principal | 400 | ERR_VALIDATION | Range violation |
| ETag missing/mismatch (PUT) | 412 | ERR_PRECONDITION | If-Match absent or mismatch |
| Loan part of running simulation (DELETE) | 409 | ERR_CONFLICT | Prevent deletion during job |
| Unauthorized (no/invalid token) | 401 | ERR_UNAUTHORIZED | Middleware sets |
| Unexpected server/db error | 500 | ERR_SERVER | Logged internally |

Fallback: Uncaught exceptions produce 500 with generic message; logger captures stack.

## 7. Performance Considerations
- Pagination ensures bounded query result size; `pageSize<=100` reduces I/O.
- Sorting limited to indexed / low-cardinality columns: `created_at` should be indexed by default PK order; consider adding index on `start_month` and `remaining_balance` if usage grows.
- Count retrieval: Use Supabase `range()` with `count: exact` to get total; may be optimized later with approximate counts.
- Change Events: Insert only on field deltas, minimal overhead; batch inside transaction with loan update.
- Staleness Marking: Single UPDATE on active simulation row (WHERE user_id AND is_active). Index supports quick search (`ux_simulations_user_active`).
- Avoid N+1: All operations single-query or simple transaction; no cross-loan loops.
- JSON serialization: Response object shape matches DTO; exclude internal fields (user_id).
- Future optimization: Introduce `updated_at` to use for ETag and caching (Cache-Control: private, max-age=30) on GET single resource.

## 8. Implementation Steps
1. Create `src/lib/validation/loan.ts` with schema validators:
   - Functions: `validateListQuery(q)`, `validateCreateLoan(body)`, `validateUpdateLoan(body)`, `validatePatchLoan(body, existing)` returning `{value, errors}`.
   - Reuse patterns from existing validation modules.
2. Add `src/lib/services/loanService.ts`:
   - Implement methods: `listLoans`, `createLoan`, `getLoan`, `updateLoan`, `patchLoan`, `deleteLoan`.
   - Integrate Supabase client; all queries include `eq('user_id', userId)`.
   - ETag generation utility (import from `utils.ts` or new helper `computeLoanETag`).
   - Active simulation stale update: call `simulationService.markActiveSimulationStale(userId)` when create/update/patch/delete modifies simulation-relevant fields.
   - Audit changes: detect deltas vs existing row → build `loan_change_events` inserts with appropriate `change_type`.
3. Introduce `markActiveSimulationStale` method (if not present) in `simulationService.ts`:
   - UPDATE simulations SET stale=true WHERE user_id=? AND is_active=true.
4. Update `src/pages/api/` routes:
   - Create `loans.ts` (collection route) handling GET & POST (Astro supports method branching): parse query/body; run validators; call service; format responses with `responses.ts` helpers.
   - Create `[loanId].ts` (or `loans/[loanId].ts`) route for GET, PUT, PATCH, DELETE; verify path param; route method handlers accordingly.
5. Middleware integration:
   - Ensure `middleware/index.ts` attaches `requestId`, `userId`; add extraction of `If-Match` and `X-Client-Confirmation` into `locals`.
6. Implement ETag logic:
   - On GET single & mutations return `ETag` header.
   - On PUT require `If-Match`; mismatch => 412 using standardized error response.
   - (Optional) Accept ETag for PATCH as enhancement; initial implementation may omit requirement.
7. Validation specifics:
   - Normalize `startMonth`: parse date → ensure day == 1; else 400.
   - Round monetary values to 2 decimals; rates to 5 decimals.
   - For closed state transitions: if `isClosed=true` and `remainingBalance>0` → 400; if `closedMonth` present but `isClosed=false` → 409.
8. Change event creation:
   - For each changed field: map to change_type: principal→`principal_correction`, annualRate→`rate_change`, termMonths→`term_adjustment`, remainingBalance→`balance_adjustment`.
   - Effective month = current month start (date_trunc('month', now())).
9. Delete conflict check:
   - Query running simulations & snapshots referencing the loan: SELECT COUNT(*) FROM simulations s JOIN simulation_loan_snapshots sl ON sl.simulation_id=s.id WHERE s.user_id=? AND s.status='running' AND sl.loan_id=?; if >0 → 409.
10. Response formatting & logging:
   - Use `logger.ts` for structured logs: {requestId,userId,endpoint,method,status,duration}.
   - On validation errors log level `warn`; server errors `error`.
11. Add tests (if test infra present or minimal script) for:
   - Create success & duplicate id conflict.
   - Pagination boundary (pageSize=101 -> 400).
   - PUT ETag mismatch (412).
   - PATCH remainingBalance > principal (400).
   - Delete running simulation conflict (409).
12. Documentation:
   - Update `README.md` or API docs with Loans endpoint details & examples; link to validation rules.
13. Future Enhancements (not in MVP implementation):
   - Add `updated_at` column to `loans` for ETag & last-modified.
   - Cache GET single responses (short TTL) keyed by ETag.
   - Rate limiting middleware applicability per user.

## 9. Database Schemas
- Primary: `loans`
- Secondary interactions:
  - `loan_change_events` (audit on modifications)
  - `simulations` (`stale` flag update, running conflict detection)
  - `simulation_loan_snapshots` (delete conflict & cascade considerations)
  - `monthly_execution_logs` (cascade deletion only; no direct usage in handlers)
- All subject to RLS (ownership guarantee). Index usage limited to PK and active simulation unique index for stale operations.

## 10. Quality & Edge Cases
- Edge Cases: zero remainingBalance triggers auto-close logic (optional auto-set isClosed & closedMonth); client providing id must be UUID valid; startMonth in future allowed? (Clarify—initial plan allows any normalized month). Negative or null fields rejected.
- Consistency: Ensure `originalTermMonths` remains immutable after creation (PUT must not allow change? If changed, treat as conflict or ignore—choose to treat change as validation error 400 to keep baseline stable).
- Atomicity: Use transaction for PUT/PATCH when updating loan and inserting change events & stale simulation flag.
- Idempotency: DELETE repeated returns 404 after first success.

## 11. Dependencies & Utilities
- Supabase JS client from `supabase.client.ts`.
- Shared response builders from `lib/http/responses.ts`.
- Logging via `lib/logger.ts`.
- Error mapping via `lib/errors.ts` (wrap Postgres codes to HTTP).
- Utilities in `lib/utils.ts` for date normalization & ETag hashing.

## 12. Implementation Checklist
- [ ] Validation module created & exported.
- [ ] LoanService methods implemented with thorough error mapping.
- [ ] Change event insertion logic & mapping of change types.
- [ ] Stale simulation flagging integrated.
- [ ] ETag generation & enforcement on PUT.
- [ ] Routes for collection & single resource created.
- [ ] Standardized error responses utilized.
- [ ] Logging with requestId in success & error paths.
- [ ] Testing script added in scripts/loansApi.js making simple calls to each endpoint in order to check if all implemented endpoints are working fine

---
This plan aligns endpoint behavior with schema constraints, preserves simulation integrity through staleness propagation, and establishes a scalable service & validation structure for future loan-related features.
