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
