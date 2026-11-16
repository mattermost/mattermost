# CLAUDE: `i18n/`

## Purpose
- Houses locale JSON files and helpers for React Intl integration.
- Ensures every user-facing string in the Channels app is translatable.

## Workflow
- Add new message IDs to `en.json` ONLY.
- Reference strings via `FormattedMessage`, `intl.formatMessage`, or `t('id')` helpers—never hard-code text.
- After editing locale files, run `npm run extract-intl --workspace=channels` (or the appropriate script) if available to sync translations.
- Keep message IDs stable; renaming requires migration guidance for localization teams.

## en.json
- Unlike the locale catalogs, which are flat `key -> string`, `en.json` pairs each key with a `{defaultMessage, description}`.
- The `description` explains where the string appears and how it is used. It is context for translators, human or AI, and the one field a person writes by hand. `npm run i18n-extract` preserves it; a `description` written in source wins over the recorded one, and a new key arrives with an empty one to fill in.
- Nothing imports `en.json`—an ESLint rule enforces that. English renders from the `defaultMessage` compiled into each call site, so the descriptions never reach the bundle, and neither does a second copy of every English string.

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

