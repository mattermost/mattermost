# CLAUDE.md

Guidance for Claude Code when working inside `webapp/`.

## Commands

| Task | Command |
| --- | --- |
| Install deps | `npm install` (builds platform packages) |
| Run (Prod) | `make run` |
| Run (Dev) | `make dev` or `npm run dev-server --workspace=channels` |
| Build All | `make dist` or `npm run build` |
| Build Channels | `npm run build --workspace=channels` |
| Test | `make test` or `npm run test --workspace=channels` |
| Lint/Fix | `make check-style` / `make fix-style` |
| Type Check | `make check-types` |

## Map of Nested CLAUDEs

- **Main App**: `channels/CLAUDE.md`
- **Components**: `channels/src/components/CLAUDE.md`
- **Actions**: `channels/src/actions/CLAUDE.md`
- **Selectors**: `channels/src/selectors/CLAUDE.md`
- **Redux**: `channels/src/packages/mattermost-redux/CLAUDE.md`
- **Client**: `platform/client/CLAUDE.md`
- **Platform**: `platform/CLAUDE.md`
- **Types**: `platform/types/CLAUDE.md`

## Workspace Architecture

- **channels**: Main UI, Redux, Routing.
- **platform/client**: `@mattermost/client` (REST/WS). Singleton usage.
- **platform/types**: `@mattermost/types` (Entities).
- **platform/components**: `@mattermost/components` (Shared UI).

## Critical Rules

- **Imports**: ALWAYS use full package names (`@mattermost/client`). NEVER relative paths to platform packages.
- **Deps**: Add with `npm add <pkg> --workspace=channels`.
- **State**: `state.entities` (Server) vs `state.views` (UI). New entities go in `mattermost-redux`.
- **Client4**: Methods return `{response, headers, data}`. Unwrap in actions.
- **Testing**: Use `renderWithContext` from `channels/src/tests/react_testing_utils.tsx`.
- **I18n**: Use `<FormattedMessage>` or `defineMessages`. No raw strings.
