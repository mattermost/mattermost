# Translating Mattermost strings

Translations live in this repository, but as a general rule they are not part
of a normal feature or bug fix: that PR updates only `en.json` and leaves the
non-English catalogs alone.

Prefer the `translate-i18n` skill to fill translations. Manual fixes to a
catalog are also welcome, for example from a native speaker; when you make one,
consider adding the corrected term to the [glossary](./glossary/) so future
automated translations avoid the same mistake.

This document is the brief for whoever is translating, human or agent. Work
through it top to bottom for the surface you are translating.

Filling a large gap across every locale at once — after a feature lands, or
after merging master — is a fan-out job with its own failure modes. The
`translate-i18n` skill in `.claude/skills/` has the recipe and the scripts.

## Supported locales

The catalogs in each directory are the supported locales; `en` is the source.
`TestSupportedLocalesAreInSync` fails if the catalogs, the Go `supportedLocales`
list and the webapp `languages` map disagree, so adding or removing a locale is
a deliberate, multi-file change, not something to do in passing.

## Where things live

| | Webapp | Server |
|---|---|---|
| Catalogs | `webapp/channels/src/i18n/<locale>.json` | `server/i18n/<locale>.json` |
| Message syntax | ICU MessageFormat (react-intl) | Go `text/template` + plural maps |
| Glossary | [`i18n/glossary/`](./glossary/) | same |

Each entry in `en.json` carries a `description` of where the string appears and
how it is used. It never reaches a user: the webapp does not bundle `en.json`,
and the server ignores the field. Read the description for a key before
translating it — it is usually the difference between a correct translation and
a plausible one.

## Workflow

### Webapp

```bash
cd webapp/channels
npm run i18n-extract   # regenerate src/i18n/en.json from source
```

Then, in order:

1. **Write a description** for every key `i18n-extract` added with an empty
   one. On the webapp, a `description` in the source message descriptor wins over
   the one in `en.json`. Say where the string appears and what the variables refer to, not
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
     description is read by every locale's translator; a question you answer once there is
     a question nobody re-derives.
2. **Fix the English first.** Step 1 routinely turns up typos, wrong
   prepositions and ambiguous source strings. Correct them before translating,
   so the mistake is not carried into every locale. Note where the English lives:
   the webapp's `en.json` is **generated**, so fix the `defaultMessage` in
   source and re-extract; the server's `en.json` is **hand-maintained**, so
   edit it directly.
3. **Run the [glossary candidate pass](#glossary-candidates)** before any
   translation starts.
4. **Translate** the new or changed keys into every non-English catalog,
   inserting each key in its existing sort position.
5. **Verify**: `npm run i18n-verify-translations`

### Server

```bash
cd server
make i18n-extract   # regenerate i18n/en.json from source
```

Then the same five steps, and verify with `make i18n-verify`.

## Glossary candidates

Do this **before** translating, not after. It is the difference between one
agreed term and one independently invented per locale.

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

## Checks

Both checkers run in CI and state their own rules: the header of
`webapp/channels/scripts/check_icu.mjs` (`npm run i18n-verify-translations`) and
`mmgotool i18n verify` (`make i18n-verify`). Run them rather than learning the
rules from this page. The one thing CI does not check:

- **Webapp plural categories.** A webapp plural needs every category its locale
  uses — `new Intl.PluralRules(locale).resolvedOptions().pluralCategories` — and
  ICU silently falls back to `other` for a missing one, so the wrong form
  renders. `check_icu.mjs` does not compare categories; only the skill's
  validator warns. On the server, `make i18n-verify` does enforce them, against
  its own vendored go-i18n set.

## Quality

- **Use the glossary.** [`i18n/glossary/`](./glossary/) fixes the target term
  for core product vocabulary per locale, and marks the terms that stay in
  English. Its `note` fields record known mistranslations that earlier passes
  got wrong — do not reintroduce them.
- **A `doNotTranslate` term stays in English only where it is used as that
  name.** `Channels` is the product when a string names it, but the ordinary
  word when it just starts a sentence or titles a list of channels, and the
  English looks the same either way. Read the description and decide; no checker
  enforces these terms, because it cannot tell the two apart.
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
- **Right-to-left locales: avoid horizontal arrows.** `→` is not mirrored, so in
  a sentence read right to left an arrow meaning "next" or "leads to" points
  backwards. Both checkers warn about it; prefer wording that does not depend on
  the glyph.
- **Do not re-translate a string that already has a translation** unless it is
  wrong or its English changed. Two independent AI passes over the same 200
  strings agreed only 38% of the time — both valid, just different word
  choices. Re-translating churns the catalogs without improving them.

## Do not

- Hand-edit `webapp/channels/src/i18n/imports.ts`. Run
  `npm run gen-lang-imports` from `webapp/`.
- Add non-locale files to `server/i18n/` or `webapp/channels/src/i18n/`. Both
  directories are scanned wholesale by tooling that assumes every `.json` in
  them is a catalog. Translator context goes in `en.json`'s `description`;
  guidance goes in the `AGENTS.md` already there.
- Add, rename or remove a key in `en.json` by hand. Change the source and
  re-extract. What you write by hand is each entry's `description`, and on the
  server its English `translation`.
