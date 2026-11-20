# AGENTS.md

Guidance for coding agents working inside `webapp/`.

## Coding Standards

Follow `webapp/STYLE_GUIDE.md` for canonical style, accessibility, and testing standards.

## Product testids and the generated test surface

Product code declares its testable surface with `data-testid`; Playwright page objects are generated from the committed version 4 surface report. Read [the tool README](../e2e-tests/playwright/test-surface/README.md) for config, diagnostics and the scan workflow. Do not hand-write or patch generated page objects.

- Use `scope.name[:key][--role]`. Path words are lowercase `[a-z][a-z0-9_]*`, separated by dots. Examples: `channel_settings.save--button`, `post_list.post:${post.id}--listitem`, `channel_settings.title--text`.
- The role suffix describes the element carrying the testid, not its handler's effect. Put a link's testid on the link and a button's on the button. Read-only content uses `--text`; `aria-pressed` buttons use `--togglebutton`. Keep existing DOM structure and accessibility semantics.
- A scope root may omit its role suffix. A prefix alone does not prove that an element with that ID exists. A component that only exposes its own element is a part of its parent's scope; a bare top-level word without members is not a generated scope.
- Keep scope and identity separate. An optional `testId`/`testIdScope` prop takes only a scope, never a key or role suffix. Derive member IDs with literal suffixes and guard a missing scope: ``testId ? `${testId}.save--button` : undefined``.
- Keys follow the first colon and keep their raw value, including dots in plugin IDs/config paths. Use an entity ID, a fixed set or a position whose origin the scan can prove. Do not use translated labels, mutable display text, concatenated identities or encoded/sanitized substitutes. Pass a repeated item's key separately from its scope; descendants are looked up within that item.
- Use one key kind and one role for each named element. Split the names when mounts represent different identities or interaction patterns. For a stable identity field outside the default id pattern, use a reasoned `checks.keyFields.allow` entry rather than changing product types to satisfy the scanner. Only the canonical `dayKey`/`timeKey` helpers may be listed in `keyValues`.
- A native file input has its own testid without a role suffix, for example `composer.upload`. It is a plain part of its item's family: never give the input its own key or make it a scope container. The generated file-input driver owns `chooseFiles`; an opener button does not.
- For a testid-only task, limit product changes to the IDs, optional scope/key prop plumbing and the corresponding test expectations. Preserve behavior, state, network calls, roles and DOM structure; do not add wrappers, refactor handlers or bend the surface for one spec. If a spec cannot reasonably use the generated API, follow the scoped-locator guidance in [Playwright AGENTS.md](../e2e-tests/playwright/AGENTS.md).

After a testid or declaration/config change, run from `e2e-tests/playwright`:

```sh
npm run scan --workspace @mattermost/playwright-lib
npm run tsc --workspace @mattermost/playwright-lib
npm run scan:check --workspace @mattermost/playwright-lib
```

Fix scan errors and commit `e2e-tests/playwright/lib/surface/webapp.surface.json` with the source change. Generated SDK files are ignored; regenerate them. CI checks that a fresh scan matches the report and that the generated library compiles. An absence assertion on a renamed or nonexistent testid can pass vacuously: update affected tests when changing an ID and preserve their assertions.

## UI components (Compass)

- **Catalog / APIs**: inspect `@mattermost/compass-ui` (package exports / component types) before inventing UI or props.
- **New UI**: prefer `@mattermost/compass-ui` when a published (on npm) component exists. Import via subpaths:
  `import {Button} from '@mattermost/compass-ui/components/button';`
  Do not use the root barrel. Do not recreate Compass primitives.
- **Button**: use Compass UI for text-based button UI. Do not use `@mattermost/shared` `Button` (removed); `buttonClassNames` from `@mattermost/shared/components/button` remains for menu triggers and similar class-only cases. Sizes: `x-small` / `small` / `medium` / `large`. Use `destructive` (boolean) and `appearance="inverted"` for those styles. For link-styled CTAs, use `asChild` with a single `<a>` or router `Link` child instead of nesting a button.
- **Do not mass-migrate** existing UI components to Compass. Only switch when building new UI or when the task is an intentional migration of the code you are already changing.
- **`@mattermost/compass-proto`**: prototyping package not published to npm (shells, call composites, hardcoded menu recipes, proto `WithTooltip`). Not for Mattermost webapp product code — do not add the dependency or import from it unless explicitly adopting that package. Prefer existing webapp / shared / MUI stacks for those surfaces.
- **Exceptions (keep current stacks)**: icons → `@mattermost/compass-icons`; emoji → `Emoji` (`@mattermost/shared`); modals → existing shared / `GenericModal`; menus → existing MUI menus. Do not switch Modal/Menu to compass-ui yet.
- **Icon slots**: when passing icons into compass-ui (`leadingIcon`, `trailingIcon`, `icon`), wrap the compass-icons glyph in Compass `Icon` and omit `size`:
  `import {Icon} from '@mattermost/compass-ui/components/icon';`
- **Tooltips**: use `WithTooltip` from `@mattermost/shared` instead of wiring up Floating UI, compass-proto `WithTooltip`, or other tooltip primitives directly.
  `import {WithTooltip} from '@mattermost/shared/components/tooltip';`
- **Tokens**: Compass foundation CSS variables are global via `@mattermost/compass-ui/styles`. Prefer `var(--…)` over hard-coded radius/spacing/elevation/font/motion values. Theme colors stay on app semantic vars (`--center-channel-*`, etc.). For pills, use `var(--radius-pill)` — webapp `--radius-full` is `50%` and wins over Compass.
- **Standards**: `webapp/STYLE_GUIDE.md`.
- Always import via the full package name (`@mattermost/compass-ui/...`, `@mattermost/shared/...`), never via relative paths into the package (e.g. `platform/shared/` or `node_modules/@mattermost/compass-ui/`).

## Plugin-facing surface on `window.WebappUtils`

**Do not add new top-level `window.*` globals for plugins.** Publish new plugin-facing APIs as sub-namespaces of `window.WebappUtils` instead.

Two existing top-level globals are frozen legacy — do not extend them and do not use them as a model for new work:

- `window.Components` — internal-plugin-only, marked at `webapp/channels/src/plugins/export.ts` as subject to breaking changes outside major releases.
- `window.ProductApi` — a prototype for internal plugins pending module-federation migration, per the comment at the same file.

**Published sub-namespaces**

Each has a contract type in `@mattermost/shared/types/global/` and a build-time drift check in `webapp/channels/src/plugins/published_*.ts`. Third-party plugins pin against these via `min_server_version` — treat every entry like a public API.

- `window.WebappUtils.modals` — contract `PublishedModalUtils`; allowlist in `published_modals.ts`.
- `window.WebappUtils.editor` — contract `PublishedEditorUtils`; allowlist in `published_editor.ts`.
- `window.WebappUtils.components` — contract `PublishedComponents`; allowlist in `published_components.ts`.
- `window.WebappUtils.isolatedFrames` — contract `PublishedIsolatedFrameUtils`; allowlist in `published_isolated_frames.ts`. Backed by the message firewall in `channels/src/utils/isolated_frame_firewall.ts`, which `root.tsx` installs before any other module runs; keep it first.

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
