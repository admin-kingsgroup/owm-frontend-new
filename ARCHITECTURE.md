# Architecture

This project follows **Feature-Sliced Design (FSD)**.

## Layer hierarchy

```text
app
 ↓
pages
 ↓
widgets
 ↓
features
 ↓
entities
 ↓
shared
```

## Import rule

A layer may only import from layers **below** it. A lower layer must never import from a
higher layer.

Allowed:

```text
app      → pages, widgets, features, entities, shared
pages    → widgets, features, entities, shared
widgets  → features, entities, shared
features → entities, shared
entities → shared
```

Not allowed:

```text
shared   → entities, features, widgets, pages, app
entities → features, widgets, pages, app
features → widgets, pages, app
widgets  → pages, app
```

## Examples

Allowed, since `shared` sits below every other layer:

```ts
import { Button } from '@/shared/ui';
```

Allowed, since `entities` sits below `pages`:

```ts
import { User } from '@/entities/user';
```

Not allowed inside `shared/`, since `pages` sits above it:

```ts
import { LoginPage } from '@/pages/login';
```

## Layer responsibilities

### app/

Application initialization and global configuration only: providers, router, global styles,
entry point. No business logic.

### pages/

Full screens/routes. A page composes widgets and features — it should not contain reusable
low-level UI.

### widgets/

Large, reusable UI blocks composed from features/entities/shared. Empty until a real
composition need appears — do not create a widget speculatively.

### features/

User actions — "what can the user do?" (e.g. `login`, `update-profile`). Empty until a real
feature exists.

### entities/

Business/domain objects (e.g. `user`, `order`), each typically shaped as `model/ api/ lib/ ui/`.
Empty until the domain requires one.

### shared/

Reusable code with no business meaning: API client, env config, constants, hooks, generic
utilities, Zustand store setup, shared types, and generic UI primitives (`button`, `input`,
`modal`, `loading`, `empty-state`). Safe for every layer to depend on.

## Barrel exports

Each slice exposes a single public API through its `index.ts`. Import from the slice root, not
from internal files:

```ts
// Good
import { Button } from '@/shared/ui';

// Avoid
import { Button } from '@/shared/ui/button/Button';
```

## State

Global/client state lives in `shared/stores` **only** for truly cross-cutting state. Do not grow
it into a single store holding the whole application — domain state belongs next to its domain,
e.g. `entities/user/model` or `features/auth/model`.

## API calls

`shared/api/client.ts` configures the single Axios instance. Business API calls live inside the
entity or feature that owns them (e.g. `entities/user/api/userApi.ts`), not in `shared/api`.
