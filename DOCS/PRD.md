# Product Requirements Document (PRD) - the NOSACZ (from pl. Narzędzie optymalizacji spłaty aktualnej części zadłuzenia)

## 1. Product Overview
The NOSACZ is the loan overpayment optimizer is a web application that enables users to centralize multiple bank loans and generate an optimized monthly overpayment allocation strategy aligned with a chosen financial goal. It reduces manual effort and guesswork in deciding how to distribute a fixed monthly overpayment budget across loans to either minimize total payoff time or reduce monthly payment obligations to a target threshold. The MVP emphasizes a single unified simulation spanning all active loans, with minimal input friction, clear actionable output, and lightweight update workflows.

### 1.1 Objectives
1. Allow users to register, authenticate, and securely manage multiple loans in one place.
2. Provide predefined overpayment strategies (e.g., Debt Avalanche, Debt Snowball variant, Equal Distribution, Debt Ratio) with automatic monthly distribution of a user-specified overpayment limit. The implementation will be extendable enough to be able to implement new strategies easily.
3. Support two primary user goals: fastest loan payoff and reducing total monthly payments to a user-defined threshold (with reinvest-or-keep choice for resulting payment reduction).
4. Generate a monthly simulation schedule (payments and overpayments) including interest saved, projected payoff timeline, and monthly payment adjustments when applicable.
5. Enable selection of a simulation to be the active dashboard plan, with simple monthly progress updates (payment made, overpayment done or skipped) and re-simulation prompts after data changes.
6. Track success metrics: adoption (simulation selections) and engagement (dashboard updates).

### 1.2 Target Users
Individual borrowers with multiple loans (mortgage, car, cash/personal) who want to optimize repayment speed or reduce monthly obligations without manually recalculating distributions after changes like interest adjustments or early payoffs. Financial literacy is assumed to be moderate; UI should remain simple and explanatory.

### 1.3 Value Proposition
The application delivers automation of a cognitively heavy calculation (optimal allocation of overpayment) and provides run-ready monthly instructions plus clear indicators of progress and interest savings. It supports dynamic recalculation after changes (interest rate modifications, missed overpayments, loan payoff events) while keeping user interaction minimal.

### 1.4 Scope Summary (MVP)
In scope: loan CRUD, strategy-based simulation, goal selection, overpayment limit distribution, dashboard metrics, monthly status updates, re-simulation triggers, minimal auth, simulation history (if feasible), basic graphs (monthly breakdown), PLN currency only.
Out of scope: bank integration, import/export, automated optimization of overpayment limit, multi-currency, complex validation, security hardening beyond basic safeguards.

## 2. User Problem
Users with multiple loans struggle to determine the optimal way to allocate a fixed monthly overpayment budget because it requires amortization math, recalculations after interest rate changes, and consideration of different repayment goals. Existing approaches rely on ad hoc spreadsheets or rules of thumb (e.g., always pay highest interest first) that may not align with personalized goals such as lowering monthly commitments versus minimizing total interest. Constantly changing loan circumstances (rate changes, early payoffs, skipped overpayments) further complicate manual models and discourage disciplined optimization.

Pain points addressed:
- Manual recalculation burden after any loan data change.
- Lack of visibility into trade-offs between faster payoff vs. lowering monthly payments.
- Difficulty tracking cumulative interest saved versus baseline.
- Inconsistent application of chosen strategy month-to-month.
- Missing structured way to record monthly payment and overpayment execution status.

## 3. Functional Requirements
Functional requirements are grouped by domain. Each requirement references user stories for traceability.

### 3.1 Loan Management
1. Add loan with minimal required fields: principal amount, fixed annual interest rate, term (months), optional start date (defaults to current month), optionally remaining balance if mid-term (US-001, US-002).
2. Edit loan fields; changes trigger re-simulation prompt (US-003).
3. Delete loan with confirmation; removal triggers re-simulation prompt (US-004).
4. Update remaining balance (manual adjustment) (US-005).
5. Adjust interest rate effective next month (default) or current month; triggers re-simulation (US-006, US-025).
6. Handle loan payoff earlier than scheduled: automatically mark loan as closed and reallocate future overpayments (US-026, US-027).

