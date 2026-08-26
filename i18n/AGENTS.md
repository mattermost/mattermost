# Translating Mattermost strings

Translations live in this repository and ship in the **same pull request** as
the English string they translate. There is no external translation service and
no follow-up PR: a PR that adds or changes a user-facing string is not finished
until all 21 non-English catalogs carry it.

That is only reasonable because you are expected to do it with an AI agent.
This document is the brief for that agent. Work through it top to bottom for the
surface you are changing.

## Supported locales

Twenty-two, identical on both surfaces:

```
bg  de  en  en-AU  es  fa  fr  hu  it  ja  ko  nl
pl  pt-BR  ro  ru  sv  tr  uk  vi  zh-CN  zh-TW
```

`en` is the source. `fa` is right-to-left. The list is pinned by
`TestSupportedLocalesAreInSync`, which fails if the catalogs, the Go
`supportedLocales` list and the webapp `languages` map ever disagree — so adding
or removing a locale is a deliberate, multi-file change, not something to do in
passing.

## Where things live

| | Webapp | Server |
|---|---|---|
| Catalogs | `webapp/channels/src/i18n/<locale>.json` | `server/i18n/<locale>.json` |
| Shape | flat `"key": "message"` | list of `{"id", "translation"}` |
| Message syntax | ICU MessageFormat (react-intl) | Go `text/template` + plural maps |
| Descriptions | `webapp/channels/src/i18n-authoring/en-with-description.json` | `server/i18n-authoring/en-with-description.json` |
| Glossary | [`i18n/glossary/`](./glossary/) | same |

The `i18n-authoring/` catalogs are the translator context: every key paired with
a description of where the string appears and how it is used. They are not
shipped. Read the description for a key before translating it — it is usually
the difference between a correct translation and a plausible one.

## Workflow

### Webapp

```bash
cd webapp/channels
npm run i18n-extract            # regenerate src/i18n/en.json from source
npm run i18n-extract-authoring  # add the new keys to the authoring catalog
```

Then, in order:

1. **Write a description** for every key `i18n-extract-authoring` added with an
   empty one. Say where the string appears and what the variables refer to, not
   what the English says.
2. **Translate** the new or changed keys into all 21 non-English catalogs,
   inserting each key in its existing sort position.
3. **Verify**: `npm run i18n-verify-translations`

### Server

```bash
cd server
make i18n-extract               # regenerate i18n/en.json from source
make i18n-extract-authoring     # add the new ids to the authoring catalog
```

Then the same three steps, and verify with `make i18n-verify`.

## Rules the checkers enforce

Both checkers are deterministic and run in CI. Getting these right the first
time is faster than iterating against the error output.

**Both surfaces**

- Key parity: every catalog holds exactly the keys `en.json` holds. No extras,
  none missing.
- Never invent a variable or tag the source does not have. It throws at format
  time (webapp) or renders `<no value>` (server).
- Never drop one either. The message still renders, it just silently loses a
  value or a link.
- Preserve the file's formatting: 2-space indent, existing key order, trailing
  newline. Match the surrounding entries exactly.

**Webapp (ICU)**

- Every `plural` and `select` needs an `other` branch.
- Keep each variable's type. `{count, plural, ...}` may not become `{count}` —
  it parses and renders, and silently stops pluralizing.
- **Apostrophes.** In ICU, an ASCII `'` immediately before `<` or `{` opens a
  quoted literal that swallows the tag or variable and everything after it. The
  message still parses, so nothing catches it at runtime. Write `l’<link>` with
  a typographic apostrophe, or `l''<link>` to escape. This has broken French and
  Italian strings before.
- A handful of keys legitimately deviate from the source structure; they are
  listed with their reasons in
  `webapp/channels/scripts/i18n_exceptions.json`. Do not add
  entries to silence a check you do not understand.

**Server (Go)**

- `{{.Field}}` tokens must match the source exactly, both directions.
- A plural translation must define **exactly** the categories its locale uses —
  no missing ones and no extra ones. This is stricter than the webapp.

## Plural categories

The two runtimes do not agree, so use the right column for the surface you are
editing. The webapp column is what the language actually needs; the server
column is what `mmgotool i18n verify` requires.

| Locale | Webapp (ICU / CLDR) | Server (go-i18n) |
|---|---|---|
| bg, de, en, en-AU, fa, hu, nl, sv, tr | one, other | one, other |
| es, fr, it, pt-BR | one, many, other | **one, other** |
| ja, ko, vi, zh-CN, zh-TW | other | other |
| pl, ru, uk | one, few, many, other | one, few, many, other |
| ro | one, few, other | one, few, other |

The `many` category for `es`, `fr`, `it` and `pt-BR` is a newer CLDR addition
that the server's vendored go-i18n does not have. Adding a `many` branch to a
server catalog for those locales fails verification; a stale one in `pt-BR` was
a real bug.

## Quality

- **Use the glossary.** [`i18n/glossary/`](./glossary/) fixes the target term
  for core product vocabulary per locale, and marks the terms that stay in
  English. Its `note` fields record known mistranslations that earlier passes
  got wrong — do not reintroduce them.
- **Never paste English into a non-English catalog.** Every check here passes on
  a catalog full of English, so nothing will catch it. If a string genuinely has
  no translation in a language, it still needs a considered decision, not a copy.
- Match the register of the surrounding strings in that catalog rather than
  translating the English literally.
- Leave placeholders, markup tags and code identifiers untranslated.

## Do not

- Hand-edit `webapp/channels/src/i18n/imports.ts`. Run
  `npm run gen-lang-imports` from `webapp/`.
- Add non-locale files to `server/i18n/` or `webapp/channels/src/i18n/`. Both
  directories are scanned wholesale by tooling that assumes every `.json` in
  them is a catalog. Authoring material goes in the sibling `i18n-authoring/`
  directory; guidance goes in the `AGENTS.md` already there.
- Edit `en.json` by hand to add a key. Change the source string and re-extract.
