# CLAUDE: `webapp/channels/`

## Purpose
- Main Mattermost web client workspace; almost every UI or Redux change flows through this package.
- Runs as an npm workspace – use `--workspace=channels` when installing deps or running scripts.
- Builds a federated bundle consumed by the server and plugins.

## Local Commands
- `npm run dev-server --workspace=channels` – hot-reload development server.
- `npm run build --workspace=channels` – production bundle (invokes webpack config in this folder).
- `npm run test --workspace=channels` / `npm run test:watch --workspace=channels`.
- `npm run check --workspace=channels` and `npm run fix --workspace=channels` for lint/style fixes.

## Key Files
- `package.json` – workspace-specific scripts, env vars, and browserlist targets.
- `webpack.config.js` – module federation + alias map; update remotes or exposes here only when necessary.
- `jest.config.js` – test roots, transformers, moduleNameMapper for workspace aliases.
- `tsconfig.json` – project references for `src`, `tests`, and embedded packages.

## Module Federation Notes
- Use `channels/src/module_registry.ts` to register async chunks; never import plugin remotes synchronously.
- Exposed modules must stay backward compatible; document any break in `webapp/README.md`.
- When adding a new remote, coordinate with server config (see `webpack.config.js` → `remotes`).
- Prefer wrapping plugin surfaces in adapter components so that federated boundaries remain stable.

## Dependencies & UI Stack
- React 18, Redux 5, React Router 5, React Intl, Floating UI, Compass Icons, Monaco.
- Follow `webapp/STYLE_GUIDE.md → Dependencies & Packages` before introducing new libs.
- `@mattermost/types`, `@mattermost/client`, and `platform/components` are first-party packages; import via full package names, not deep relative paths.

## Common Gotchas
- Postinstall builds platform packages—if TypeScript types feel stale, re-run `npm install` at repo root.
- Use `npm add <pkg> --workspace=channels` to avoid polluting other workspaces.
- Environment-specific overrides live in `config/` on the server side; do not hard-code URLs or feature flags here.
- Webpack aliases mirror tsconfig paths; keep both in sync when adding a new alias.

## References
- `webapp/STYLE_GUIDE.md → Automated Style Checking`, `Dependencies & Packages`.
- `webapp/README.md` for high-level architecture and release info.