### 3.2 Overpayment Configuration and Strategies
1. User sets a single monthly overpayment limit (PLN) (US-007).
2. User edits overpayment limit; triggers re-simulation prompt (US-008).
3. Supported predefined strategies (initial set): Debt Avalanche (highest interest first), Debt Snowball variant (smallest remaining balance first), Equal Distribution (split evenly subject to minimum payment), Debt Ratio (proportional to balance/interest product). Strategy list stored in registry (US-009).
4. Strategy logic distributes monthly overpayment after applying regular scheduled payments (US-010).
5. Support toggling reinvest reduced payment amounts back into overpayment pool or keeping them (US-011, US-012).

### 3.3 Goals and Simulation Engine
1. Two goal modes: Fastest Payoff, Reduce Monthly Payments to Target Threshold (US-013, US-014).
2. User enters target threshold for monthly payments goal (aggregate desired total across all loans) (US-015).
3. Single active simulation across all loans at any time (US-016).
4. Simulation algorithm produces per-month schedule: regular payment per loan, overpayment allocation, updated remaining balances, interest accrued, interest saved vs baseline amortization without overpayments (baseline defined at time of run) (US-017, US-028).
5. Simulation asynchronous execution allowed; notify user when complete (US-018).
6. Ability to store simulation history (if feasible, with timestamp, strategy, goal, metrics) (US-019).
7. User can compare current active simulation with a prior one (US-020).
8. Re-simulation triggers: loan edits, loan deletion, interest change, overpayment limit change, marking skipped overpayment, manual remaining balance adjustment (US-021).
9. Support manual marking of ad hoc larger overpayment by editing remaining balance then re-running (US-022).

### 3.4 Dashboard and Monthly Updates
1. User can select a completed simulation to become active plan; appears on dashboard (US-023).
2. Dashboard displays per-loan metrics: remaining principal, current monthly payment, interest saved to date, projected payoff date or months remaining, progress bar (remaining vs original principal) (US-024).
3. Dashboard displays active simulation schedule for upcoming months and highlights current month (US-029).
4. Monthly update workflow: user marks payment done, overpayment executed, or overpayment skipped (US-030, US-031, US-032).
5. Skipped overpayment requires confirmation and triggers re-simulation prompt (US-032).
6. System shows indicator for missing months and supports backfill (US-033).
7. When a loan is fully paid off, dashboard updates status and reallocates future overpayments according to strategy (US-027).
8. Provide interest saved cumulative metric and monthly breakdown (US-034).
9. Provide graphs: monthly remaining balances trend, monthly interest vs interest saved (monthly breakdown only) (US-035).

### 3.5 Authentication and Access Control (Minimal)
1. User registration with email and password (PLN-only context) (US-036).
2. User login (US-037).
3. Logout (US-038).
4. Password reset or change (basic) (US-039).
5. Session management (expiry after inactivity) (US-040).
6. Authorization: user can only access own loans/simulations (US-041).

### 3.6 Data Persistence and Integrity
1. All loan, simulation, and monthly update data stored server-side (US-042).
2. Basic validation: disallow non-positive principal, negative interest, zero term (US-043).
3. Input sanitation (server side) minimal but ensures no execution of malicious scripts (US-044).
4. Provide basic rollback on failed multi-step update (atomic update of loan changes and simulation state) (US-045).

### 3.7 Notifications and Feedback
1. Async simulation completion notification visible in dashboard (toast/banner) (US-018).
2. Confirmation dialogs for destructive actions (delete loan, reset simulation, mark skipped overpayment) (US-004, US-032, US-046).
3. Error messages for invalid inputs (US-043).

### 3.8 Performance and Scalability (MVP Lightweight)
1. If simulation exceeds defined time threshold (e.g., 2 seconds TBD), run asynchronously (US-018, US-047).
2. Queue simulations if another is running; inform user (US-047).

