# Component Architecture Overview

This document provides an ASCII tree representation of the UI component structure, including descriptions of which page or business case each component handles.

## Component Tree

```
src/components/
│
├── auth/                                    # Authentication Module
│   │                                        # Business: User sign-in, sign-up, and session management
│   │
│   ├── AuthView.tsx                         # Main auth view - composes layout + form into a single React island
│   ├── AuthLayout.tsx                       # Shared layout wrapper for auth pages (centered card design)
│   ├── AuthForm.tsx                         # Interactive form handling signin/signup with validation & submission
│   ├── AuthLogo.tsx                         # NOSACZ branding logo used in auth pages and nav
│   ├── ErrorSummary.tsx                     # Displays form-level and server errors with support details
│   ├── FormActions.tsx                      # Submit button + secondary links (create account, forgot password)
│   ├── PasswordInput.tsx                    # Password field with show/hide toggle
│   ├── TextInput.tsx                        # Reusable labeled text input with error display
│   └── ToastHost.tsx                        # Toast notification provider and hook for auth feedback
│
├── dashboard/                               # Dashboard Module
│   │                                        # Business: Main user dashboard showing simulation status,
│   │                                        # loan progress, current month actions, and analytics charts
│   │
│   ├── DashboardPage.tsx                    # Page root - orchestrates all dashboard sections with AppShell
│   ├── DashboardDataProvider.tsx            # React context provider for shared dashboard data fetching
│   ├── SimulationStatusBanner.tsx           # Shows active simulation status (strategy, goal, progress)
│   ├── SimulationStaleBanner.tsx            # Warning banner when simulation results are outdated
│   ├── EmptyStateCTA.tsx                    # Call-to-action when no active simulation exists
│   │
│   ├── overview/                            # Overview Cards Section
│   │   │                                    # Business: High-level KPIs (strategy, goal, payoff date, savings)
│   │   │
│   │   ├── OverviewCards.tsx                # Grid container rendering 4 overview metric cards
│   │   └── OverviewCard.tsx                 # Individual metric card with icon, title, value, and subtitle
│   │
│   ├── currentMonth/                        # Current Month Panel
│   │   │                                    # Business: Track and action this month's scheduled payments
│   │   │                                    # and overpayments for each loan
│   │   │
│   │   ├── CurrentMonthPanel.tsx            # Main panel - table/cards for current month entries
│   │   ├── CurrentMonthRow.tsx              # Table row / mobile card for a single loan's monthly entry
│   │   ├── PaymentStatusControl.tsx         # Toggle/button to mark scheduled payment as paid
│   │   ├── OverpaymentStatusControl.tsx     # Toggle/button to mark overpayment as executed
│   │   ├── SkipActionControl.tsx            # Button to skip overpayment with confirmation
│   │   └── ConfirmSkipDialog.tsx            # Modal dialog to confirm skipping an overpayment
│   │
│   ├── loans/                               # Dashboard Loans Section
│   │   │                                    # Business: Read-only overview of all loans in the simulation
│   │   │                                    # with progress bars and savings metrics
│   │   │
│   │   ├── LoansSection.tsx                 # Section wrapper with heading and empty/loading states
│   │   ├── LoansTable.tsx                   # Responsive table displaying all loans
│   │   ├── LoanRow.tsx                      # Table row for a single loan with key metrics
│   │   ├── LoanCard.tsx                     # Mobile card variant for loan display
│   │   ├── LoanProgressBar.tsx              # Visual progress indicator for loan payoff
│   │   └── LoanStatusBadge.tsx              # Badge showing loan status (active, paid off, etc.)
│   │
│   └── charts/                              # Analytics Charts Section
│       │                                    # Business: Visual projections of balance trends and
│       │                                    # interest savings over the simulation timeline
│       │
│       ├── ChartsSection.tsx                # Container rendering both chart cards with legends
│       ├── ChartCard.tsx                    # Wrapper card with title, chart, accessible table toggle
│       ├── BalancesChart.tsx                # Line chart showing remaining balance over time
│       ├── BalancesAccessibleTable.tsx      # Screen-reader accessible table for balance data
│       ├── InterestVsSavedChart.tsx         # Dual-bar chart comparing interest paid vs saved
│       └── InterestAccessibleTable.tsx      # Screen-reader accessible table for interest data
│
├── loans/                                   # Loans Management Module
│   │                                        # Business: Full CRUD operations for user's loans
│   │                                        # (create, edit, delete, balance adjustments)
│   │
│   ├── LoansPage.tsx                        # Page root - loan list with sorting, pagination, and modals
│   ├── LoansHeader.tsx                      # Header with "Add Loan" button and sort controls
│   ├── LoansList.tsx                        # Responsive list/table of loans with action buttons
│   ├── LoansEmptyState.tsx                  # Empty state prompting user to add their first loan
│   ├── PaginationControls.tsx               # Page navigation and page size selector
│   ├── LoanEditorSidebar.tsx                # Slide-over sidebar for creating/editing loan details
│   ├── LoanBalanceQuickEdit.tsx             # Quick dialog for adjusting current balance
│   └── LoanDeleteConfirm.tsx                # Confirmation dialog for loan deletion
│
├── settings/                                # Settings Module
│   │                                        # Business: Configure user preferences for overpayment limit
│   │                                        # and reinvest reduced payments behavior
│   │
│   ├── SettingsApp.tsx                      # Page root - settings form with save/cancel actions
│   ├── SettingsForm.tsx                     # Form layout with all settings fields
│   ├── MonthlyOverpaymentLimitField.tsx     # Number input for monthly overpayment budget
│   ├── ReinvestToggle.tsx                   # Toggle switch for reinvest reduced payments setting
│   ├── ReinvestTooltip.tsx                  # Info tooltip explaining reinvest behavior
│   ├── FormActions.tsx                      # Save/Cancel button group
│   ├── LastUpdatedDisplay.tsx               # Shows when settings were last modified
│   ├── StaleSimulationBanner.tsx            # Warning that settings change invalidates simulation
│   ├── SuccessToast.tsx                     # Toast notification for successful save
│   └── ErrorAlert.tsx                       # Alert component for displaying errors
│
├── wizard/                                  # Simulation Wizard Module
│   │                                        # Business: Guided 3-step wizard to configure and launch
│   │                                        # a new loan repayment simulation
│   │
│   ├── WizardPage.tsx                       # Page root - multi-step wizard with sidebar previews
│   ├── WizardStepper.tsx                    # Step indicator showing progress through wizard
│   ├── StatusBanner.tsx                     # Live status updates during simulation submission
│   │
│   │   # Step 1: Strategy Selection
│   ├── StrategyList.tsx                     # Radio group listing available repayment strategies
│   │
│   │   # Step 2: Goal Configuration
│   ├── GoalSelector.tsx                     # Radio buttons for goal type (fastest payoff vs reduction)
│   ├── ThresholdInput.tsx                   # Number input for payment reduction target amount
│   │
│   │   # Step 3: Review & Submit
│   ├── SubmitControls.tsx                   # Primary submit button with cancel/retry actions
│   │
│   │   # Sidebar Previews
│   ├── SettingsSummary.tsx                  # Preview of current user settings (limit, reinvest)
│   └── LoansPreview.tsx                     # Preview list of loans to be included in simulation
│
├── layout/                                  # Layout Components
│   │                                        # Business: Shared application shell and navigation
│   │
│   └── AppShell.tsx                         # Main app layout with collapsible sidebar navigation
│                                            # Links: Dashboard, Loans, Settings
│
├── ui/                                      # Base UI Components (Shadcn/ui)
│   │                                        # Business: Low-level reusable primitives
│   │
│   ├── button.tsx                           # Button component with variants (primary, outline, ghost)
│   └── dialog.tsx                           # Modal dialog component
│
└── Welcome.astro                            # Landing/welcome page (Astro component)
                                             # Business: Initial landing before authentication
```

