# CLAUDE: `i18n/`

## Purpose
- Houses locale JSON files and helpers for React Intl integration.
- Ensures every user-facing string in the Channels app is translatable.

## Workflow
- Add new message IDs to `en.json` ONLY.
- Reference strings via `FormattedMessage`, `intl.formatMessage`, or `t('id')` helpers—never hard-code text.
- After editing locale files, run `npm run extract-intl --workspace=channels` (or the appropriate script) if available to sync translations.
- Keep message IDs stable; renaming requires migration guidance for localization teams.

## Guidelines
- Follow `webapp/STYLE_GUIDE.md → Internationalization`.
- Prefer `FormattedMessage` components that wrap child markup for rich text instead of concatenating strings.
- When adding intl utilities outside React, return `MessageDescriptor` objects where possible.
- Avoid `localizeMessage`; use modern helpers.

## Helper Files
- `utils/react_intl.ts` – shared helper functions for formatting and caching.
- `tests/react_testing_utils.tsx` – demonstrates how to provide Intl context for tests.

## References
- Example translations: `en.json`, `es.json`.
- React Intl docs: <https://formatjs.io/docs/react-intl/>.

