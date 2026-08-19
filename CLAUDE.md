# Project rules

This is the OWM ERP frontend (React + Vite). Companion backend: OWM-Backend
(`C:\Users\Admin\Desktop\OWM-Backend`).

**Read `ARCHITECTURE.md` before writing or changing any code.** It documents the
Feature-Sliced Design layering (`app → pages → widgets → features → entities →
shared`), the import-direction rule (a layer may only import from layers below it),
barrel exports (`import { X } from '@/shared/ui'`, never a deep internal path), and
where API calls / state live.

Every new page, feature, or entity follows that structure and layer placement — don't
add a new top-level folder, don't import upward, don't reach past a slice's `index.ts`.

See `DEPLOY.md` for the EC2/GitHub Actions deployment setup.
