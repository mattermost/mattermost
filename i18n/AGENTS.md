# Translating Mattermost strings

Translations live in this repository, but as a general rule they are not part
of a normal feature or bug fix: that PR updates only `en.json` and leaves the
non-English catalogs alone. A translation run catches the catalogs up
afterwards.

A translation run is the pipeline in [`scripts/`](./scripts/): it works out
what each locale needs, checks every answer, and writes the catalogs. The
`translate-i18n` skill in `.claude/skills/` runs it, from a person's session or
unattended. Manual fixes to a catalog are also welcome, for example from a
native speaker. CI holds every translation a PR adds or changes to the same
rules, so a manual fix gets the same checks. When you make one, consider adding
the corrected term to the [glossary](./glossary/) so later runs avoid the same
mistake.

This document is the brief for whoever is translating, human or agent.

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
| Checker | `npm run i18n-verify-translations` | `make i18n-verify` |

Shared by both:

| | |
|---|---|
| [`glossary/`](./glossary/) | Product terms, their target in each locale, and the names that stay in English |
| [`style.json`](./style.json) | How each locale addresses the user: formally or informally, and the pronouns that would mean the other |
| [`baseline.json`](./baseline.json) | For each surface and locale, the commit whose `en.json` that catalog was last brought up to date against |
| [`scripts/`](./scripts/) | The translation pipeline, and the checks CI runs on it |

Each entry in `en.json` carries a `description` of where the string appears and
how it is used. It never reaches a user: the webapp does not bundle `en.json`,
and the server ignores the field. Read the description for a key before
translating it. It is usually the difference between a correct translation and
a plausible one.

## Before translating: the English

A run translates what `en.json` says, into every locale at once, so a defect in
the English is multiplied by the number of locales. Three things come first.

1. **Every key to translate has a description.** `plan.mjs` stops and lists the
   keys that have none in `undescribed.json`. Say where the string appears and
   what the variables refer to, not what the English says. Find the actual call
   site rather than paraphrasing; it is the only point in the process where
   somebody reads every new string next to the code that shows it. Two rules
   earn their keep:
   - **If the string quotes a name, say whether that name is localized.** A
     string like `the "Clearance" attribute` is unanswerable from the English
     alone, and every locale will guess differently. Check whether the code
     hardcodes it (`CLEARANCE_FIELD_DISPLAY_NAME` did) and write the answer
     down.
   - **When you resolve an ambiguity, put the answer in the description.** The
     description is read by every locale's translator; a question you answer
     once there is a question nobody re-derives.

   Where to write it: on the webapp, in the message descriptor in source, which
   wins, or directly in `en.json`, which `npm run i18n-extract` keeps. On the
   server, in `en.json`.
2. **The English is right.** Writing descriptions routinely turns up typos,
   wrong prepositions and ambiguous source strings. Fix them before
   translating, in a PR of their own: a translation run never changes the
   English. The webapp's `en.json` is generated, so fix the `defaultMessage` in
   source and run `npm run i18n-extract` from `webapp/channels`. The server's
   is hand-maintained, so edit it and run `make i18n-extract` from `server`.
