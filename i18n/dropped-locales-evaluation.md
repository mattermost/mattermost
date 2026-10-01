# Dropped experimental locales: which ones to bring back as `(Experimental)`

Evaluated against `master` (`2e6262768e`) using the catalogs as they stood immediately before
`e9379690d5` "Remove EnableExperimentalLocales and the experimental locales (#38219)", which
deleted 42 webapp and 33 server catalogs.

## 1. The "meaningful translations" set

Denominators (current `en.json`):

| Set | Webapp ids | How it is built |
|---|---:|---|
| Total | 8,513 | every id in `webapp/channels/src/i18n/en.json` |
| Non-admin | 4,524 | total minus `admin.*` (the System Console is 3,989 ids, 47% of the catalog, and end users never see it) |
| **Meaningful** | **3,004** | union of the surface groups below, plus any id referenced from 3+ call sites, minus `admin.*` |
| Core (first impression) | 816 | login/signup + channel sidebar + global header & account menu + 3+-call-site ids |

Surface groups are extracted with the same `formatjs extract` invocation that generates `en.json`,
pointed at the component directories for each surface (see `build_meaningful.py` for the exact list):

| Surface | ids | Components |
|---|---:|---|
| login_signup | 298 | `login`, `signup`, `header_footer_route`, `password_reset_*`, `select_team`, `mfa`, `terms_of_service`, `claim`, `create_team`, `root`, `error_page`, `preparing_workspace`, ... |
| channel_sidebar | 298 | `sidebar`, `team_sidebar`, `new_channel_modal`, `browse_channels`, `more_direct_channels`, `quick_switch_modal`, `drafts`, `invitation_modal`, category modals, ... |
| header_main_menu | 158 | `global_header`, `user_account_menu`, `custom_status`, `announcement_bar`, `channel_layout`, `app_bar`, `menu`, status/DND modals |
| menu_modals | 286 | `about_build_modal`, `keyboard_shortcuts`, `team_settings*`, `team_members_modal`, `leave_team_modal`, `product_notices_modal` |
| channel_view | 1,163 | `channel_header*`, `post_view`, `post`, `advanced_create_post/comment`, `advanced_text_editor`, `dot_menu`, `threading`, `sidebar_right`, `search*`, `channel_info_rhs`, `channel_members_rhs`, `profile_popover`, `emoji_picker`, `file_*`, `markdown`, `timestamp`, channel modals, ... |
| user_settings | 444 | `user_settings`, `settings_sidebar`, `setting_item*`, `user_profile` |
| shared | 467 | `widgets`, `common`, `confirm_modal*`, `multiselect`, `user_list*`, plus `src/utils`, `src/actions`, `mattermost-redux`, `platform/shared` (date formats, system messages, validation errors) |
| frequent (3+ call sites) | 106 | shared buttons/labels such as Cancel, Save, Close, Back, Loading |

Server (`server/i18n/en.json`, 3,642 ids): the **meaningful** subset is the 598 ids an end user reads
rather than an admin or a log: `api.templates.*` (emails), push notification bodies, `api.command*`
(slash command help and responses), `app.notification.*`, in-channel system messages, `api.post.*`,
login/password/verification errors shown on the login page, and month/day names used in emails.

Full id lists: `webapp_meaningful_ids.txt` (with the surface each id came from), `webapp_core_ids.txt`,
`server_meaningful_ids.txt`.

## 2. Scoring rules

- A string counts as translated when the id exists in today's `en.json` and the value is non-empty
  (the server's plural-form objects count if any form is non-empty). Keys that no longer exist in
  `en.json` ("stale") are excluded from the numerator.
- "Broken" = the dropped catalog's string fails `webapp/channels/scripts/check_icu.mjs` (the repo's own
  lint: does not parse, invents or drops a variable/tag, demotes a plural, or has an unescaped
  apostrophe before ICU syntax). Reported as a count and as a share of that locale's translated strings.
- Everything is reproducible with `build_meaningful.py` then `evaluate.py` (paths are in the script headers).

## 3. Calibration: the 21 supported languages right before the drop

Same denominators, catalogs from the commit before the drop, i.e. before PR #38904 filled them to ~100%.
This is what Mattermost was shipping, and the labels it shipped them under:

| Locale | Label at the time | Webapp total | Webapp meaningful | Webapp core | Server meaningful |
|---|---|---:|---:|---:|---:|
| `pl` | Polski | 88.9% | 93.8% | 95.3% | 99.0% |
| `zh-CN` | 中文 (简体) (Beta) | 88.9% | 93.8% | 95.3% | 99.0% |
| `nl` | Nederlands | 83.7% | 89.3% | 93.0% | 98.8% |
| `de` | Deutsch | 82.9% | 87.3% | 91.4% | 95.0% |
| `sv` | Svenska | 77.0% | 84.7% | 89.6% | 91.8% |
| `ja` | 日本語 | 77.7% | 83.7% | 90.0% | 90.1% |
| `tr` | Türkçe | 77.8% | 83.5% | 89.2% | 93.0% |
| `ko` | 한국어 | 73.6% | 81.7% | 88.7% | 89.1% |
| `uk` | Yкраїнська | 70.8% | 79.7% | 87.4% | 89.0% |
| `zh-TW` | 中文 (繁體) (Beta) | 65.7% | 73.6% | 78.9% | 88.5% |
| `ru` | Pусский | 70.4% | 70.7% | 75.4% | 95.0% |
| `fr` | Français (Alpha) | 56.8% | 63.8% | 69.4% | 86.6% |
| `vi` | Tiếng Việt (Beta) | 54.1% | 59.9% | 67.2% | 85.5% |
| `hu` | Magyar (Alpha) | 53.4% | 59.3% | 64.6% | 84.6% |
| `pt-BR` | Português (Brasil) (Alpha) | 54.0% | 58.5% | 64.3% | 89.1% |
| `es` | Español (Alpha) | 52.5% | 54.1% | 59.8% | 88.3% |
| `fa` | فارسی (Alpha) | 47.4% | 51.5% | 56.1% | 80.4% |
| `bg` | Български (Alpha) | 51.5% | 45.4% | 49.1% | 81.8% |
| `ro` | Română (Alpha) | 42.1% | 42.7% | 48.2% | 75.4% |
| `it` | Italiano (Alpha) | 38.9% | 40.7% | 45.7% | 55.7% |

Read: the weakest language Mattermost shipped (as "Alpha") had ~40% of the meaningful set translated.
Today, after #38904, all 21 are at 99.7-99.8% on every measure.

## 4. The dropped catalogs

Sorted by webapp meaningful coverage. Full table including stale-key and identical-to-English counts
is in `dropped_locales_coverage.csv`.