### 3.9 Accessibility (Basic)
1. Ensure sufficient color contrast for key metrics and progress bars (US-048).
2. Provide text alternatives for graph tooltips (US-049).

### 3.10 Metrics and Analytics
1. Track number of simulations generated per user and number selected (US-050).
2. Track count of dashboard monthly updates per active simulation (US-051).
3. Track number of re-simulations triggered to monitor friction (US-052).
4. Track overpayment adherence: ratio executed vs skipped (US-053).

### 3.11 Open Items (TBD for future refinement)
1. Exact formula for interest saved baseline (decision: baseline equals original amortization schedule without any overpayments at initial simulation time) (US-028 clarifies).
2. Retention duration for simulation history (default: keep last N=10; TBD) (US-019).
3. Effective date logic for interest changes (default: next month unless explicitly set to current month) (US-025).
4. Strategy extension architecture for future custom strategies (US-054).

## 4. Product Boundaries
### 4.1 In Scope (MVP)
- Loan CRUD with minimal validation.
- Fixed-rate loans only; uniform treatment (no loan type field).
- Single monthly overpayment budget distribution across loans.
- Predefined strategies (initial four listed) via registry.
- Two goal modes (fastest payoff, reduce monthly payment to threshold).
- Single active simulation with optional history.
- Manual monthly status updates and backfill.
- Interest saved calculation versus baseline schedule.
- Confirmation dialogs for destructive actions.
- Basic authentication and authorization (single-user data isolation).
- PLN currency only.
- Monthly breakdown graphs; no cumulative savings charts beyond interest saved aggregate.

### 4.2 Out of Scope
- Bank API integration (importing payments, automating overpayments).
- Data export (CSV, PDF) and import from external files.
- Multi-currency or FX conversion.
- Automatic optimization of selecting overpayment amount (beyond user-specified limit).
- Advanced loan products (variable rates, interest-only periods, refinancing workflows).
- Complex financial risk analysis or tax implications.
- High-security features (2FA, encryption at rest specifics) beyond minimal safeguards.
- Robust error recovery for partial external failures (only basic rollback).
- Advanced accessibility compliance (WCAG AA+).
- Mobile native applications (web responsive only assumed).
- Mail notifications, external communication with user (outside NOSACZ platform)

### 4.3 Assumptions
- Users can manually compute or obtain current remaining balances for mid-term loans they add.
- All interest rates entered are nominal annual percentage fixed for the remaining term.
- Overpayment is applied once per month after regular scheduled payment.
- Simulation history storage capacity is sufficient for MVP scale.
- Users accept recalculation after each significant change; friction tolerance is moderate.

### 4.4 Dependencies
- Server-side runtime to perform amortization and strategy allocation calculations.
- Persistent storage for loans, simulations, user accounts.
- Authentication framework/library for session management.
- Charting library for monthly graphs.

### 4.5 Risks and Mitigations
- User confusion about interest saved baseline: mitigate with tooltip explanation (US-028).
- Performance degradation for large numbers of loans: asynchronous queue and threshold (US-047).
- Early payoff edge cases causing incorrect redistribution: include explicit payoff detection logic (US-026, US-027).
- Skipped overpayment may create mismatch with schedule: force re-simulation prompt (US-032).

### 4.6 Open Questions (Deferred)
- Precise retention policy for simulation history beyond MVP.
- Future support for variable interest rates / refinance events.
- Mechanisms for advanced data validation (e.g., interest outliers) post-MVP.

## 5. User Stories
Each story includes testable acceptance criteria. IDs are unique and traceable to functional requirements. AC uses Given/When/Then where practical.

### Loan Management
US-001 Add Loan
Description: As a user I can add a new loan with required fields so it appears in the system for simulation.
Acceptance Criteria:
- Given I am authenticated When I enter principal (>0), interest rate (>0), term (>0 months) and submit Then the loan is saved and visible in my loan list.
- Remaining balance defaults to principal if not provided.
- Start date defaults to current month if not specified.
- Loan triggers no simulation until I run one explicitly.

