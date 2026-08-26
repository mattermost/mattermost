# AGENTS.md

These are the shipped webapp translation catalogs, one flat `"key": "message"`
JSON file per locale. **Read [`i18n/AGENTS.md`](../../../../i18n/AGENTS.md) at
the repository root before editing any of them** — it covers the whole
workflow, the rules CI enforces, and the plural categories per locale.

The short version:

- Translations ship in the same PR as the English string. All 21 non-English
  catalogs, every time.
- `en.json` is generated. Change the source string and run
  `npm run i18n-extract` from `webapp/channels`; never edit it by hand.
- Translator context for each key lives in
  [`../i18n-authoring/en-with-description.json`](../i18n-authoring/). Read the
  description before translating, and write one for keys you add.
- Messages are ICU MessageFormat. The trap is an ASCII apostrophe immediately
  before `<` or `{`: it opens a quoted literal that swallows the rest of the
  message and still parses. Use `’` or `''`.
- Check your work with `npm run i18n-verify-translations`.
- Only locale catalogs belong in this directory. `gen_lang_imports.mjs` turns
  every `.json` here into a shipped language.