| Locale | Language | Webapp total | Webapp non-admin | **Webapp meaningful** | Webapp core | Broken strings | Server total | Server meaningful |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `da` | Danish | 86.9% | 91.6% | **92.7%** | 95.1% | 44 (0.6%) | 90.2% | 97.5% |
| `be` | Belarusian | 77.0% | 81.2% | **85.1%** | 90.3% | 42 (0.6%) | 76.0% | 93.6% |
| `cs` | Czech | 72.0% | 74.8% | **79.4%** | 85.8% | 33 (0.5%) | 72.6% | 91.1% |
| `nb-NO` | Norwegian Bokmål | 65.3% | 73.5% | **77.3%** | 86.8% | 6 (0.1%) | 4.0% | 11.2% |
| `lt` | Lithuanian | 54.6% | 57.6% | **60.4%** | 67.3% | 68 (1.5%) | 6.1% | 17.4% |
| `fy` | West Frisian | 51.7% | 53.7% | **56.7%** (real: ~11%, see §5) | 62.6% | 59 (1.3%) | no catalog | no catalog |
| `hr` | Croatian | 22.2% | 28.4% | **31.2%** | 34.9% | 0 (0.0%) | 7.3% | 19.7% |
| `fi` | Finnish | 18.5% | 20.3% | **21.9%** | 23.7% | 11 (0.7%) | 34.5% | 51.5% |
| `pt` | Portuguese (Portugal) | 23.5% | 20.2% | **20.4%** | 19.9% | 5 (0.2%) | 6.6% | 17.7% |
| `el` | Greek | 5.7% | 9.4% | **11.6%** | 10.0% | 9 (1.9%) | 22.2% | 67.9% |
| `sl` | Slovenian | 12.2% | 11.3% | **11.5%** | 13.7% | 47 (4.5%) | 29.8% | 49.5% |
| `ne` | Nepali | 5.0% | 8.1% | **10.0%** | 8.7% | 10 (2.3%) | 0.2% | 0.0% |
| `hi` | Hindi | 23.3% | 9.6% | **8.1%** | 6.2% | 126 (6.4%) | 53.2% | 80.6% |
| `gl` | Galician | 17.1% | 8.8% | **7.1%** | 6.1% | 75 (5.1%) | 1.6% | 4.0% |
| `sq` | Albanian | 2.7% | 4.7% | **6.3%** | 4.8% | 43 (18.8%) | 0.8% | 2.2% |
| `ml` | Malayalam | 3.4% | 6.3% | **6.0%** | 4.8% | 13 (4.5%) | 8.0% | 32.1% |
| `sr` | Serbian | 6.9% | 7.8% | **5.2%** | 3.6% | 3 (0.5%) | 7.2% | 23.9% |
| `ka` | Georgian | 6.1% | 5.9% | **3.4%** | 3.3% | 0 (0.0%) | 3.3% | 6.9% |
| `id` | Indonesian | 2.3% | 4.3% | **3.3%** | 1.3% | 7 (3.6%) | 24.2% | 58.2% |
| `mk` | Macedonian | 1.6% | 2.8% | **3.1%** | 0.2% | 3 (2.3%) | 6.3% | 18.7% |
| `th` | Thai | 0.9% | 1.8% | **2.3%** | 1.0% | 4 (5.0%) | 0.7% | 2.0% |
| `ca` | Catalan | 1.5% | 2.5% | **2.1%** | 1.3% | 3 (2.3%) | 30.0% | 53.7% |
| `kk` | Kazakh | 11.1% | 5.5% | **1.7%** | 1.0% | 11 (1.2%) | no catalog | no catalog |
| `mn` | Mongolian | 1.5% | 2.6% | **1.6%** | 0.5% | 8 (6.2%) | 0.6% | 3.3% |
| `bn` | Bengali | 0.9% | 1.7% | **1.5%** | 0.9% | 8 (10.7%) | no catalog | no catalog |
| `he` | Hebrew | 0.6% | 1.1% | **1.3%** | 0.1% | 2 (3.7%) | 1.3% | 2.0% |
| `kk-Latn` | Kazakh (Latin) | 3.1% | 3.6% | **1.1%** | 0.6% | 13 (4.9%) | no catalog | no catalog |
| `lo` | Lao | 3.6% | 2.4% | **1.1%** | 0.9% | 14 (4.6%) | 0.0% | 0.2% |
| `et` | Estonian | 0.4% | 0.7% | **1.0%** | 0.9% | 0 | 0.5% | 2.0% |
| `km` | Khmer | 0.6% | 1.1% | **0.8%** | 0.2% | 3 (5.9%) | 0.7% | 2.0% |
| `eu` | Basque | 0.1% | 0.3% | **0.4%** | 0.0% | 1 | 1.2% | 2.2% |
| `lv` | Latvian | 0.3% | 0.5% | **0.4%** | 0.1% | 0 | no catalog | no catalog |
| `si` | Sinhala | 0.1% | 0.2% | **0.4%** | 0.2% | 1 | 0.3% | 2.0% |
| `gu` | Gujarati | 0.1% | 0.2% | **0.3%** | 0.0% | 2 | 0.5% | 2.0% |
| `br` | Breton | 0.1% | 0.2% | **0.3%** | 0.0% | 1 | 0.8% | 2.0% |
| `ar` | Arabic | 0.1% | 0.2% | **0.2%** | 0.0% | 0 | 0.5% | 2.0% |
| `am` | Amharic | 0.0% | 0.0% | **0.1%** | 0.0% | 0 | 2.7% | 3.7% |
| `pr` | (no langmap entry; 4-line file) | 0.0% | 0.0% | **0.1%** | 0.0% | 0 | no catalog | no catalog |
| `ar_SA` | Arabic (Saudi Arabia) | 0.0% | 0.0% | **0.0%** | 0.0% | 0 | 0.0% | 0.0% |
| `fil` | Filipino | 0.0% | 0.0% | **0.0%** | 0.0% | 0 | no catalog | no catalog |
| `is` | Icelandic | 0.0% | 0.0% | **0.0%** | 0.0% | 0 | no catalog | no catalog |
| `la` | Latin | 0.0% | 0.0% | **0.0%** | 0.0% | 0 | no catalog | no catalog |

