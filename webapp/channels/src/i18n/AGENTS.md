# AGENTS.md

These are the shipped webapp translation catalogs, one JSON file per locale.
**Read [`i18n/AGENTS.md`](../../../../i18n/AGENTS.md) at the repository root
before editing any of them** — it covers the workflow and the traps the checkers
do not explain.

The short version:

- As a general rule, a feature or bug fix touches only `en.json`, not the
  non-English catalogs. Prefer the `translate-i18n` skill to fill translations;
  manual fixes from a native speaker are welcome too, ideally with the corrected
  term added to [`i18n/glossary/`](../../../../i18n/glossary/).
- `en.json` is generated from source, except for each key's `description`.
  Keys and English come from the `defaultMessage` at each call site: change the
  source string and run `npm run i18n-extract` from `webapp/channels`, never
  edit them in `en.json`.
- The `description` says where the string appears, and it is the one field you
  write by hand: in the message descriptor in source, which wins, or directly
  in `en.json`. Re-extracting keeps it. Write one for every key you add, and
  read it before translating.
- Only locale catalogs belong in this directory. `gen_lang_imports.mjs` turns
  every `.json` here into a shipped language.
