## Test Plan for 10x-NOSACZ

### 1. Introduction and Testing Objectives

The purpose of this test plan is to validate the correctness, reliability, performance, and usability of the 10x-NOSACZ web application – a loan overpayment optimization tool that helps users distribute a fixed monthly overpayment budget across multiple loans according to selected strategies and goals. The primary objectives are:

- **Ensure correctness of the overpayment optimization logic** (strategy engine, schedules, interest saved calculations).
- **Verify robustness of loan and simulation workflows** across dashboard, loans list, monthly execution logs, and settings.
- **Validate a secure and reliable user experience** for authentication and data isolation (per-user data in Supabase).
- **Provide fast feedback to developers** via automated unit, integration, and E2E tests integrated into CI.

### 2. Test Scope

#### 2.1 In Scope

- **Loan domain**: CRUD for loans, validating input formats and constraints, handling of multiple loans, deletion, and updates.
- **Simulation engine & strategies**: 
  - Strategy selection (Debt Avalanche, Snowball variant, Equal Distribution, Debt Ratio).
  - Goal modes: fastest payoff vs. reduce monthly payments to threshold with optional reinvest toggle.
  - Overpayment allocation per month and per loan.
  - Interest saved vs. baseline calculations.
- **Dashboard and views**:
  - Dashboard overview (summary metrics, charts, tables).
  - Loans view (list, editing sidebars, empty states, pagination controls).
  - Monthly execution logs (per-month state, marking payments, skips, overpayments).
  - Settings view (overpayment limit, reinvest toggle, user preferences).
  - Wizard (goal selection, loan preview, settings summary, final confirmation).
- **Backend/API layer**:
  - API routes under `src/pages/api/**` for loans, simulations, dashboard, monthly execution logs, and auth.
  - Service layer under `src/lib/services/**` and validation under `src/lib/validation/**`.
  - Supabase integration layer (`supabase.client.ts`, `database.types.ts`).
- **Authentication & authorization**:
  - Email/password sign-in/sign-up flows.
  - Session management and middleware (`src/middleware/index.ts`, `sessionCookies.ts`).
  - Data isolation between users.
- **Non-functional aspects**:
  - Performance of simulations and dashboard queries (guarding against timeouts and long-running simulations).
  - Basic accessibility for core flows (forms, charts, banners).
  - Cross-browser and responsive behavior.

#### 2.2 Out of Scope (for this iteration)

- External bank integrations, automated payment ingestion.
- Data import/export (CSV, PDF) and multi-currency handling.
- Advanced security mechanisms beyond platform defaults (e.g., 2FA, custom encryption layers).
- Native mobile applications; only responsive web is covered.
- External notifications (email/SMS) other than in-app indicators.

### 3. Test Types and Overall Strategy

Testing will be performed at multiple levels, closely aligned with the project structure.

#### 3.1 Static Analysis and Type Safety

- **ESLint + TypeScript ESLint**: Enforced via `npm run lint` and pre-commit hooks.
- **Prettier**: Formatting with `npm run format` to reduce noise and risk of merge conflicts.
- **TypeScript**: Type safety for services (`src/lib/services/**`), hooks (`src/lib/hooks/**`), components (`src/components/**`), and view models (`src/lib/viewModels/**`). Build must be type-error-free.

#### 3.2 Unit Tests

- **Targeted Areas**:
  - `src/lib/utils.ts`: pure helpers (date, math, formatting, etc.).
  - `src/lib/services/**`: business logic for loans, dashboard, monthly execution logs, simulations, and user settings, especially calculation-heavy or branching logic.
  - `src/lib/validation/**`: input validation, domain constraints.
  - `src/lib/viewModels/**`: mapping between database/API data and UI models.
- **Scope**:
  - Edge cases for interest and amortization calculations.
  - Strategy selection and allocation logic given different loan sets and budgets.
  - Scenarios involving skipped overpayments, early payoffs, and rate adjustments.
- **Approach**:
  - Use a unit-testing framework (e.g., Vitest/Jest) with mocks for Supabase/API calls.
  - Aim for high coverage on calculation logic (>90% branch coverage).

#### 3.3 Component and UI Tests

