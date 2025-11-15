<conversation_summary>
<decisions>
1. Use httpOnly cookie sessions; UI reads minimal session state from window.__session and revalidates on visibilitychange.
2. Wizard lives at /wizard and is shown only when there is no active simulation and the dashboard is empty; dashboard shows a CTA to launch it.
3. Loans page uses explicit Save/Cancel; edits trigger a global “simulation stale” banner with a CTA to re-run.
4. Loans list has no pagination/search; a sidebar shows and edits all loan fields except IDs.
5. Overpayment and reinvest default live in Settings; wizard may display the current setting read-only with a link to Settings.
6. Dashboard shows a chart of all loans from earliest start to latest payoff; current month is highlighted and linked to a Current Month panel.
7. Per-loan colors are deterministic (hash of name) and persisted in localStorage; lightness varies by remaining balance.
8. Current Month panel provides per-loan actions: Payment done, Overpayment executed, Skip (with confirmation and undo).
9. Use Recharts for charts only if shadcn/ui doesn’t provide suitable components.
10. UI copy in English; currency/number formatting in PLN (pl-PL).
11. State management: TanStack Query for server state and Zustand for UI state; optimistic updates for monthly execution logs.
12. Error handling follows standardized API schema and surfaces inline field errors and toasts with requestId.
13. Only active simulation view lives at /dashboard; omit /simulations for MVP.
14. Keep caching/perf simple for MVP; defer advanced strategies.
</decisions>

<matched_recommendations>
1. Navigation and landing: Sidebar layout; default to /dashboard with empty-state CTA for wizard.
2. Session awareness: GET /api/session populates window.__session; cross-tab sync via BroadcastChannel.
3. Wizard flow: Two-step (strategy, goal/params), preloading loans and user settings; shown only when no active simulation.
4. Loans UX: Simple list with sidebar detail editor; explicit Save/Cancel; PATCH on save.
5. Settings: Global defaults for monthly overpayment and reinvest; wizard displays current defaults.
6. Dashboard composition: Overview metrics, full-timespan chart, current month highlight and action panel, unique loan colors.
7. State management: TanStack Query + Zustand; optimistic mutations for execution logs; selective invalidation.
8. Error handling: Standard error {code, message, fieldErrors?, requestId?}; toasts + inline errors.
9. Charts: Use Recharts if shadcn/ui lacks equivalents; include accessible text/table alternatives when feasible.
10. Security: httpOnly cookie sessions; optional simple CSRF token header if required by API.
</matched_recommendations>

<ui_architecture_planning_summary>
a. Main UI architecture requirements:
- Routes: /dashboard (active simulation), /loans (list + sidebar editor), /settings (global defaults), /wizard (guarded: no active simulation).
- Layout: Left sidebar navigation; responsive, mobile-first with shadcn/ui primitives.
- Session: Server-managed via httpOnly cookie; UI mirrors minimal state in window.__session; revalidate on visibilitychange and on route enters.

b. Key views, screens, and user flows:
- Dashboard: 
  - Metrics: total interest saved, total monthly payment reduction (with per-loan tooltip breakdown).
  - Chart: Remaining balance over time for all loans from earliest start to latest payoff; current month highlighted and visually linked to Current Month panel.
  - Actions: Per-loan “Payment done”, “Overpayment executed”, “Skip” (confirm + undo). Show “simulation stale” banner when needed and CTA to run new simulation.
  - Empty state: CTA to launch /wizard.
- Wizard (/wizard):
  - Step 1: Choose strategy (from registry).
  - Step 2: Choose goal (Fastest Payoff or Payment Reduction) and parameters (threshold), show read-only reinvest default with link to Settings.
  - Preloads loans and user settings; runs simulation and redirects to /dashboard.
- Loans (/loans):
  - Simple list; select to open sidebar with full editable fields (except IDs); explicit Save/Cancel; PATCH on save; destructive actions guarded.
- Settings (/settings):
  - Monthly overpayment limit and reinvest default; saving sets simulation to stale with prompt to re-run.

c. API integration and state management:
- Core endpoints (assumed from plan): 
  - GET /api/session, GET/PUT /api/user-settings, GET/POST/PATCH/DELETE /api/loans, GET /api/strategies, POST /api/simulations, GET /api/simulations/active, POST /api/simulations/{id}/activate, GET /api/dashboard/overview, PATCH /api/monthly-execution-logs/{logId}.
- Server state via TanStack Query with normalized keys; optimistic updates for execution logs; invalidate dashboard and active simulation on relevant mutations.
- Use ETag/If-Match if provided for safe concurrent edits.
- Error handling maps standardized schema to toasts and inline field errors; expose requestId in details.

d. Responsiveness, accessibility, and security:
- Tailwind 4 + shadcn/ui for accessible components; keyboard/ARIA support; focus management for modals and route transitions.
- Mobile: Tables collapse to cards; chart remains scrollable; current month panel remains reachable.
- Currency/locale: Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).
- Colors: Deterministic per-loan with lightness varying by remaining balance; ensure sufficient contrast.
- Security: httpOnly cookie sessions; if CSRF is required, use a simple token header; same-origin fetch wrapper with 401 handling.

e. Unresolved issues or clarifications needed:
- Confirm exact endpoint shapes for session, dashboard overview, monthly execution logs, and simulation status lifecycle (queued/running/completed/failed).
- Define stale simulation signaling fields on dashboard/active simulation payloads.
- Specify standardized error schema fields precisely (fieldErrors structure).
- Clarify support for ETag/If-Match on loan and settings updates.
- Confirm if CSRF token endpoint or header is required and its name.
</ui_architecture_planning_summary>

<unresolved_issues>
1. Exact API contracts for /api/session, /api/dashboard/overview, /api/monthly-execution-logs, simulation status values, and stale flags.
2. Final error payload format and fieldErrors structure to bind to inputs.
3. Availability of ETag/If-Match for concurrency control on loan/settings updates.
4. Whether a CSRF token is required with httpOnly cookies and its retrieval/usage.
5. Accessibility palette details to ensure contrast when varying lightness by remaining balance.
</unresolved_issues>

</conversation_summary>
