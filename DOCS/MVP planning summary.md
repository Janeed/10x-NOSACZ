<conversation_summary>

<decisions>
1. Loan scope: Support generic bank loans (mortgage, car, cash) treated uniformly; no loan type field required.
2. Loan attributes: Fixed interest rate, monthly payment schedule only; interest rate can be manually changed triggering re-simulation.
3. Simulation model: Only one active simulation across all user loans; simulation must be re-run after any loan or overpayment data change.
4. Simulation history: Maintain history of past simulations if feasible.
5. Overpayment handling: User sets a monthly overpayment limit; skipped overpayments are assumed completed unless explicitly marked as not done (then re-simulation required).
6. Dashboard content: Per-loan metrics (current debt, current monthly payment, interest saved, monthly payment reduction, progress bar) plus active simulation state with upcoming payments/overpayments.
7. Update cadence: Monthly user updates; system shows missing months and allows backfill from schedule view.
8. User experience: No onboarding/tooltips for MVP; keep UI simple; basic accessibility only.
9. Editing rules: Any loan edit, deletion, interest change, or overpayment status change prompts re-simulation; deletion removes loan data from dashboard.
10. Graphs: Monthly breakdown only (no cumulative totals initially).
11. Validation: Minimal; no advanced input sanity checks.
12. Security & privacy: Deferred; not addressed for MVP.
13. Performance: No hard targets; allow async processing with dashboard notification when simulation completes.
14. Confirmation dialogs: Required for destructive actions (delete loan, reset simulation, mark skipped overpayment).
15. Tech stack: Undecided; to be chosen after business requirements finalized.
16. Accessibility: Basic contrast and usability only; no extended compliance.
17. Resource model: Single human developer plus AI assistance; time not a hard constraint but scope kept minimal.
18. Success metrics: 50% of simulations selected and added to dashboard; 25% receive ≥5 dashboard updates.
19. Re-simulation triggers: Any data change (loan fields, overpayment limit, missed payment confirmation) forces recalculation prompt.
20. On larger or ad-hoc overpayments: User updates data and re-runs simulation (no future one-off overpayment planning).
</decisions>

<matched_recommendations>
1. Prompt automatic re-simulation after any loan data edit (implemented).
2. Visual indicators for missing monthly updates with quick-edit (accepted).
3. Confirmation for skipped overpayments before recalculation (accepted via explicit marking flow).
4. Maintain simulation history (accepted if feasible).
5. Minimal loan input fields (amount, interest, term) to reduce friction (adopted; no loan type).
6. Destructive action confirmations (accepted).
7. Allow loan deletion with required re-simulation (accepted).
8. Basic accessibility only (accepted).
9. Monthly breakdown focus in graphs (accepted).
10. Defer security/privacy requirements (acknowledged and postponed).
</matched_recommendations>

<prd_planning_summary>
Functional Requirements:
- Loan management: Add/edit/delete loans with fields: principal, interest rate (fixed), term, start date (implicit or explicit), remaining balance. Manual interest rate changes supported.
- Overpayment configuration: Single monthly overpayment limit distributed optimally across loans under predefined strategies (details pending).
- Simulation engine: Runs across all current loans producing monthly payment + overpayment schedule, interest saved, time reduction, and updated monthly payments if user chooses payment reduction path.
- Simulation lifecycle: Single active simulation; history retained if feasible. Any data change triggers prompt to re-run; asynchronous execution allowed.
- Strategy selection: User can choose a predefined overpayment approach and specify goal (fastest payoff vs. reducing monthly payments to a target threshold; with option to reinvest reduced payment or keep it).
- Dashboard: Displays per-loan status metrics and active simulation timeline; flags months with missing updates; enables direct state updates (payment made, overpayment done/not done).
- Update & state tracking: Monthly user updates; ability to backfill missed months; marking skipped overpayment triggers recalculation prompt.
- Data changes: Edits, deletions, interest changes, overpayment limit changes require re-simulation confirmation.
- Graphs & visualization: Monthly schedule chart(s) and progress bars (remaining vs original principal).
- History (conditional): Store prior simulations for user review if development capacity permits.
- Notifications: Show when asynchronous simulations complete.

User Stories / Usage Paths:
1. User adds multiple loans (principal, rate, term) and sets monthly overpayment limit.
2. User selects an overpayment strategy and goal; runs initial simulation.
3. User reviews schedule (payments, overpayments, interest saved) and selects simulation for dashboard.
4. Monthly: User logs in, sees due payments; confirms payments and overpayment executed or marks overpayment skipped.
5. If interest rate changes or user modifies a loan, system prompts to re-run simulation; user triggers recalculation and awaits completion notification.
6. User deletes a loan; system requests confirmation; dashboard updates and prompts new simulation.
7. User views progress (principal remaining, interest saved) and may compare with previous simulation (if history available).

Success Criteria & Measurement:
- Simulation adoption: Track ratio of simulations generated vs those marked selected on dashboard; target ≥50%.
- User engagement: Count per-simulation dashboard updates (payment/overpayment confirmations); target ≥25% with at least 5 updates.
- Secondary metrics (implied): Time to simulation completion (monitor for async threshold), number of re-simulations per user, overpayment adherence (skipped vs completed).

Unresolved Issues / Clarifications Needed:
- Exact predefined overpayment strategies (e.g., debt avalanche, debt snowball variants, interest optimization) not detailed.
- Algorithm for distributing monthly overpayment across loans given different objectives.
- Data schema for simulation history (if implemented) and retention duration.
- Handling edge cases (early payoff mid-term, interest rate adjustments effective date).
- Method for calculating "interest saved" baseline (compared to original schedule?).
- Goal definition for reducing monthly payments: threshold input format and recalculation mechanics.
- Asynchronous processing triggers and performance thresholds (what qualifies as “long”).
- Error handling and rollback on partial updates.
- Authentication approach (even minimal) and storage model (local vs cloud) though security deferred.
- Tech stack selection and architectural constraints (front-end, back-end, storage, calculation engine).
</prd_planning_summary>

<unresolved_issues>
1. Definition and list of predefined overpayment strategies.
2. Precise rules for distributing overpayment across loans per chosen strategy.
3. Baseline reference for interest saved calculation.
4. Simulation history data model and retention policy.
5. Handling of loans paid off earlier than scheduled mid-simulation.
6. Effective date logic for interest rate changes (retroactive vs forward-only).
7. Detailed goal mechanics for reducing monthly payments (calculation of new payment and reinvest logic).
8. Performance and async thresholds (time limits, queueing strategy).
9. Error and validation approach despite minimal input checks (e.g., negative or zero principal).
10. Tech stack decision and architecture (client/server boundaries, persistence layer, computation service).
</unresolved_issues>

</conversation_summary>