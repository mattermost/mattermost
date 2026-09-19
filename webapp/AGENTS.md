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

## Plugin-facing surface on `window.WebappUtils`

**Do not add new top-level `window.*` globals for plugins.** Publish new plugin-facing APIs as sub-namespaces of `window.WebappUtils` instead.

Two existing top-level globals are frozen legacy — do not extend them and do not use them as a model for new work:

- `window.Components` — internal-plugin-only, marked at `webapp/channels/src/plugins/export.ts` as subject to breaking changes outside major releases.
- `window.ProductApi` — a prototype for internal plugins pending module-federation migration, per the comment at the same file.

**Published sub-namespaces**

Each has a contract type in `@mattermost/shared/types/global/` and a build-time drift check in `webapp/channels/src/plugins/published_*.ts`. Third-party plugins pin against these via `min_server_version` — treat every entry like a public API.

- `window.WebappUtils.modals` — contract `PublishedModalUtils`; allowlist in `published_modals.ts`.
- `window.WebappUtils.editor` — contract `PublishedEditorUtils`; allowlist in `published_editor.ts`.

**Adding an entry**

Follow all four steps in the same PR:

1. Add the type to `platform/shared/src/types/global/<file>.ts`. Do not import from `webapp/channels`; if you need a webapp-internal type, move its type portion to `@mattermost/types` or `platform/shared/src/types/global/` first.
2. Add the implementation to the corresponding `channels/src/plugins/published_<file>.ts` allowlist.
3. Add a unit test to `published_<file>.test.tsx`.
4. Wire it onto `window.WebappUtils.<sub-namespace>` in `channels/src/plugins/export.ts`.

**Contract drift**

Each allowlist file contains a `ContractHonored` type + `AssertPublished*Contract` type alias (and, for forwardRef components, `AssertsTrue<Handle extends PublishedHandle ? true : never>` handle assertions). **Do not remove these `type Assert*` aliases.** They look unused but are the only thing that makes `tsc` fail when a real component's props or handle drift from the published contract.

**Removing or changing an entry**

Mark it `@deprecated` in the shared type for at least two minor releases before deletion, and call it out in the PR description. Do not silently change a field's type or rename an entry — either breaks plugins pinned to an older `min_server_version`.
