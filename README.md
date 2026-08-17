# OWM Frontend

A React frontend scaffolded with **Feature-Sliced Design (FSD)**. Currently just an empty,
production-ready shell — proving React, Vite, routing, and path aliases work — ready for real
business slices to be added as requirements appear.

## Tech stack

- React 18+ (functional components only)
- Vite
- TypeScript
- Zustand — global/client state
- React Router — routing
- Axios — API communication
- Lucide React — icons
- ESLint + Prettier

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full FSD layer breakdown and import rules.

```text
src/
├── app/       application init: providers, router, global styles, entry point
├── pages/     full screens/routes
├── widgets/   large reusable UI blocks (empty until needed)
├── features/  user actions (empty until needed)
├── entities/  business/domain objects (empty until needed)
└── shared/    API client, config, constants, hooks, lib, stores, types, ui
```

## Installation

```bash
npm install
```

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable            | Description                 | Default                     |
| ------------------- | --------------------------- | --------------------------- |
| `VITE_API_BASE_URL` | Base URL for the API client | `http://localhost:3000/api` |

`.env` is git-ignored; never commit it.

## Development

```bash
npm run dev
```

Opens the app at `http://localhost:5173`. `/` renders the home page; any unknown route renders
the not-found page.

## Build

```bash
npm run build
```

Type-checks with `tsc -b` and builds a production bundle with Vite.

```bash
npm run preview
```

Serves the production build locally.

## Linting

```bash
npm run lint
```

## Formatting

```bash
npm run format
```

## FSD import rules

A layer may only import from layers below it in the hierarchy
`app → pages → widgets → features → entities → shared`. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for details and examples.

## Adding a new feature

Create `src/features/<feature-name>/` (kebab-case), e.g. `src/features/login/`. Structure it
with `ui/`, `model/`, `api/` as needed, and expose the public API through `index.ts`. A feature
may import from `entities` and `shared` only.

## Adding a new entity

Create `src/entities/<entity-name>/`, e.g. `src/entities/user/`, typically with:

```text
entities/user/
├── model/   types, state
├── api/     domain API calls (e.g. userApi.ts)
├── ui/      domain-specific UI (e.g. UserAvatar.tsx)
└── index.ts
```

An entity may import from `shared` only.

## Adding a new page

Create `src/pages/<page-name>/ui/<PageName>.tsx` plus an `index.ts` barrel, then register the
route in `src/app/router/routes.tsx`. A page composes widgets and features — it should not
contain reusable low-level UI.

## Where API calls go

- The shared Axios instance lives in `src/shared/api/client.ts`.
- Business API calls belong inside the entity or feature that owns them, e.g.
  `entities/user/api/userApi.ts` — not in `shared/api`.

## Where Zustand state goes

- Only truly global/cross-cutting client state belongs in `src/shared/stores`.
- Domain-specific state belongs next to its domain, e.g. `entities/user/model` or
  `features/auth/model`.
