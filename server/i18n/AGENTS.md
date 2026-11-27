# AGENTS.md

These are the shipped server translation catalogs, one go-i18n JSON file per
locale. [`i18n/README.md`](../../i18n/README.md) at the repository root explains
how they are translated. **Read [`i18n/AGENTS.md`](../../i18n/AGENTS.md) before
editing any of them**: it covers the traps the checkers do not explain.

The short version:

- As a general rule, a feature or bug fix touches only `en.json`, not the
  non-English catalogs. Prefer the `translate-i18n` skill to fill translations;
  manual fixes from a native speaker are welcome too, ideally with the corrected
  term added to [`i18n/glossary/`](../../i18n/glossary/).
- CI holds every translation a PR adds or changes to the rules in
  `i18n/AGENTS.md`, and warns about likely mistakes the checkers let through,
  such as a short string left in English or the wrong form of address. A whole
  sentence left in English fails. Run
  `node i18n/scripts/check_changes.mjs` from the repository root to see what it
  will say.
- `make i18n-extract`, run from `server`, adds the ids the code uses to
  `en.json`, removes the ones it no longer uses, and orders it. It reads the
  enterprise repository at `../../enterprise` when it is there; without it,
  every `ent.` id is removed too, so do not commit that. You write each id's
  English `translation` and its `description` by hand, then re-run the
  extract.
- The `description` says where the string appears. Write one for every id you
  add, as CI fails an id added without one, and read it before translating.
- Only locale catalogs belong in this directory. The server registers every
  supported-locale `.json` here at startup, and `mmgotool i18n clean-empty`
  rewrites them.
