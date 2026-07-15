# React replacement plan

## Goals

- Replace the script-based viewer with a typed React application while keeping the current GitHub Pages delivery model.
- Preserve backward compatibility with existing localStorage keys for repository settings and the last opened file.
- Keep GitHub data loading abortable and cache-aware so large private repositories remain usable on mobile.

## Architecture

- `domain`: pure types, schemas, and profile normalization.
- `application`: use-case functions for repository indexes, document loading, and content search.
- `infrastructure`: GitHub API, Markdown rendering, localStorage, and IndexedDB cache adapters.
- `presentation`: React components and app composition.

TanStack Query owns server-state fetching and cancellation. TanStack Router is configured with hash history so GitHub Pages can serve deep links without a custom server. TanStack DB is introduced at the storage boundary for repository profile collections, while compatibility helpers continue to read and write the legacy keys.

## UI decision

Tailwind is the styling baseline. shadcn/ui is a good fit for future React work, especially Dialog, Button, Input, Tabs, Switch, and Tooltip, but this replacement keeps the initial UI layer small to reduce migration risk. When the UI is iterated next, shadcn-style primitives should be introduced from the shared component layer rather than copied directly into feature code.

Material Symbols remain the icon source to match the existing product decision.

## Testing

- Vitest covers domain logic, Markdown rendering, and important component behavior.
- Playwright covers the first-launch repository setup flow across desktop and mobile projects.
- GitHub Actions runs lint, typecheck, unit tests, E2E tests, and the production build before deploying Pages.

## GitHub Pages migration note

The workflow in `.github/workflows/ci-pages.yml` deploys from GitHub Actions. Repository Settings > Pages should use GitHub Actions as the source after this PR is merged.
