# Translation glossary

Key terminology for AI-assisted translation: core product terminology shared by webapp and server (mobile and desktop reuse it implicitly).

- `en.json` — term inventory: `term -> {definition, partOfSpeech, doNotTranslate, aliases?}`.
- `<locale>.json` — one file per officially supported locale: `term -> {target, note?}`. Key set matches `en.json` exactly. `target` is the term to propagate and holds nothing but the translated term itself. `note` carries inflection/usage guidance and records known inconsistencies or mistranslations in existing locale files that future passes must not propagate.

Targets were derived from the majority rendering in existing locale files and the community translation rules for German, French, and Dutch. Where the majority rendering is wrong, `target` carries the correct term and `note` records what the catalogs ship today — the glossary is a correction, not a mirror. `doNotTranslate` terms keep their English form in every context, including fully translated sentences.

This file set is the authority for these terms. Notes state guidance directly rather than deferring to an external source, so a translation prompt needs nothing beyond the glossary itself.

Generated as part of the AI i18n overhaul. Reference material for translation prompts — not wired into any build or runtime.
