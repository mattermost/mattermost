# CLAUDE: `types/`

## Purpose
- Local TypeScript declarations shared across the Channels app (store shapes, plugin types, third-party d.ts shims).
- Complements `platform/types` by covering webapp-only constructs.

## Structure
- `store/` – canonical Redux store typings; update when reducers change.
- `plugins/`, `apps.ts`, `actions.ts` – domain-specific interfaces.
- `external/` – ambient declarations for libraries without published types.

## Guidelines
- Keep files small and discoverable; prefer feature-specific files (`cloud/sku.ts`) instead of dumping into `global.d.ts`.
- Avoid `any`; if unavoidable, annotate why and track TODO for future refinement.
- Align naming with server and platform types to prevent duplication (e.g., reuse `UserProfile` from `@mattermost/types`).
- When extending globals (`global.d.ts`), document the reason and include links to usage.

## Coordination
- Shared type changes should originate in `platform/types`; after publishing, update imports here.
- Update `tsconfig.json` references and ESLint overrides if new directories are added.
- Regenerate API/Redux types where applicable when adding new store slices.

## References
- `store/index.ts` consumes these definitions for typed selectors.
- `webapp/STYLE_GUIDE.md → TypeScript`, “Component Prop Typing”.



