# AGENTS.md

These are the shipped server translation catalogs, one go-i18n JSON file per
locale. **Read [`i18n/AGENTS.md`](../../i18n/AGENTS.md) at the repository root
before editing any of them** — it covers the workflow and the traps the checkers
do not explain.

The short version:

- As a general rule, a feature or bug fix touches only `en.json`, not the
  non-English catalogs. Prefer the `translate-i18n` skill to fill translations;
  manual fixes from a native speaker are welcome too, ideally with the corrected
  term added to [`i18n/glossary/`](../../i18n/glossary/).
- `make i18n-extract`, run from `server`, adds the ids the code uses to
  `en.json` and orders it. You write each id's English `translation` and its
  `description` by hand, then re-run the extract.
- The `description` says where the string appears. Write one for every id you
  add, and read it before translating.
- Only locale catalogs belong in this directory. The server registers every
  supported-locale `.json` here at startup, and `mmgotool i18n clean-empty`
  rewrites them.
