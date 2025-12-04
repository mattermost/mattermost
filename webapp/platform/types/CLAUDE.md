# CLAUDE: `platform/types/` (`@mattermost/types`)

## Purpose
- Shared TypeScript definitions for server entities, API payloads, and enums consumed across all Mattermost frontends.

## Guidelines
- Keep files organized by domain (users, channels, teams, emojis, etc.).
- Maintain compatibility with server REST APIs; align naming and shapes with server structs.
- Export granular types so downstream apps can tree-shake (`UserProfile`, `Channel`, `TeamUnread`).
- Avoid duplicating types present elsewhere in the monorepo; reference these definitions instead.

## Workflow
- Update types when server contracts change. Coordinate with backend PRs and document minimum server versions.
- Incrementally add stricter types (e.g., string literal unions) but ensure backward compatibility for older data.
- Run TypeScript builds/tests for dependent workspaces (`channels`, `platform/client`) after modifying shared types.

## Testing & Validation
- Add targeted tests or sample builders when modifying complex unions (see `src/users.ts`, `src/channels.ts`).
- Provide JSDoc comments for exported interfaces to improve IntelliSense.

## References
- `src/users.ts`, `src/channels.ts`, `src/teams.ts`.
- `webapp/STYLE_GUIDE.md → TypeScript`, “Component Prop Typing”.



