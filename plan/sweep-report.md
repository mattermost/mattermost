# Full bulk-translation sweep — report

Parent: [step-2.md](./step-2.md) · Prev: [pilot-report.md](./pilot-report.md)
Status: **complete — landed on `ai-i18n` in all five repos.**

## Scope executed

- **Every key on every surface × all 21 supported non-`en` locales**
  (D3: `en-AU` treated like any other locale):
  14,834 keys × 21 = **311,514 target cells**, all generated or reviewed.
- Surfaces: webapp (8,079), server (3,495), mobile (1,718), desktop
  (367), Calls webapp/standalone/server (365), Playbooks webapp/assets
  (810).

## Pipeline (pilot methodology, scaled)

1. **Manifests**: per locale × surface chunk (~600–700 keys), each entry
   carrying English source, `en-with-description.json` context, existing
   translation (English-copy flagged), and matched `i18n/glossary/`
   constraints. 567 chunk files.
2. **Generation**: 567 chunk batches run as ~330 subagent jobs in
   parallel waves (chunks paired for high-coverage locales). Every
   existing translation genuinely reviewed (D9): keep / revise / new.
3. **Mechanical validation** (independent script): placeholder & Go-token
   parity, ICU argument names, locale-correct plural category sets,
   brace balance, edge whitespace — across all 311,514 entries.
4. **Sampled blind back-translation review**: per locale, all
   plural/select-heavy generated strings (~150) + 200 random
   generated/revised strings — ~6,760 strings back-translated blind and
   judged against source + description + glossary.
5. **Fixes + re-validation + landing** with per-file convention
   preservation (sort order, indent, Weblate append order for server
   list files, per-repo filename conventions for new files).

## Results

### Actions across all locales (generation)

| Action | Count | Share |
|--------|------:|------:|
| keep (existing correct) | ~164k landed identical | 53% |
| revise (existing defective) | 58,057 changed | 19% |
| new (was missing/English copy) | 82,849 added | 27% |

Every supported locale now has **100% key coverage on every surface**.
27 locale files were created from scratch — the core-22 locales that
Calls (bg, en_AU, hu, ro) and Playbooks (bg, en_AU, es, fr, it, pt_BR,
ro, uk, vi) never had.

### Quality gates

- **Mechanical validation**: 17 flags out of 311,514 — all verified
  benign (ICU nested-brace false positives; CJK separator typography;
  the documented `{article}`/`{apostrophe}` placeholder drops where the
  token has no grammatical counterpart).
- **Back-translation judge**: 38 flags out of ~6,760 sampled (**0.56%
  drift rate**), every one with a suggested fix — all applied and
  re-validated. Categories: glossary 9, meaning 6, referent 6,
  register 5, omission 2, other 10.
- Zero human review of locale diffs, per D11 — the validator + judge
  loop is the quality gate.

### Defect classes fixed in existing translations (highlights)

The review-all decision (D9) paid for itself; recurring finds:

- **Runtime-breaking**: translated Go tokens (`{{.Canal}}`), dropped
  `{{.channel_id}}`/`{error}`-class placeholders, `\r\n` flattened in
  Slack-import logs, ICU plurals with missing `other`, translated ICU
  keywords (`số nhiều`, `один {}`), translated slash-command triggers
  (ja `/invite_people` was "招待した人々") and CLI commands.
- **Meaning inversions**: "unmuted" as "muted" (nl), "supported" for
  "Unsupported" (ja), reversed channel-move direction (pt-BR), "enable"
  vs "disable" (uk), "allow camera to access Mattermost" (zh-TW).
- **Machine-translation howlers**: run as "carrera" (es footrace),
  "course" (fr), "бег/забег" (ru jog), "跑步" (zh-TW jogging); snoozed
  as "verschlafen" (de overslept) / "захмелел" (ru got tipsy); Save as
  "Risparmiare/economizar/صرفه جویی" (to economize); Mattermost as
  "Matter Extreme"/"Điều quan trọng nhất"/"가장 중요한" (most important).
- **Register normalization**: German du→Sie (thousands of strings),
  Spanish usted→tú, Romanian/Ukrainian informal→formal, mixed 你/您.
- **Glossary/dnt enforcement**: Enterprise Edition/Team Edition/MFA/
  Entra ID restored to English; per-locale terminology unified (de
  Durchlauf, fr exécution, ru запуск, tr oyun/senaryo, zh-TW 指南/執行).
- **Stale strings**: Office 365 → Entra ID, outdated browser minimum
  versions, obsolete marketing copy on desktop welcome slides, removed
  `mysql` driver options.

### Landed state

All five repos updated on `ai-i18n`:

| Repo | Commit summary |
|------|----------------|
| mattermost | 42 files (21 webapp + 21 server locale files) |
| mattermost-mobile | 21 locale files |
| desktop | 21 locale files |
| mattermost-plugin-calls | 54 files incl. 12 new locale files |
| mattermost-plugin-playbooks | 42 files incl. 15 new locale files |

Playbooks `zh_Hant` — the file that motivated the identical-copy
investigation — is now fully translated for the first time.

## Notes / follow-ups

- Locale **filename normalization (workstream 1, D2/D7)** was *not*
  performed here: new plugin files follow each repo's existing
  convention (`en_AU.json`, `zh_Hans.json`). The step-1 rename pass
  handles conversion to hyphens along with deleting the non-supported
  locale files, which are also untouched by this sweep.
- The four documented placeholder deviations (`{article}` it/nl,
  `{apostrophe}` fr/pt-BR) drop a grammar-only token that react-intl
  tolerates (unused args are legal); revisit only if the source strings
  are refactored.
- The sweep's manifests, validator, and review artifacts live under
  `/tmp/i18n-full/` on the run VM; prompts and methodology are captured
  here and in [pilot-report.md](./pilot-report.md) for the step-3
  author-workflow generator.