## Page-to-Component Mapping

| Route              | Page File               | Root Component        | Description                                      |
| ------------------ | ----------------------- | --------------------- | ------------------------------------------------ |
| `/`                | `pages/index.astro`     | `Welcome.astro`       | Landing page, redirects authenticated users      |
| `/auth/signin`     | `pages/auth/signin.astro` | `AuthView`          | User sign-in form                                |
| `/auth/signup`     | `pages/auth/signup.astro` | `AuthView`          | User registration form                           |
| `/dashboard`       | `pages/dashboard/index.astro` | `DashboardPage`  | Main dashboard with simulation overview          |
| `/loans`           | `pages/loans.astro`     | `LoansPage`           | Loan management (CRUD operations)                |
| `/settings`        | `pages/settings.astro`  | `SettingsApp`         | User preferences configuration                   |
| `/wizard`          | `pages/wizard.astro`    | `WizardPage`          | Simulation creation wizard                       |

## Business Domain Summary

### Authentication (`auth/`)
Handles user authentication flow including sign-in, sign-up, and session management. Provides form validation, error handling, and success feedback.

### Dashboard (`dashboard/`)
The main user interface after login. Displays:
- **Overview Cards**: Key metrics (strategy, goal, projected payoff, savings)
- **Current Month Panel**: Actionable list of this month's payments and overpayments
- **Loans Overview**: Read-only summary of all loans with progress indicators
- **Charts**: Visual analytics for balance projections and interest savings

### Loans Management (`loans/`)
Full CRUD functionality for managing user loans:
- Create new loans with all required financial details
- Edit existing loan parameters
- Quick balance adjustments
- Loan deletion with confirmation
- Sorting and pagination for large portfolios

### Settings (`settings/`)
User preference management:
- **Monthly Overpayment Limit**: Maximum budget for extra payments
- **Reinvest Toggle**: Whether to reinvest savings from reduced payments
- Displays last update time and stale simulation warnings

### Simulation Wizard (`wizard/`)
Guided 3-step process to create new simulations:
1. **Strategy Selection**: Choose repayment strategy (avalanche, snowball, etc.)
2. **Goal Configuration**: Select goal type and optional threshold
3. **Review & Submit**: Confirm settings and launch simulation

### Layout (`layout/`)
Shared application structure:
- Collapsible sidebar navigation
- Consistent page layout across all authenticated views
- Mobile-responsive design

### UI Primitives (`ui/`)
Low-level Shadcn/ui components providing consistent styling and accessibility across the application.
