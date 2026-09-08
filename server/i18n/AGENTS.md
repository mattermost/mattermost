# AGENTS.md

These are the shipped server translation catalogs, one go-i18n
`[{"id", "translation"}]` JSON file per locale. **Read
[`i18n/AGENTS.md`](../../i18n/AGENTS.md) at the repository root before editing
any of them** — it covers the whole workflow, the rules CI enforces, and the
plural categories per locale.

The short version:

- Translations ship in the same PR as the English string. All 21 non-English
  catalogs, every time.
- `en.json` is generated. Change the source string and run `make i18n-extract`
  from `server`; never edit it by hand.
- Translator context for each id lives in
  [`../i18n-authoring/en-with-description.json`](../i18n-authoring/). Read the
  description before translating, and write one for ids you add.
- Messages are Go `text/template`. `{{.Field}}` tokens must match the source
  exactly, in both directions.
- A plural translation must define **exactly** the categories its locale uses in
  the server's vendored go-i18n — which for `es`, `fr`, `it` and `pt-BR` is
  `one, other`, with no `many`, unlike current CLDR. See the table in the root
  guide.
- Check your work with `make i18n-verify`.
- Only locale catalogs belong in this directory. The server registers every
  supported-locale `.json` here at startup, and `mmgotool i18n clean-empty`
  rewrites them.