US-002 Add Mid-Term Loan
Description: As a user I can add a loan already in progress by specifying remaining balance less than principal.
Acceptance Criteria:
- Given I provide principal and remaining balance less than or equal to principal Then system stores both values.
- If remaining balance > principal Then validation error displayed.

US-003 Edit Loan
Description: As a user I can edit loan fields to reflect changes (excluding historical schedule adjustments) triggering re-simulation prompt.
Acceptance Criteria:
- When I change any editable field and save Then loan updates persist.
- A prompt appears to re-run simulation.
- Old active simulation marked stale until re-run.

US-004 Delete Loan
Description: As a user I can delete a loan with confirmation.
Acceptance Criteria:
- When I click delete Then a confirmation dialog appears.
- Upon confirmation loan is removed from list and active simulation flagged stale.

US-005 Update Remaining Balance
Description: As a user I can manually adjust a loan’s remaining balance (e.g., after an unscheduled extra payment) triggering re-simulation prompt.
Acceptance Criteria:
- Validation ensures new balance is >=0 and <= principal.
- Simulation flagged stale and prompt displayed.

US-006 Change Interest Rate
Description: As a user I can modify a loan’s interest rate to reflect bank changes.
Acceptance Criteria:
- When I change rate and save Then new rate stored with effective date defaulting to next month.
- Prompt to re-run simulation appears.

US-025 Set Interest Rate Effective Date
Description: As a user I can choose whether an interest change applies starting current month or next month.
Acceptance Criteria:
- UI offers option current vs next month.
- Selection stored and used in next simulation.

US-026 Detect Early Payoff
Description: System detects when a loan balance reaches zero mid-simulation.
Acceptance Criteria:
- Simulation marks loan as closed for subsequent months.
- Overpayment previously allocated to closed loan redistributed per strategy.

US-027 Update Dashboard After Payoff
Description: As a user I see paid-off loans visually differentiated and excluded from future allocations.
Acceptance Criteria:
- Dashboard shows paid-off status and zero remaining balance.
- Progress bar complete at 100 percent.

### Overpayment and Strategy
US-007 Set Monthly Overpayment Limit
Description: As a user I can define a PLN amount available for overpayments each month.
Acceptance Criteria:
- Amount must be >=0.
- Stored for use in simulation.

US-008 Edit Overpayment Limit
Description: As a user I can change the monthly overpayment budget triggering re-simulation prompt.
Acceptance Criteria:
- After saving new amount a stale simulation prompt appears.

US-009 View Strategy List
Description: As a user I can view predefined strategies and their definitions.
Acceptance Criteria:
- Strategies displayed with name and short description.
- Initial list includes Avalanche, Snowball, Equal Distribution, Debt Ratio.

US-010 Apply Strategy Allocation
Description: System allocates monthly overpayment across loans per chosen strategy.
Acceptance Criteria:
- Allocation produced for each month in simulation output.
- Overpayment sum equals user limit (except final payoff adjustments).

US-011 Reinvest Reduced Payment
Description: As a user choosing payment reduction goal I can opt to reinvest reduced regular payment amounts into future overpayment pool.
Acceptance Criteria:
- Toggle enabled only for payment reduction goal.
- Simulation reflects increased overpayment pool when chosen.

US-012 Keep Reduced Payment Savings
Description: As a user I can opt to keep reduced payment amounts (do not reinvest).
Acceptance Criteria:
- Toggle off shows overpayment pool unchanged after reduction.

### Goals and Simulation Engine
US-013 Select Fastest Payoff Goal
Description: As a user I can choose fastest payoff as my goal before running simulation.
Acceptance Criteria:
- Goal selection stored and affects allocation logic.

US-014 Select Payment Reduction Goal
Description: As a user I can choose to reduce total monthly payments to a threshold.
Acceptance Criteria:
- Choosing goal requires threshold input before simulation can start.

US-015 Set Payment Reduction Threshold
Description: As a user I provide a PLN target for combined monthly payments.
Acceptance Criteria:
- Validation ensures threshold >0.
- Simulation attempts to reduce payments until target reached or loans paid off.