Per-surface breakdown for the candidates (webapp, % of each surface group translated):

| Locale | login_signup | channel_sidebar | header_main_menu | menu_modals | channel_view | user_settings | shared |
|---|---:|---:|---:|---:|---:|---:|---:|
| `da` | 98.3% | 94.0% | 89.2% | 82.9% | 94.7% | 94.8% | 88.2% |
| `be` | 97.7% | 86.6% | 87.3% | 68.2% | 81.7% | 94.4% | 83.3% |
| `cs` | 92.3% | 81.9% | 85.4% | 67.8% | 74.1% | 90.5% | 76.4% |
| `nb-NO` | 93.6% | 83.2% | 83.5% | 54.5% | 72.7% | 86.7% | 76.0% |
| `lt` | 78.5% | 62.1% | 55.7% | 57.7% | 51.5% | 70.5% | 60.4% |
| `fy` | 78.5% | 52.0% | 50.0% | 56.3% | 46.5% | 70.0% | 57.0% |
| `hr` | 41.6% | 35.6% | 16.5% | 33.6% | 25.0% | 41.7% | 29.3% |
| `fi` | 43.0% | 9.1% | 15.2% | 18.5% | 22.0% | 26.1% | 16.7% |
| `pt` | 18.5% | 12.1% | 41.1% | 21.3% | 14.5% | 39.0% | 17.6% |
| `el` | 12.8% | 5.4% | 8.9% | 10.5% | 15.0% | 12.4% | 6.4% |
| `sl` | 19.5% | 6.7% | 14.6% | 19.9% | 10.1% | 5.6% | 12.2% |

## 5. Data-quality findings that change the reading

1. **`fy` (West Frisian) is 84% a copy of the Dutch catalog.** 3,686 of its 4,398 translated strings
   are byte-identical to `nl.json` at the same commit (`login.forgot` = "Wachtwoord vergeten?",
   `user.settings.display.title` = "Afbeeldings instellingen" -- Dutch, not Frisian). Excluding those,
   ~570 strings remain, and several of those are also Dutch that has since diverged from `nl`. Real
   Frisian coverage is at most 6.7% total / 11.4% meaningful / 10.0% core. No other candidate shows
   this pattern: `be` vs `ru`/`uk` is 1-2% identical, `hr` vs `sr` 0%, `cs` vs `sl` 0%. `nb-NO` vs `da`
   (13%) and `pt` vs `pt-BR` (20%) are what you expect from closely related languages sharing short strings.
2. **"Total %" overstates partially translated catalogs because Weblate presents strings in source-file order, and `en.json` is sorted alphabetically.**
   `admin.*` sorts right after `about.*`, so a translator who stopped early translated the System Console and little
   else. 78% of Hindi's translated strings are `admin.*` (total 23.3% but meaningful 8.1%, core 6.2%);
   Galician 73%, Kazakh 73%, Portuguese 54%. Meaningful % is the number to threshold on, not total %.
3. **Server and webapp catalogs diverge sharply for some languages.** `nb-NO` is 77% on the webapp but
   4% on the server, so emails and push notifications would be English until AI fills them. Conversely
   `hi`, `el`, `id`, `ca` have 50-80% of the user-facing server strings but almost no webapp.
4. **ICU breakage is small and fixable in the strong catalogs**: `da` 44 broken strings (0.6% of what
   it translated), `be` 42, `cs` 33, `nb-NO` 6, `lt` 68 (1.5%). These are the strings that would throw
   or render raw markup at runtime; they must be fixed (or dropped so react-intl falls back to English)
   before the catalog is wired in. Each catalog also carries 60-92 stale keys to delete. The repo's
   `check_icu.mjs` reports every one of them; see `dropped_locales_icu_errors.log`.
