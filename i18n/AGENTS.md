# Translating Mattermost strings

Translations live in this repository and ship in the **same pull request** as
the English string they translate. There is no external translation service and
no follow-up PR: a PR that adds or changes a user-facing string is not finished
until all 21 non-English catalogs carry it.

That is only reasonable because you are expected to do it with an AI agent.
This document is the brief for that agent. Work through it top to bottom for the
surface you are changing.

Filling a large gap across all 21 locales at once — after a feature lands, or
after merging master — is a fan-out job with its own failure modes. The
`translate-i18n` skill in `.claude/skills/` has the recipe and the scripts.

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
   what the English says. Find the actual call site rather than paraphrasing —
   that is what makes a description worth having, and it is the only point in
   the process where somebody reads every new string next to the code that
   shows it. Two rules earn their keep:
   - **If the string quotes a name, say whether that name is localized.** A
     string like `the "Clearance" attribute` is unanswerable from the English
     alone, and every locale will guess differently. Check whether the code
     hardcodes it (`CLEARANCE_FIELD_DISPLAY_NAME` did) and write the answer
     down.
   - **When you resolve an ambiguity, put the answer in the description.** The
     description is read by 21 translators; a question you answer once there is
     a question nobody re-derives.
2. **Fix the English first.** Step 1 routinely turns up typos, wrong
   prepositions and ambiguous source strings. Correct them before translating,
   so the mistake is not carried into 21 locales. Note where the English lives:
   the webapp's `en.json` is **generated**, so fix the `defaultMessage` in
   source and re-extract; the server's `en.json` is **hand-maintained**, so
   edit it directly.
3. **Run the [glossary candidate pass](#glossary-candidates)** before any
   translation starts.
4. **Translate** the new or changed keys into all 21 non-English catalogs,
   inserting each key in its existing sort position.
5. **Verify**: `npm run i18n-verify-translations`

### Server

```bash
cd server
make i18n-extract               # regenerate i18n/en.json from source
make i18n-extract-authoring     # add the new ids to the authoring catalog
```

Then the same five steps, and verify with `make i18n-verify`.

## Glossary candidates

Do this **before** translating, not after. It is the difference between one
agreed term and twenty-one independently invented ones.

New features introduce new product vocabulary — "exposure report", "clearance
attribute", "membership policy". Nothing in the checkers can see terminology,
so if a term is not in [`i18n/glossary/`](./glossary/) when translation starts,
each locale coins its own. Every one will be defensible and no two will match,
and the inconsistency is invisible until a user reports it.

The pass:

1. Read the new English strings and pull out the noun phrases that name a
   product concept — a feature, a UI surface, an entity, a role, a state.
   Ignore ordinary English.
2. Drop any term already in `i18n/glossary/en.json`, including its `aliases`.
3. Drop any term that already appears in shipped strings and already has a
   settled rendering in the catalogs — grep for it before deciding it is new.
   An established term does not need a glossary entry to stay consistent.
4. What is left is the candidate list. For each, propose an `en.json` entry:

   ```json
   "exposure report": {
     "definition": "The CSV report listing who was exposed to a flagged post.",
     "partOfSpeech": "noun",
     "doNotTranslate": false
   }
   ```

   Set `doNotTranslate: true` for brand names, protocol acronyms, and anything
   the product renders in English regardless of locale — including strings the
   code hardcodes.
5. **Get the candidate list agreed before continuing.** This is a product
   vocabulary decision, not a translation decision.
6. Once agreed, each locale supplies its `target` in `i18n/glossary/<locale>.json`
   as the first thing it does, then translates using it. The key sets of
   `en.json` and every locale file must match exactly.

If a term is genuinely one-off — it appears in a single string and will never
recur — say so and skip it. The glossary is for vocabulary, not for every noun.

## Rules the checkers enforce

Both checkers are deterministic and run in CI. Getting these right the first
time is faster than iterating against the error output.

**Both surfaces**

- Key parity: every catalog holds exactly the keys `en.json` holds. No extras,
  none missing.
- No empty translation. `""` is how the tooling marks a key as present but not
  yet translated, and both runtimes fall back as if the key were absent, so it
  fails for the same reason a missing key does. A whitespace-only value like
  `" "` is a real translation in a language that separates where English uses a
  word, and is allowed.
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
- **But a balanced pair is deliberate escaping.** When the *source* wraps
  something in ASCII apostrophes — `'<blank>'` in
  `admin.cluster.OverrideHostnameDesc` — that is how it makes `<blank>` render
  as literal text instead of parsing as a tag. Reproduce it byte for byte.
  Deleting the apostrophes, or replacing them with `’`, makes the message throw
  `UNCLOSED_TAG`. The checker only flags a `'<` the *translation* introduced,
  so it will not catch you removing one that was already there.
- There is no way to exempt a key. A translation that deviates from its source
  is either wrong, or the source is encoding English grammar the other
  languages cannot follow — and both are worth fixing rather than recording.

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
- Leave placeholders, markup tags and code identifiers untranslated. The
  recurring cases, so you do not have to deliberate over them every time: theme
  brand names (Denim, Sapphire, Quartz, Indigo, Onyx), protocol and product
  acronyms (`AD/LDAP`, `SAML`, `OAuth`), config keys and field names, and
  strings that are nothing but placeholders (`{source}: {value}`). These come
  back byte-identical to English and that is correct.
- **Right-to-left (`fa`): watch bidi-mirrored characters.** A literal `→` in an
  RTL sentence renders pointing left. That is the correct reading direction but
  the opposite of the English visually, and no checker can see it. Prefer
  wording that does not depend on the glyph's direction.
- **Do not re-translate a string that already has a translation** unless it is
  wrong or its English changed. Two independent AI passes over the same 200
  strings agreed only 38% of the time — both valid, just different word
  choices. Re-translating churns the catalogs without improving them.

## Do not

- Hand-edit `webapp/channels/src/i18n/imports.ts`. Run
  `npm run gen-lang-imports` from `webapp/`.
- Add non-locale files to `server/i18n/` or `webapp/channels/src/i18n/`. Both
  directories are scanned wholesale by tooling that assumes every `.json` in
  them is a catalog. Authoring material goes in the sibling `i18n-authoring/`
  directory; guidance goes in the `AGENTS.md` already there.
- Edit `en.json` by hand to add a key. Change the source string and re-extract.