- **React components** under `src/components/**`:
  - Forms (`AuthForm`, `SettingsForm`, loan editors), dialogs (`ConfirmSkipDialog`, `LoanDeleteConfirm`), and control components.
  - Dashboard-specific components (charts, tables, banners such as `SimulationStatusBanner`, `StaleSimulationBanner`).
  - Wizard components (`GoalSelector`, `StatusBanner`, `WizardStepper`).
- **Approach**:
  - Use React Testing Library to assert rendered output based on props and mocked hooks/services.
  - Test basic accessibility: ARIA roles, keyboard navigation for dialogs, proper focus management.
  - Validate conditional rendering (empty states vs. populated views, banners for stale simulations or errors).

#### 3.4 API and Integration Tests

- **Target**: Next.js/Astro API routes under `src/pages/api/**` and their interaction with Supabase via the service layer.
- **Scope**:
  - CRUD for loans and user settings.
  - Simulation run endpoints and dashboard overview endpoints.
  - Monthly execution logs APIs (marking payments, skipping overpayments, backfilling months).
- **Approach**:
  - Use existing `scripts/*.js` (e.g., `dashboardOverviewTest.js`, `loansApiTest.js`, `monthlyExecutionLogsApiTest.js`) as the basis for automated integration/API smoke tests.
  - Run tests against a dedicated test Supabase project or a local test schema.
  - Validate HTTP status codes, response bodies (`src/lib/http/responses.ts`), and error handling.

#### 3.5 End-to-End (E2E) Tests

- **Scope**:
  - Full user journeys across pages under `src/pages/**` (auth, dashboard, loans, settings, wizard).
  - Navigation and state persistence across steps.
- **Core Flows**:
  - New user registration → log in → define loans → configure goal and strategy in wizard → run simulation → view dashboard → perform monthly updates.
  - Returning user with existing data → modify loan or settings → re-run simulation → verify updated schedule and interest savings.
- **Approach**:
  - Use Playwright or Cypress.
  - Run against a deployed test environment or local dev server with seeded test data.

#### 3.6 Non-Functional Testing

- **Performance**:
  - Measure time to run simulations for a realistic number of loans (e.g., 5–10 loans with 5–30 years duration).
  - Verify that the application enforces or signals performance safeguards when computations approach runtime limits.
- **Security**:
  - Verify that unauthorized access is blocked by middleware, especially for API routes.
  - Ensure user data isolation: users cannot access or mutate other users' loans/simulations.
- **Usability & Accessibility**:
  - Validate clarity of error messages, banners, and labels on forms and charts.
  - Check color contrast and keyboard navigation for core flows.
- **Compatibility**:
  - Test in latest Chrome, Firefox, Safari, and Edge on desktop.
  - Verify responsive layout on mobile and tablet breakpoints.

### 4. Test Scenarios for Key Functionalities

#### 4.1 Authentication

- **Sign-Up**:
  - Successful registration with valid email/password.
  - Validation errors (weak password, invalid email, existing email).
- **Sign-In**:
  - Successful login for registered user.
  - Handling invalid credentials, locked/disabled accounts (if applicable).
- **Session Management**:
  - Maintaining session across navigation and refresh.
  - Proper logout behavior (session/cookies cleared, no access to protected routes).

#### 4.2 Loan Management (CRUD)

- **Loan Creation**:
  - Create single loan with minimum required fields.
  - Create multiple loans (different principal, rate, term, start date).
  - Validation errors (negative or zero principal, invalid term, unsupported currency).
- **Loan Editing**:
  - Update principal, rate, or term and verify downstream impact on simulations.
  - Attempt invalid edits (e.g., shortening term beyond remaining months).
- **Loan Deletion**:
  - Delete loan with no simulation attached.
  - Delete loan that participates in existing simulations (verify cascades or constraints as defined).

#### 4.3 Simulation Engine & Strategies

- **Strategy Selection**:
  - Debt Avalanche: verify highest interest rate loan prioritized.
  - Snowball variant: verify smallest balance loan prioritized.
  - Equal Distribution: overpayment split evenly across open loans.
  - Debt Ratio: overpayment allocated proportionally to some loan metric (e.g., outstanding principal).
- **Goal Modes**:
  - Fastest payoff: verify shorter total payoff time compared to baseline.
  - Reduce monthly payments to threshold: 
    - When reinvest is ON: freed payments added to overpayment budget.
    - When reinvest is OFF: freed payments are not automatically reused.
- **Edge Cases**:
  - Overpayment budget larger than total monthly due.
  - Single loan vs many loans.
  - Rate changes mid-schedule, skipped months, and early payoff.

