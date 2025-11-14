# API Endpoint Implementation Order

This order optimizes for: (1) fastest path to a functional authenticated app, (2) establishing stable domain primitives before dependent workflows, (3) enabling simulation runs early to validate core value, (4) deferring aggregation and analytics until underlying data producers exist, and (5) isolating low-risk static endpoints up front.

## High-Level Phases
1. Authentication & Core Infrastructure
2. User Profile & Domain Foundations
3. Simulation Enablement
4. Operational Logging & Metrics Production
5. Aggregation & Dashboard Experience
6. Administrative / Monitoring (future scope)

---
## Detailed Order

### Phase 1: Authentication & Core Infrastructure
1. `POST /auth/signup`
2. `POST /auth/signin`
3. `POST /auth/signout`
4. `POST /auth/reset-password`

Rationale: All subsequent `/api/*` endpoints require a valid user context (JWT). Implementing auth first unblocks frontend integration, middleware (`Authorization` header parsing), and RLS testing. Reset password is low-effort once signup/signin flow exists.

### Phase 2: User Profile & Domain Foundations
5. `GET /api/user-settings`
6. `PUT /api/user-settings`
7. `GET /api/strategies` (static registry)
8. `POST /api/loans`
9. `GET /api/loans`
10. `GET /api/loans/{loanId}`
11. `PUT /api/loans/{loanId}`
12. `PATCH /api/loans/{loanId}`
13. `DELETE /api/loans/{loanId}`
14. `GET /api/loan-change-events`
15. `POST /api/loan-change-events`

Rationale:
- User settings affect simulation parameters (overpayment behavior) and can trigger stale simulation flags—must exist before simulation triggering.
- Strategy registry is static; early exposure enables UI to build simulation trigger forms.
- Loans are the core domain entities required to run any simulation. CRUD and change events form the mutation history needed for accurate interest calculations.
- Loan change events create staleness signals; deploying them early ensures simulation invalidation logic is testable.

### Phase 3: Simulation Enablement
16. `POST /api/simulations` (enqueue run)
17. `GET /api/simulations` (list/history)
18. `GET /api/simulations/{simulationId}` (details/results)
19. `POST /api/simulations/{simulationId}/cancel`
20. `POST /api/simulations/{simulationId}/activate`
21. `GET /api/simulations/active`

Rationale:
- Once loans, settings, and strategy registry exist, simulations can be queued.
- Activation and cancellation require a running/completed simulation to exist; implement after base run and retrieval endpoints.
- Active simulation endpoint needed before any per-month schedule or dashboard aggregation can reference the current plan.

### Phase 4: Operational Logging & Metrics Production
22. `GET /api/simulation-loan-snapshots`
23. `GET /api/simulation-history-metrics`
24. `POST /api/simulation-history-metrics` (service role)
25. `POST /api/monthly-execution-logs`
26. `GET /api/monthly-execution-logs`
27. `PATCH /api/monthly-execution-logs/{logId}`
28. `GET /api/adherence-metrics`
29. `PUT /api/adherence-metrics` (service role recompute)

Rationale:
- Snapshots and history metrics depend on completed simulations; implement once simulation pipeline stable.
- Monthly execution logs model real-world payment tracking; they require the active simulation to define scheduled overpayments.
- Log mutation (PATCH) after create/list so front-end can first render schedule then update statuses.
- Adherence metrics rely on accumulated execution logs; implement after logs exist to avoid placeholder values.

### Phase 5: Aggregation & Dashboard Experience
30. `GET /api/dashboard/overview`

Rationale: The dashboard aggregates across active simulation, loans, snapshots, logs, and adherence metrics. Building it after all producers reduces rework and enables meaningful caching strategies (5‑minute window) backed by real data.

### Phase 6: Administrative / Monitoring (Future Scope)
31. `GET /api/admin/metrics/resimulations`

Rationale: Internal analytics endpoint offers non-user value; defer until core user-facing features stabilize. Requires historical staleness/resimulation tracking already produced by prior phases.

---
## Dependency Graph Summary
- Auth → (All `/api/*` endpoints)
- User Settings → Simulation staleness logic
- Loans → Simulations, Loan Change Events (events depend on loans)
- Loan Change Events → Simulation invalidation signals
- Strategy Registry → Simulation POST validation
- Simulation POST → Simulation list/detail, activation/cancel, active
- Completed Simulation → Loan Snapshots, History Metrics
- Active Simulation + Loans → Monthly Execution Logs (schedule context)
- Monthly Execution Logs → Adherence Metrics → Dashboard Overview
- All prior (Loans, Active Simulation, Logs, Metrics, Snapshots) → Dashboard Overview
- Resimulation Admin Metrics → Simulation lifecycle events & staleness tracking

---
## Why Not Another Order?
- Building dashboard earlier would necessitate mocks and later refactors; postponing avoids integration churn.
- Implementing monthly logs before simulations yields orphan scheduling semantics—logs need an active plan for context.
- Adherence metrics before logs would require backfilling logic or placeholder zeros, reducing early data integrity.
- History metrics before simulation completion logic could cause schema drift as result format evolves.

---
## Early Testing Strategy Per Phase
- Phase 1: Verify JWT decoding & RLS with a single protected test endpoint.
- Phase 2: Seed test user, create loans, mutate, assert staleness flag logic on loan changes.
- Phase 3: Mock job worker; ensure status transitions (running → completed → activate) and conflict handling.
- Phase 4: Insert execution logs for active simulation month; validate adherence ratio calculation.
- Phase 5: Integration test: one request to dashboard returns coherent aggregated fields.
- Phase 6: Service role test ensuring forbidden for regular user.

---
## Incremental Delivery Milestones
- Milestone A: Auth + User Settings + Loan CRUD (basic domain authenticated UI)
- Milestone B: Strategy registry + Simulation run & activate (core value demonstration)
- Milestone C: Snapshots + Monthly logs + Adherence metrics (operational tracking)
- Milestone D: Dashboard overview (full user insight layer)
- Milestone E: Admin analytics (operational excellence)

---
## Risk Mitigation Notes
- Define staleness propagation as a shared helper early (used by loans, settings, change events, logs) to prevent duplication.
- Use feature flags to soft-launch simulation activation while logs not yet implemented.
- Maintain idempotent POST /api/simulations to handle accidental retries under network instability.

---
## Next Steps
Adopt this sequence in project issue tracking; create epics per phase and attach integration test goals before moving to subsequent phases.
