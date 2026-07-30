# Translation glossary

Key terminology for AI-assisted translation: core product terminology shared by webapp and server (mobile and desktop reuse it implicitly).

- `en.json` — term inventory: `term -> {definition, partOfSpeech, doNotTranslate, aliases?}`.
- `<locale>.json` — one file per officially supported locale: `term -> {target, note?}`. Key set matches `en.json` exactly. `note` carries inflection/usage guidance and records known inconsistencies or mistranslations in existing locale files that future passes must not propagate.

Targets were derived from the majority rendering in existing locale files, community translation rules (German/French/Dutch), and the retired Weblate glossaries, in that priority order. `doNotTranslate` terms keep their English form.

Generated as part of the AI i18n overhaul (see PLAN.md / plan/glossary.md in the mattermost repo). Reference material for translation prompts — not wired into any build or runtime.