#### 4.4 Dashboard & Charts

- **Overview Metrics**:
  - Total interest saved vs baseline.
  - Time to full payoff per strategy and per simulation.
- **Tables and Charts**:
  - Correct mapping of backend data to charts and accessible tables.
  - Handling empty states: no loans, no simulations.
  - Handling stale simulations: display of `SimulationStaleBanner` when settings/loans changed.

#### 4.5 Monthly Execution Logs

- **Recording Payments**:
  - Mark regular payment + overpayment as executed for a month.
  - Log partial payments (if supported) and verify state.
- **Skip/Backfill**:
  - Use `ConfirmSkipDialog` and related controls to skip a scheduled overpayment.
  - Backfill previously skipped or missing months and verify updated metrics.
- **Error Handling**:
  - Attempt to double-mark a month as paid.
  - Attempt to log payments for invalid date ranges.

#### 4.6 Settings and User Preferences

- **Monthly Overpayment Limit**:
  - Create/update the monthly overpayment limit and verify impact on new simulations.
- **Reinvest Toggle**:
  - Toggle reinvest setting on/off and verify its effect on schedule and totals.
- **Validation & Constraints**:
  - Invalid or extreme values (e.g., 0 limit, extremely high limit) and correct error messages.

#### 4.7 Wizard Flow

- **Happy Path**:
  - Complete wizard from goal selection through loans preview, settings summary, and submission.
  - Verify that resulting simulation is persisted and visible on dashboard.
- **Error Paths**:
  - Navigate back and forth between steps and ensure state is preserved correctly.
  - Attempt submission with missing/invalid data.

#### 4.8 Error Handling & Resilience

- **API Failures**:
  - Simulate network errors and 5xx responses for key APIs and ensure user-friendly error messages/banners.
- **Data Inconsistencies**:
  - Missing or partially migrated data from Supabase and fallback behaviors in UI.

### 5. Test Environment

- **Environments**:
  - Local development (`npm run dev`) for rapid feedback.
  - Dedicated test/staging environment mirroring production configuration.
- **Database**:
  - Supabase test project or schema with seed data scripts (loans, users, simulations, monthly logs).
  - Separate test credentials and connection strings (via `.env`).
- **Browsers/Devices**:
  - Chrome (latest), Firefox (latest), Edge (latest), Safari (latest on macOS/iOS).
  - Desktop resolutions and at least one mobile and tablet breakpoint.

### 6. Test Tools

- **Static & Unit Testing**:
  - Vitest for unit tests in `src/lib/**` and `src/components/**`.
  - React Testing Library for component tests.
- **Integration/API Testing**:
  - Node-based test runners leveraging `scripts/*.js` for API smoke and regression tests.
- **E2E Testing**:
  - Playwright for full-browser tests of user workflows.
- **Quality Tooling**:
  - ESLint, Prettier, Husky, and lint-staged (already configured).
  - GitHub Actions (or similar CI) running `npm ci`, `npm run lint`, test suites, and `npm run build`.

### 7. Test Schedule

Since exact dates are not defined, the schedule is expressed in phases:

- **Phase 1 – Foundation**:
  - Configure unit test framework and add baseline unit tests for `utils`, validation, and core services.
  - Integrate tests into CI.
- **Phase 2 – Integration & API Tests**:
  - Expand scripts-based API tests into a structured integration test suite.
  - Cover main endpoints (loans, simulations, dashboard, monthly logs).
- **Phase 3 – E2E Flows & Regression**:
  - Implement E2E tests for primary user journeys.
  - Establish a smoke/regression suite executed on each release candidate.
- **Phase 4 – Non-Functional Testing**:
  - Execute performance, basic security, and compatibility tests.
  - Tune thresholds and capture baseline metrics.

### 8. Acceptance Criteria

- **Functional Coverage**:
  - All MVP features in scope are covered by at least one automated test and/or clearly documented manual test case.
- **Quality Gates**:
  - No open critical or high-severity defects.
  - Medium-severity defects are assessed and either fixed or explicitly accepted with mitigation.
  - All unit and integration tests pass on CI.
- **Non-Functional**:
  - Simulations complete within acceptable time for expected data volumes.
  - No blockers in targeted browsers/devices.
- **Documentation**:
  - Test cases and scenarios are documented and maintained alongside code changes.