3. **New product vocabulary is in the glossary.** See
   [Glossary candidates](#glossary-candidates).

## Glossary candidates

Do this **before** translating, not after. It is the difference between one
agreed term and one independently invented per locale.

New features introduce new product vocabulary: "exposure report", "clearance
attribute", "membership policy". If a term is not in [`glossary/`](./glossary/)
when translation starts, each locale coins its own. Every one will be
defensible and no two will match, and nothing can see the inconsistency until a
user reports it.

The pass, over the run's `strings.json`, which holds every new and changed
English string:

1. Pull out the noun phrases that name a product concept: a feature, a UI
   surface, an entity, a role, a state. Ignore ordinary English.
2. Drop any term already in `glossary/en.json`, including its `aliases`.
3. Drop any term that already appears in shipped strings and has a settled
   rendering in the catalogs. Search for it before deciding it is new. An
   established term does not need a glossary entry to stay consistent.
4. For each term left, add an `en.json` entry and a `target` in every
   `glossary/<locale>.json`, in the same position:

   ```json
   "exposure report": {
     "definition": "The CSV report listing who was exposed to a flagged post.",
     "partOfSpeech": "noun",
     "doNotTranslate": false
   }
   ```

   Set `doNotTranslate: true` for brand names, protocol acronyms, and anything
   the product renders in English regardless of locale, including strings the
   code hardcodes. Its target in every locale is the term itself.
5. A term is a product vocabulary decision, not a translation decision. A run
   may add terms, and lists them in its PR for the reviewer to agree; it never
   changes or removes one. A correction to an existing term is a PR of its own.

`node i18n/scripts/check_glossary.mjs` checks the files. If a term is genuinely
one-off, appearing in a single string that will never recur, skip it. The
glossary is for vocabulary, not for every noun.

## What a translator receives and returns

`plan.mjs` writes one worklist per locale, `worklists/<locale>.json`:

```json
{
  "locale": "ru",
  "base": "<commit>",
  "language": {
    "direction": "ltr",
    "script": "Cyrl",
    "pluralForms": {
      "webapp": {"required": ["one", "few", "many", "other"], "optional": []},
      "server": ["few", "many", "one", "other"]
    },
    "address": {"form": "formal", "use": ["вы", "вас", "вам", "ваш"], "avoid": ["ты", "..."]}
  },
  "webapp": {
    "<key>": {"kind": "new", "english": "...", "description": "...", "terms": [], "siblings": {}, "sameEnglish": []}
  },
  "server": {}
}
```

Each item has a `kind`:

- **`new`**: no translation yet.
- **`changed`**: the English changed since this locale's baseline. The item
  carries `previous` (the English and description the current translation was
  written for) and `current` (that translation). Return a new translation, or
  `current` unchanged if it still fits: rewording "post" to "message" may need
  nothing in a language that already said "message". A `changed` item with
  `carriedFrom` is a renamed key whose description changed, which can mean the
  old translation had the wrong sense.
- **`repair`**: an existing translation with a defect listed in `problems`: a
  webapp plural missing a form the locale uses, or the wrong form of address.
  Fix the problem and change nothing else. Returning it unchanged is an error.

The hints are drawn from the locale's own catalog. `terms` lists the glossary
entries the English uses, with this locale's target and note. `siblings` gives
translations of the nearest keys under the same prefix. `sameEnglish` shows how
the locale already translates the identical English. Use them to match what
the product already says.

The answer is `translations/<locale>.json`:

```json
{
  "webapp": {"<key>": "<ICU message>"},
  "server": {"<id>": "<text>", "<plural id>": {"one": "...", "other": "..."}},
  "acknowledge": {"webapp:<key>": "<why this soft finding is right>"},
  "notes": {"server:<id>": "<anything the reviewer should know>"}
}
```

It answers every item in the worklist, and nothing else. A locale with no
answer file is simply left for the next run. Use `notes` to report a defect in
the English instead of working around it. Then
`node i18n/scripts/validate.mjs <workdir> <locale>` lists every problem.

## The rules

Every translation a run writes, and every translation any PR adds or changes,
is checked by `i18n/scripts/lib/rules.mjs`. The webapp's per-message rules are
`webapp/channels/scripts/icu_rules.mjs`, the code `check_icu.mjs` runs in CI.
The server's mirror `mmgotool i18n verify` string by string.

**Errors** never land:

- the message does not parse, or invents, drops or demotes a variable, tag or
  `{{.Token}}`. On the server, `{{if}}`, `{{else}}` and `{{end}}` must survive
  as the source has them.
- an ASCII apostrophe before `{` or `<` that quotes away the rest of the
  message
- **a plural missing a form.** A webapp plural that shows its count needs every
  form some count 0 to 1000 selects in that locale: `few` and `many` in
  Russian, `few` in Czech. ICU silently falls back to `other`, so "5 каналы"
  renders where "5 каналов" belongs. A form the locale never selects is an
  error too: Chinese never selects `one`, so "exactly one" is `=1`. The
  server's forms are go-i18n's, which differ from the webapp's. Spanish,
  French, Italian and Portuguese have no `many` there. The worklist's
  `pluralForms` gives both.
- a server plural turned into a single string, which stops pluralizing
- an empty value, or one with a U+FFFD replacement character or a control
  character

**Soft findings** are usually mistakes but sometimes exactly right. A run's
answer lands only if it gives a reason in `acknowledge`, and the reasons go in
the PR for the reviewer. For any other PR, they are CI warnings.

| Rule | Finding |
|---|---|
| `identical-to-english` | The translation is the English, and the English has words to translate: two or more in a Latin-script language, one in any other. Not checked for `en-AU`. |
| `english-words` | In a language not written in Latin script, the translation keeps lowercase words from the English. Names, quoted values and identifiers don't count. |
| `do-not-translate` | The English uses a `doNotTranslate` name that the translation leaves out. |
| `address` | The translation uses a pronoun `style.json` lists under `avoid` for its locale: `Sie` in German, `ты` in Russian. |
| `rtl-arrow` | A horizontal arrow in a right-to-left locale. `→` is not mirrored, so an arrow meaning "next" points backwards. Prefer wording that does not depend on the glyph. |

CI also runs both checkers over the whole of every catalog. Their own headers
state their rules: `webapp/channels/scripts/check_icu.mjs`, and `mmgotool i18n
verify` in `tools/mmgotool/commands/i18n.go`. The catalogs as they stand still
break some of the rules above, so for existing strings those checks are
warnings. Runs repair a few at a time.

## Quality

- **Use the glossary**, through the worklist's `terms`. Its `note` fields record
  known mistranslations that earlier passes got wrong; do not reintroduce them.
- **A `doNotTranslate` term stays in English only where it is used as that
  name.** `Channels` is the product when a string names it, but the ordinary
  word when it starts a sentence or titles a list of channels, and the English
  looks the same either way. The glossary marks such names `commonWord`, and no
  rule flags them. Read the description and decide.
- **Never paste English into a non-English catalog.** The soft rules catch the
  obvious cases. A string that genuinely has no translation in a language still
  needs a considered decision, written in `acknowledge`.
- **Address the user as the catalog does.** `style.json` records each locale's
  convention, and the worklist's `address` repeats it. Beyond pronouns, match
  the register of the surrounding strings in that catalog rather than
  translating the English literally.
- Leave placeholders, markup tags and code identifiers untranslated. Theme brand
  names (Denim, Sapphire, Quartz, Indigo, Onyx), protocol and product acronyms
  (`AD/LDAP`, `SAML`, `OAuth`), config keys and field names, and strings that
  are nothing but placeholders (`{source}: {value}`) come back byte-identical to
  English, and that is correct.
- Agglutinative languages, such as Hungarian, Turkish and Korean, attach
  suffixes and particles to an interpolated value whose form you cannot know.
  Rephrase so the value stands alone.
- `en-AU` is localisation, not translation: most strings come back unchanged,
  and a worklist that changes many of them is suspect.
- **Do not re-translate a string that already has a translation** unless it is
  wrong or its English changed. Two independent AI passes over the same 200
  strings agreed only 38% of the time: both valid, just different word choices.
  Re-translating churns the catalogs without improving them, which is why a run
  may change only its worklist.

## Do not

- Hand-edit `webapp/channels/src/i18n/imports.ts`. Run
  `npm run gen-lang-imports` from `webapp/`.
- Add non-locale files to `server/i18n/` or `webapp/channels/src/i18n/`. Both
  directories are scanned wholesale by tooling that assumes every `.json` in
  them is a catalog. Translator context goes in `en.json`'s `description`, and
  guidance goes in the `AGENTS.md` already there.
- Add, rename or remove a key in `en.json` by hand. Change the source and
  re-extract. What you write by hand is each entry's `description`, and on the
  server its English `translation`.
- Seed missing keys as `""`. An empty value fails both checkers, and an absent
  key is only a warning: react-intl and go-i18n fall back to the English.
