# CLAUDE: `plugins/`

## Purpose
- Handles plugin registration, exported surfaces, and compatibility glue between the Channels app and plugin ecosystem.
- Provides TypeScript helpers and UI entry points for third-party integrations.

## Key Files
- `index.ts` – plugin entry, initializes registry, exposes activators.
- `registry.ts` – core API for plugins to register components, reducers, actions, webhooks.
- `products.ts` / `actions.ts` – plugin-aware UX helpers.
- `docs.json` – describes exposed plugin APIs; update when changing interfaces.

## Guidelines
- Follow `webapp/STYLE_GUIDE.md → Plugin Development`.
- Keep exported surfaces stable; deprecate with clear comments and update docs.
- Limit new dependencies—plugins should consume primitives already available in Channels or `platform/components`.
- Test plugin UI surfaces via `plugins/test/` and integration suites; ensure fallbacks when plugins misbehave.

## Security & Stability
- Validate plugin-supplied components/props before rendering to avoid breaking the host app.
- Wrap remote components in error boundaries when possible.
- Document required props and shapes in `plugins/user_settings.ts` or dedicated type files.

## References
- `registry.ts` for API expectations.
- Sample plugin UI: `channel_header_plug/`, `rhs_plugin/`, `textbox/`.