US-016 Single Active Simulation
Description: System maintains only one active simulation at a time.
Acceptance Criteria:
- Selecting a new simulation replaces previous active one.

US-017 Generate Simulation Schedule
Description: System produces monthly payment and overpayment schedule, with balances and interest saved.
Acceptance Criteria:
- Output includes for each month each loan’s regular payment, overpayment allocation, remaining balance, interest portion.

US-018 Async Simulation Completion Notification
Description: System notifies user when a long-running simulation finishes.
Acceptance Criteria:
- Notification appears if runtime > threshold.

US-019 Store Simulation History
Description: System optionally retains previous simulations for review.
Acceptance Criteria:
- History list shows timestamp, strategy, goal, key metrics.
- Limit of last N simulations (default 10).

US-020 Compare Simulations
Description: As a user I can compare current active simulation metrics with a previous one.
Acceptance Criteria:
- Comparison view shows difference in total interest saved, months to payoff, monthly payment.

US-021 Trigger Re-simulation After Data Change
Description: System flags simulation stale upon relevant data changes.
Acceptance Criteria:
- Any loan edit, deletion, interest change, overpayment limit edit, skipped overpayment, remaining balance adjustment sets stale state.
- User sees prompt to re-run.

US-022 Record Ad Hoc Larger Overpayment
Description: As a user I reflect a larger one-off overpayment by adjusting remaining balance then re-running.
Acceptance Criteria:
- Balance edit accepted and triggers stale simulation prompt.

US-028 Define Interest Saved Baseline
Description: System calculates interest saved versus baseline schedule without overpayments at initial simulation time.
Acceptance Criteria:
- Display shows total interest saved aggregated and per month.

US-047 Limit parallel Simulations
Description: If a simulation is already running, new request cancels current calculation.
Acceptance Criteria:
- User sees notification about previous cancelled simulation. 
- New Simulation starts immediately.

US-054 Extend Strategy Registry
Description: Developer can add new strategy definitions post-MVP.
Acceptance Criteria:
- Strategy registry supports plug-in interface with name, description, allocation function.

### Dashboard and Monthly Updates
US-023 Select Simulation for Dashboard
Description: As a user I choose a simulation to activate.
Acceptance Criteria:
- Active simulation flag set and dashboard populated.

US-024 View Loan Metrics
Description: As a user I see per-loan metrics (remaining principal, monthly payment, interest saved, months remaining, progress bar).
Acceptance Criteria:
- Values update monthly after user marks payments.

US-029 View Monthly Schedule
Description: As a user I view upcoming months of active simulation.
Acceptance Criteria:
- Current month highlighted.
- Future months show projected allocations.

US-030 Mark Monthly Payment Done
Description: As a user I confirm that a loan’s regular payment was made this month.
Acceptance Criteria:
- Status saved per loan for month.
- Dashboard updates interest saved to date.

US-031 Mark Overpayment Executed
Description: As a user I confirm monthly overpayment was applied as scheduled.
Acceptance Criteria:
- Status saved and cumulative interest saved recalculated if necessary.

US-032 Mark Overpayment Skipped
Description: As a user I mark scheduled overpayment not executed, requiring confirmation.
Acceptance Criteria:
- Confirmation dialog appears.
- Simulation flagged stale.

US-033 Backfill Missed Months
Description: As a user I can mark prior months’ payment and overpayment statuses if I missed logging them.
Acceptance Criteria:
- Missing months indicated visually.
- Backfilled statuses included in metrics recalculation.

US-034 View Interest Saved Metrics
Description: As a user I can see total and monthly interest saved.
Acceptance Criteria:
- Dashboard shows aggregate and a per-month breakdown table.

US-035 View Graphs
Description: As a user I view graphs showing monthly remaining balances and interest vs interest saved.
Acceptance Criteria:
- Graph renders for active simulation only.
- Data updates after re-simulation.

US-046 Confirm Destructive Actions
Description: System asks for confirmation on destructive tasks.
Acceptance Criteria:
- Delete loan, reset simulation, mark skipped overpayment all require explicit confirmation.

