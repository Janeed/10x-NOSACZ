You are an experienced product manager whose task is to help create a comprehensive Product Requirements Document (PRD) based on the provided information. Your goal is to generate a list of questions and recommendations that will be used in subsequent prompting to create a complete PRD.

Please carefully review the following information:

<project_description>

### Main problem

Finding the best strategy for loan overpayment takes a lot of time and calculations, so mostly the decisions are made based on gut feeling. Given constantly changing interest rates is also makes it more tricky to adjust to new variables and requires recalculations. There are general rules of thumb but the goal might differ for everyone making it even harder to find the silver bullet.

### MVP

- Ability for users to add all loans and all neccessary details to calculate simulation
- Ability to store the loan data on the server
- Ability to update the state of the loan (interest rates, remaining debt)
- Ability to define goal for the users - quickst debt pay-off, quickest way to reduce monthly payments to given threshold
- Ability for users to provide monthly overpayment limit that will be distributed most optimal way between all loans each month
- Easy Register and log-in features
- Simulation presentation (graphs) with overpayment schedule and all monthly payment information for each loan (table).
- system should implement pre-defined approaches for overpayment
- ability to choose what result of overpayment should be - reduced time of monthly payment. If monthly payment reduced - ability to choose if reduced amount should be added to overpayment pool (debt avalanche) or kept by user.
- ability to select suggested approach, making it appear on main dashboard with instructions what to do next / ability to quickly update status (over payment made, monthly payment made etc.)
- dashboard with all loan summary containing remaining debt, monthly payment, time remaining, progress bars.

### Out of the scope of the MVP

- integration with banknig systems - importing data, facilitating overpayments etc.
- exporting data from the system
- taking additional overpayment fees into consideration and overall overpayment limits
- finding most optimal monthly overpayment amount
- choosing currency - for now we assume PLN currency everywhere
- importing loan data from files

### Success criteria

- 50% of simulation get selected by user and added to main dashboard
- 25% of simulations get at least 5 updates via main dashboard

</project_description>

Analyze the information provided, focusing on aspects relevant to PRD creation. Consider the following questions:
<prd_analysis>

1. Identify the main problem that the product is intended to solve.
2. Define the key functionalities of the MVP.
3. Consider potential user stories and paths of product usage.
4. Think about success criteria and how to measure them.
5. Assess design constraints and their impact on product development.
   </prd_analysis>

Based on your analysis, generate a list of 10 questions and recommendations in a combined form (question + recommendation). These should address any ambiguities, potential issues, or areas where more information is needed to create an effective PRD. Consider questions about:

1. Details of the user's problem
2. Prioritization of functionality
3. Expected user experience
4. Measurable success indicators
5. Potential risks and challenges
6. Schedule and resources

<questions>
List your questions and recommendations here, numbered for clarity:

For example:

1. Are you planning to introduce paid subscriptions from the start of the project?

Recommendation: The first phase of the project could focus on free features to attract users, and paid features could be introduced at a later stage.
</questions>

Continue this process, generating new questions and recommendations based on the user's responses, until the user explicitly asks for a summary.

Remember to focus on clarity, relevance, and accuracy of results. Do not include any additional comments or explanations beyond the specified output format.

Analytical work should be done in the thinking block. The final output should consist solely of questions and recommendations and should not duplicate or repeat any work done in the prd_analysis section.

<!----------------------------------------------------------------------->

Questions

1. What specific loan types (e.g., mortgage, personal, student) should be supported in the MVP?  
   Recommendation: Clarify supported loan types to ensure the simulation logic and data fields meet user needs.

2. How granular should the loan details be (e.g., variable vs. fixed interest, payment frequency, grace periods)?  
   Recommendation: Define required loan attributes to avoid missing critical simulation variables.

3. What are the primary user personas (e.g., first-time borrowers, financially savvy users)?  
   Recommendation: Develop user personas to prioritize features and tailor the onboarding experience.

4. How should users interact with simulations—can they run multiple scenarios per loan, or only one at a time?  
   Recommendation: Specify simulation management to guide dashboard and data model design.

5. What are the most important metrics to display in the dashboard (e.g., total interest saved, months reduced)?  
   Recommendation: Prioritize dashboard KPIs to focus development and improve user value.

6. How will user authentication and data security be handled, especially for sensitive financial data?  
   Recommendation: Define security requirements early to ensure compliance and user trust.

7. What is the expected frequency of loan updates (e.g., monthly, ad hoc), and how should the UI support this?  
   Recommendation: Clarify update flows to optimize usability and backend performance.

8. How will the system handle changes in interest rates—manual user input or automated suggestions?  
   Recommendation: Decide on rate update mechanisms to balance user control and convenience.

9. What is the minimum acceptable performance for simulation calculations (e.g., response time, concurrent users)?  
   Recommendation: Set performance benchmarks to guide technical architecture and testing.

10. What resources (team size, roles, timeline) are available for MVP delivery, and are there any hard deadlines?  
    Recommendation: Align scope and schedule with available resources to ensure realistic planning.
    <!----------------------------------------------------------------------->

    Answers

11. loans taken from banks with fixed interest, mortgages, car or just cash loans. If calculations will differ among these types, type should be included in input
12. fixed interest with ability to change on-fly and restarting-simulation. we assume monthly payments, we do not handle any grace period data
13. mostly financial-savvy users but the feature should be easy to use so first time borrowers should be able to provide information and run simulation
14. only one simulation can be ran, based on all loans that were defined by the user
15. dashboard should contain all loan statuses (current debt, current monthly payment, interest saved, monthly payment reduction amount, progress bar visualising how much is left to pay of original amount) and selected simulation state (beginning from the moment the simulation was selected, info about upcoming payments and over-payments)
16. we skip such things for now as it will not be deployed for wide-use
17. recommended frequency should be monthly updates from user side regarding payments made and overpayment amounts and timing (through easy and quick to use UI that will appear monthly on dashboard)
18. we assume manual user inputs, no integrations
19. no specific requirements, if it will take long time we can assume it will be done asynchronously and user will see notification on dashboard that the simulations are ready to be reviewed
20. 1 human soul and AI army - so the resources are a bit limited for MVP