5. Zero-content files (`ar_SA`, `fil`, `is`, `la`, `pr`, `lo` server) and the near-zero tail were
   never translations; nothing is lost by leaving them out.

## 6. Threshold sensitivity (webapp meaningful %, dropped catalogs)

| Threshold | Languages passing | Which |
|---|---:|---|
| >= 5% | 17 | da, be, cs, nb-NO, lt, fy, hr, fi, pt, el, sl, ne, hi, gl, sq, ml, sr |
| >= 10% | 11 | da, be, cs, nb-NO, lt, fy, hr, fi, pt, el, sl |
| >= 15% | 9 | da, be, cs, nb-NO, lt, fy, hr, fi, pt |
| >= 25% | 7 | da, be, cs, nb-NO, lt, fy, hr |
| >= 40% (weakest shipped Alpha) | 6 | da, be, cs, nb-NO, lt, fy |

With `fy` corrected for the Dutch copy it falls to ~11% and drops out at 15%.

The distribution has two natural gaps: 60% (lt) -> 31% (hr), and 20% (pt) -> 12% (el). A 15%
threshold sits in the second gap, so the result is stable against small changes in how the meaningful
set is drawn; 5% and 10% both land inside the dense tail (el/sl/ne/hi/gl at 7-12%) where the pick would
be arbitrary.

## 7. Recommendation

Threshold: **>= 15% of the meaningful set, measured on the webapp catalog, with the core (login /
sidebar / header) subset also >= 15%.** Rationale: 15% is where the natural gap in the data is; it is
well below the ~40% that the weakest shipped Alpha language had, which is appropriate since AI now
closes the gap; and anything under 15% has essentially no human-translated login page or sidebar, so the
"foundation" it offers an AI pass is a glossary of a few hundred mostly admin-console strings rather than
a style reference for what users actually see.

Bring back as `(Experimental)` now (strong human foundation; AI fills the remainder):

| Locale | Why |
|---|---|
| `da` Danish | 92.7% meaningful, 97.5% server meaningful. Better than 19 of the 21 languages Mattermost was shipping (only `pl` and `zh-CN` were higher). Should arguably skip Experimental and go straight to the supported list. |
| `be` Belarusian | 85.1% / 93.6%. Genuine (not a Russian or Ukrainian copy). |
| `cs` Czech | 79.4% / 91.1%. |
| `nb-NO` Norwegian Bokmål | 77.3% webapp; server is 4%, so emails and push notifications are an AI-only job. |
| `lt` Lithuanian | 60.4% webapp, in line with fr/vi/hu/pt-BR pre-fill. Highest broken-string rate of the group (1.5%), fix before wiring in. |

Bring back, but expect AI to do most of the work (15-35% human foundation, login page partially covered):

| Locale | Why |
|---|---|
| `hr` Croatian | 31.2% meaningful, 41.6% of login/signup, zero ICU errors. |
| `fi` Finnish | 21.9% meaningful but 43% of login/signup and 51.5% of user-facing server strings (emails). |
| `pt` Portuguese (Portugal) | 20.4%, with `pt-BR` already shipped and 20% of `pt` identical to it. Lowest-value of the three: Portuguese speakers already have a fallback. Include if the goal is coverage; cut first if the list needs trimming. |

Do not bring back:

- `fy` West Frisian: a Dutch copy with ~11% real Frisian. Users selecting it would get Dutch with
  Frisian sprinkled in. If there is demand, start it fresh from AI rather than from this catalog.
- `el`, `sl`, `ne` (10-12%): below threshold and their core coverage is 9-14%; essentially English UI.
- `hi` and the rest of the tail: whatever exists is System Console text. Hindi's 80% of email
  templates is the one asset worth salvaging as a glossary if Hindi is ever started from scratch.

Before wiring any catalog back in: delete the stale keys, fix or remove the `check_icu.mjs` failures
listed in `dropped_locales_icu_errors.log`, and run `npm run i18n-verify-translations` /
`make i18n-verify` as the current catalogs do.