### Authentication and Access Control
US-036 Register Account
Description: As a new user I create an account to manage loans securely.
Acceptance Criteria:
- Email uniqueness enforced.
- No password complexity requrement

US-037 Login
Description: As a user I log in with credentials.
Acceptance Criteria:
- Valid credentials create session; invalid show error.

US-038 Logout
Description: As a user I end my session.
Acceptance Criteria:
- Session token invalidated and redirected to login.

US-039 Change Password
Description: As a user I change my password.
Acceptance Criteria:
- Requires current password.
- New password stored and old invalidated.

US-040 Session Expiry
Description: System expires inactive sessions after defined timeout.
Acceptance Criteria:
- After timeout user prompted to log in again.

US-041 Data Isolation
Description: A user can only access their own loans and simulations.
Acceptance Criteria:
- Unauthorized access attempts return 403 or redirect.

### Data Persistence and Integrity
US-042 Persist Loan and Simulation Data
Description: System stores all data server-side.
Acceptance Criteria:
- Data available after logout/login.

US-043 Validate Input Values
Description: System enforces basic numeric constraints.
Acceptance Criteria:
- Invalid inputs produce error messages and block save.

US-044 Sanitize Inputs
Description: System strips or escapes unsafe characters.
Acceptance Criteria:
- Stored strings are safe for display.

US-045 Atomic Update on Loan Edit
Description: Loan edits and associated state changes persist atomically.
Acceptance Criteria:
- Partial failure does not leave inconsistent loan state.

### Notifications and Performance
US-047 already listed (limit parallel Simulations) for performance.

### Accessibility
US-048 Basic Color Contrast
Description: UI maintains readable contrast for text and key visuals.
Acceptance Criteria:
- Contrast meets minimum threshold guidelines.

US-049 Text Alternatives for Graphs
Description: Provide textual summary for graph data.
Acceptance Criteria:
- Each graph has accessible description summarizing data ranges.

### Metrics and Analytics
US-050 Track Simulation Selection Ratio
Description: System records total simulations generated vs selected.
Acceptance Criteria:
- Metric available for reporting.

US-051 Track Dashboard Update Count
Description: System counts monthly updates per active simulation.
Acceptance Criteria:
- Counter increments on each payment/overpayment confirmation.

US-052 Track Re-simulations
Description: System logs each re-simulation event.
Acceptance Criteria:
- Event stored with timestamp and trigger type.

US-053 Track Overpayment Adherence
Description: System records executed vs skipped overpayments.
Acceptance Criteria:
- Ratio computed for analytics.

## 6. Success Metrics
Primary Metrics:
1. Simulation Adoption Rate: simulations selected / simulations generated >= 50 percent over a defined measurement window (e.g., first 60 days post-launch).
2. Engagement Rate: percentage of selected simulations receiving >=5 dashboard update events (payment or overpayment confirmations) >= 25 percent.

Secondary Metrics:
1. Average Time to Simulation Completion: mean runtime; monitor for async threshold exceedance.
2. Re-simulation Frequency: average number of re-simulations per user per month (assess friction).
3. Overpayment Adherence: executed overpayments / scheduled overpayments.
4. Early Payoff Incidence: count of loans paid off ahead of original schedule (indicator of effectiveness).

Measurement Approach:
- Instrument creation, selection, update, and status events with timestamps and user identifiers.
- Aggregate metrics nightly for dashboard or analytics view.
- Flag users below adoption thresholds for potential UX review.

Targets (MVP):
- Adoption >= 50 percent.
- Engagement >= 25 percent with >=5 updates.
- Async runtime threshold tuning: keep 90 percent of simulations under 2 seconds (target; measure to refine).
- Overpayment adherence target (exploratory): >=70 percent executed.

Data Quality Considerations:
- Ensure events are idempotent; duplicate confirmations should not inflate counts.
- Handle session expiry gracefully so updates are not lost.

Open Metric Questions:
- Retention definition (cohort window) for adoption tracking.
- Whether to segment metrics by strategy type.

End of Document.
