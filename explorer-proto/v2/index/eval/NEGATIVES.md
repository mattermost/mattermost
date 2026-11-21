# Negative candidate verification

Each negative candidate is built around UI labels that are absent from both suites. Absence was checked with ripgrep (case-insensitive, regex alternations over the exact i18n string and its camelCase, snake_case and kebab-case variants) over `e2e-tests/cypress/tests`, `e2e-tests/playwright/specs`, `e2e-tests/playwright/lib/src` and `e2e-tests/playwright/upgrade-specs` at the index SHA. The English strings come from `webapp/channels/src/i18n/en.json` (`team_sidebar.hide`, `team_sidebar.show`/`product_rail.showTeamSidebar`, `threading.threadMenu.openInChannel`, `channel_header.channelMembersPendingRequests`/`sidebar_channel.join_requests_pending`, `admin.accesscontrol.trustProxyDeviceIdentityHeader.title`). The match count is the total number of matching lines (0 means absent).

| Candidate                       | Pattern                                                                                                   | Matching lines |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- |
| neg_team_sidebar_toggle         | `hide team sidebar\|show team sidebar\|hideTeamSidebar\|showTeamSidebar\|team_sidebar_hide\|product_rail` | 0              |
| neg_thread_open_in_channel      | `open in channel\|openInChannel\|open-in-channel`                                                         | 0              |
| neg_pending_join_requests       | `pending join request\|join request\|joinRequest`                                                         | 0              |
| neg_trust_proxy_device_identity | `trust proxy\|device identity\|trustProxyDeviceIdentity`                                                  | 0              |

Reproduce with: `cd e2e-tests && rg -i -c -e '<pattern>' cypress/tests playwright/specs playwright/lib/src playwright/upgrade-specs`.

Caveat: the labels are absent, but the surrounding feature surface is not equally empty. For example `Threads` (the global threads view) is covered by many tests, so `neg_thread_open_in_channel` still has related tests and the gate returns `needs_review` for it (see RESULTS.md).