<!----------------------------------------------------------------------->

Questions:

1. Should the loan input form explicitly require users to select the loan type (bank, mortgage, car, cash) to ensure accurate calculations?  
   Recommendation: Add a mandatory loan type field to the loan input process for correct simulation logic.

2. Is it acceptable for users to restart simulations every time they change interest rates, or should the system support versioning/history of simulations?  
   Recommendation: Consider implementing a simple simulation history or versioning to help users track changes over time.

3. What level of onboarding or tooltips should be provided to support first-time borrowers without overwhelming financial-savvy users?  
   Recommendation: Design a contextual help system that adapts to user experience level or can be toggled on/off.

4. Should users be able to edit or remove loans after a simulation has started, or is the loan list locked until a new simulation is run?  
   Recommendation: Define clear rules for editing loan data post-simulation to avoid user confusion.

5. How should the dashboard handle scenarios where users miss monthly updates—should there be reminders or a way to catch up on missed entries?  
   Recommendation: Implement gentle reminders or a backlog entry system for missed monthly updates.

6. Are there any privacy or data retention policies to consider, even if the MVP is not for wide use?  
   Recommendation: Draft a basic privacy statement and data handling policy for early testers.

7. Should the UI allow users to simulate future overpayments (e.g., planning a larger payment in a specific month), or only regular monthly overpayments?  
   Recommendation: Clarify if ad-hoc/future overpayments should be supported in the simulation logic.

8. What is the expected workflow if a user wants to change their overpayment limit mid-simulation?  
   Recommendation: Define a process for updating overpayment limits and recalculating simulations accordingly.

9. Should the system provide any warnings or suggestions if the user’s input data appears inconsistent or unrealistic (e.g., negative debt, extremely high payments)?  
   Recommendation: Add basic input validation and user feedback for common data entry errors.

10. Given limited resources, which features are absolutely critical for launch, and which can be deferred to post-MVP?  
    Recommendation: Prioritize core simulation, loan management, and dashboard features for MVP, deferring advanced analytics or UI polish if needed.
    <!----------------------------------------------------------------------->

    Answers

11. yes - only if it is neccessary for the calculations, AFAIK all loans are calculated similarly, just data like amount and interest is different - but correct me if i'm wrong
12. yes
13. let's skip onboarding of the user for now
14. each loan change should be prompted with re-simulation suggestion as any change can affect whole state
15. user should be able to update the state at any time. if update was skipped it should be visible for users that it is missing. the simulation will not change unless user confirms that overpayment was skipped (it will require running simulation again)
16. let's skip this topic for now
17. no, only regular payments, if bigger overpayment happens, user has to re-run simulation with up-to-date-data
18. same as above, updating data will require re-running simulation as the input data changed
19. no, let users have some fun
20. all mentioned features are required, let's assume time is not a factor here (no constraints) but let's not get too carried away with features - we keep it as simple as possible covering necessary features

<!----------------------------------------------------------------------->

Questions

1. Should the loan input form include optional fields for loan type, or is it sufficient to only require amount and interest rate for all loan entries?  
   Recommendation: Keep the loan input minimal (amount, interest rate, term), but allow users to optionally label loans for clarity.

2. When a user changes any loan data, should the system automatically prompt for re-simulation, or should this be a manual action?  
   Recommendation: Implement an automatic prompt for re-simulation whenever loan data is edited, with a clear call-to-action.

3. Should the dashboard visually indicate which months are missing updates, and allow users to quickly fill in missed data?  
   Recommendation: Add a visual indicator (e.g., warning icon) for months with missing updates and provide a quick-edit option.

4. How should the system handle skipped overpayments—should it assume zero overpayment for that month, or require explicit user confirmation?  
   Recommendation: Require explicit user confirmation for skipped overpayments before updating the simulation.

5. Should the simulation history be stored so users can compare previous runs, or is only the latest simulation relevant?  
   Recommendation: Store only the latest simulation per user to keep the MVP simple, but consider basic history for future versions.

6. Are there any accessibility requirements (e.g., color contrast, keyboard navigation) to consider for the dashboard and graphs?  
   Recommendation: Follow basic accessibility best practices to ensure usability for all users.

7. Should users be able to delete loans, and if so, should this also require a re-simulation prompt?  
   Recommendation: Allow loan deletion with a mandatory re-simulation prompt to maintain data integrity.

8. What level of detail should be shown in the simulation graphs—monthly breakdown only, or cumulative totals as well?  
   Recommendation: Start with monthly breakdowns and progress bars; add cumulative totals if users request more detail.

9. Should there be a confirmation step before applying major changes (e.g., deleting a loan, resetting simulation)?  
   Recommendation: Add confirmation dialogs for destructive actions to prevent accidental data loss.

10. Is there a preferred technology stack or platform for building the MVP, or is this open for technical decision-making?  
    Recommendation: Decide on the tech stack early to streamline development and avoid rework.

<!----------------------------------------------------------------------->

Answers

1. no
2. yes, user should be prompted
3. yes, also user should be able to update the state from schedule
4. we assume it was done unless user marks overpayment as not done - it will trigger prompt with recalculation
5. yes, if possible
6. only basic stuff, no extended a11y capabilities
7. yes, and all data will disappear from the dashboard
8. monthly breakdown
9. yes
10. we do not decide tech stack just yet, let's solve business requirements first
