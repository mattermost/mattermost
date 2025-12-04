# CLAUDE: `webapp/platform/`

## Purpose
- Shared packages consumed by every Mattermost web experience (Channels, Boards, Playbooks, plugins).
- Includes `client/`, `components/`, `types/`, and `eslint-plugin/`.
- Changes here affect multiple products—coordinate across teams before merging.

## Workspace Basics
- Each subpackage is its own npm workspace with independent `package.json`, tests, and build scripts.
- Run commands with `npm run <script> --workspace=@mattermost/<pkg>` (e.g., `@mattermost/client`).
- Versioning follows the monorepo; publishable artifacts come from CI pipelines.

## Package Responsibilities
- `client/` – REST + WebSocket Client4 implementation.
- `components/` – Cross-product UI primitives (GenericModal, tour tips, skeleton loaders).
- `types/` – TypeScript definitions shared across packages.
- `eslint-plugin/` – Custom lint rules specific to Mattermost code style.

## Expectations
- Follow `webapp/STYLE_GUIDE.md` plus package READMEs for implementation details.
- Maintain 100% TypeScript coverage; no `any` unless justified with TODO links.
- Update downstream consumers when making breaking changes; document upgrade steps in PRs.

## References
- `platform/README.md` – high-level orientation.
- Individual README files per package (e.g., `platform/components/README.md`).



