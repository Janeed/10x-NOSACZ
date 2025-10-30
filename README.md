# 10x-NOSACZ

> Narzędzie Optymalizacji Spłaty Aktualnej Części Zadłużenia – A loan overpayment optimization web app helping Polish borrowers allocate a fixed monthly overpayment budget across multiple loans to either pay off faster or reduce monthly obligations to a target threshold.

<div align="center">

![Astro](https://img.shields.io/badge/Astro-5.13.7-FF5D01?logo=astro)
![React](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?logo=tailwind-css)
![License](https://img.shields.io/badge/License-TBD-lightgrey)

</div>

## Table of Contents
1. [Project Description](#project-description)
2. [Tech Stack](#tech-stack)
3. [Getting Started Locally](#getting-started-locally)
4. [Available Scripts](#available-scripts)
5. [Project Scope](#project-scope)
6. [Project Status](#project-status)
7. [License](#license)
8. [Additional Documentation](#additional-documentation)

## Project Description
NOSACZ centralizes multiple fixed-rate loans and generates an optimized monthly overpayment allocation schedule aligned with one of two user goals:

1. Fastest payoff (minimize total time to clear all loans)
2. Reduce combined monthly payments to a user-defined threshold (optionally reinvesting freed payment amounts)

The application reduces manual amortization calculations, supports strategy-driven allocations (Debt Avalanche, Snowball variant, Equal Distribution, Debt Ratio), and provides clear monthly instructions, progress tracking (interest saved vs baseline), and re-simulation prompts after any data changes.

Core value:
- Automates overpayment distribution decisions.
- Shows projected payoff timeline & interest savings.
- Adapts rapidly to changes (rate adjustments, skipped overpayments, early payoffs).

## Tech Stack

### Frontend
- Astro 5 – Hybrid/static-first framework for performant delivery and islands architecture.
- React 19 – Interactive UI components within Astro pages.
- TypeScript 5 – Type safety and improved developer tooling.
- Tailwind CSS 4 + @tailwindcss/vite – Utility-first styling with modern Vite integration.
- shadcn/ui pattern (Radix primitives + class-variance-authority + tailwind-merge + clsx) – Accessible, composable design system foundations.
- lucide-react – Icon set for UI affordances.
- tw-animate-css – Lightweight animation utilities.

### Backend & Database (Planned)
- Supabase – Managed Postgres + auth layer (not yet integrated in code). Will store users, loans, simulations, monthly update events, and metrics.

### Tooling & Quality
- ESLint 9 + TypeScript ESLint – Static analysis.
- Prettier (with `prettier-plugin-astro`) – Consistent formatting.
- Husky + lint-staged – Pre-commit enforcement.

## Getting Started Locally

### Prerequisites
- Node.js 22.

### Clone & Install
```bash
git clone https://github.com/Janeed/10x-NOSACZ.git
cd 10x-NOSACZ
npm install
```

### Development Server
```bash
npm run dev
```
Visit http://localhost:4321 (Astro default) after the server starts.

### Building for Production
```bash
npm run build
```
Output will be generated in `dist/`. You can preview it locally:
```bash
npm run preview
```

### Lint & Format
```bash
npm run lint      # Run ESLint
npm run lint:fix  # Auto-fix ESLint issues
npm run format    # Prettier format (Astro + TS + JSON + CSS + MD)
```

### Commit Hooks (Husky + lint-staged)
On commit, staged `*.{ts,tsx,astro}` files are lint-fixed; `*.{json,css,md}` files are formatted.

### Environment Configuration (Future Supabase Integration)
Create a `.env` file (not yet required for current frontend-only state) once Supabase is added:
```
SUPABASE_URL=your-instance-url
SUPABASE_ANON_KEY=your-anon-key
```
Then load via Astro server-side code or an integration layer. (Not implemented yet.)

### Recommended Next Setup Steps
- Add a CI workflow (`.github/workflows/ci.yml`) running `npm ci && npm run lint && npm run build` to enable a build status badge.
- Introduce initial Supabase schema migration scripts.
- Add unit tests for utility functions (`src/lib/utils.ts`).

## Available Scripts
From `package.json`:
- `dev` – Start Astro dev server.
- `build` – Build production site.
- `preview` – Serve built output for verification.
- `astro` – Direct access to Astro CLI.
- `lint` – Run ESLint across project.
- `lint:fix` – ESLint with auto-fix.
- `format` – Run Prettier formatting.

## Project Scope

### In Scope (MVP)
- Loan CRUD (fixed-rate, PLN only).
- Single monthly overpayment limit & four predefined allocation strategies.
- Two goal modes: fastest payoff, reduce payments to threshold (with reinvest toggle).
- Single active simulation + optional history (limited to recent entries).
- Dashboard: per-loan metrics, monthly schedule, interest saved aggregate & breakdown.
- Monthly updates: mark payment, overpayment executed/skipped, backfill missed months.
- Interest saved baseline vs original amortization without overpayments.
- Basic authentication (email/password) & data isolation.
- Basic accessibility (color contrast, textual descriptions for graphs).
- Performance guard (async simulation if runtime threshold exceeded, cancel previous run).
- Analytics: adoption, engagement, re-simulation frequency, overpayment adherence.

### Out of Scope (MVP)
- Bank integrations, automated payment ingestion.
- Data import/export (CSV/PDF) & multi-currency support.
- Automatic optimization of overpayment limit amount.
- Advanced security (2FA, encryption specifics beyond platform defaults).
- Mobile native app (web responsive only).
- External notifications (email/SMS) beyond in-app indicators.
- Complex loan products (variable rates beyond simple manual adjustments, refinancing logic).
- High-level accessibility compliance beyond basics.

## Project Status
Current Stage: Early MVP scaffolding.

Implemented in repository:
- Astro + React + Tailwind base setup.
- Component scaffold (`src/components/ui/button.tsx`, `Welcome.astro`, layout structure).
- Linting, formatting, commit hooks.

Pending / Upcoming (per PRD):
- Loan & simulation data models + Supabase integration.
- Strategy engine implementation.
- Dashboard & monthly update workflows.
- Interest saving calculations & graphs.
- Authentication flows.
- Metrics instrumentation.

Status Badges: Build status not yet available (no CI workflow). Add GitHub Actions to enable: e.g., `ci.yml` running install, lint, build.

## License
MIT License

## Additional Documentation
- [PRD](./DOCS/PRD.md)
- [Technical Stack](./DOCS/TECHSTACK.md)
- [MVP Summary](./DOCS/MVP.md) (planning details)
- [MVP Planning History](./DOCS/MVP%20planning%20history.md)
- [MVP Planning Summary](./DOCS/MVP%20planning%20summary.md)
- [Tech Stack Analysis](./DOCS/TECHSTACK%20analysis.md)

## Contributing (Future)
Contribution guidelines will be defined post-MVP. For now:
- Use feature branches.
- Keep PRs small and focused.
- Ensure lint & build pass before merge.

## Acknowledgements
- Astro, React, Tailwind, and Supabase projects.
- shadcn/ui approach for design system composition.
