# AGENTS.md

Guidance for coding agents working inside `webapp/`.

## Coding Standards

Follow `webapp/STYLE_GUIDE.md` for canonical style, accessibility, and testing standards.

## Shared Components

Prefer the shared components from `@mattermost/shared` over hand-rolled equivalents:

- **`Button`** — use for text-based button UI instead of building bespoke `<button>` elements or styling.
  ```typescript
  import {Button} from '@mattermost/shared/components/button';
  ```
- **`WithTooltip`** — use for tooltips instead of wiring up Floating UI or other tooltip primitives directly.
  ```typescript
  import {WithTooltip} from '@mattermost/shared/components/tooltip';
  ```

Always import via the full package name (`@mattermost/shared/...`), never via relative paths into `platform/shared/`.
