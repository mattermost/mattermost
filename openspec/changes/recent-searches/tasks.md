# Tasks

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/recent-searches` from the current base and verify `git branch --show-current` prints `feature/recent-searches`
- [x] 0.2 Confirm latest Postgres migration number before adding 000233 (`ls server/channels/db/migrations/postgres/*.up.sql`) and use the next free sequence if 000233 is taken

## 1. Model, migration, and store (HU-01 persistence)

- [x] 1.1 Add `model.RecentSearch` with validation (`messages`/`files`, terms trim, max 2048 runes) and verify `go test ./public/model -run RecentSearch` fails then passes
- [x] 1.2 Add `000233_create_recent_search_queries.{up,down}.sql` for `recentsearchqueries`, run `make migrations-extract`, and verify a clean migrate plus a DB that already has unused `recentsearches` both succeed
- [x] 1.3 Add `RecentSearchStore` (`Save` upsert+prune in one transaction, `GetByUser`, `Delete`), wire `Store`, run `make store-mocks` and `make store-layers`, and verify store tests cover upsert, retain-5, trim, and owner-scoped delete

## 2. App and API (HU-01, HU-02, HU-04, HU-05 server)

- [x] 2.1 Implement App save/list/delete with session user checks, request-scoped logging without terms, and user-scoped `recent_search_updated` publish; verify app tests for 400/403/404-foreign and WS emit
- [x] 2.2 Register `POST/GET /api/v4/users/{user_id}/recent_searches` and `DELETE .../{search_id}` on `BaseRoutes.User`; verify api4 tests for `me`, other-user 403, and `{items:[]}` list shape

## 3. Review and Update Existing Unit Tests (MANDATORY)

- [x] 3.1 Review existing search, store, and websocket tests that this change can regress and update them if signatures or routes changed; verify no stale mocks remain after `make store-mocks`

## 4. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 4.1 Capture pre-test counts for `recentsearches` and `recentsearchqueries` (AGENT MUST EXECUTE)
- [x] 4.2 Run targeted server tests: `go test` for `public/model`, `channels/store/...`, `channels/app`, `channels/api4` packages touched (AGENT MUST EXECUTE)
- [x] 4.3 Run a justified broader subset if targeted tests pass (same packages + related storetest); do not run the full server suite unless needed
- [x] 4.4 Verify post-test DB counts match the baseline or restore leftover rows (AGENT MUST EXECUTE)
- [x] 4.5 Write report `openspec/changes/recent-searches/reports/YYYY-MM-DD-step-4-unit-test-and-db-verification.md` and mark this group complete only after the report exists

## 5. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 5.1 Ensure Mattermost is up at `http://localhost:8065` (start `mattermost-docker` if needed) and obtain a session token
- [x] 5.2 `GET /api/v4/users/me/recent_searches` and verify 200 + `items`
- [x] 5.3 `POST` a messages search, verify 200 body, then `GET` shows it first
- [x] 5.4 `POST` the same key again and verify recency update without a new row
- [x] 5.5 `POST` six distinct searches and verify only five remain
- [x] 5.6 `DELETE` one id, verify it is gone; `DELETE` a foreign/fake id returns 404
- [x] 5.7 `GET/POST` another user's id returns 403; invalid type returns 400
- [x] 5.8 Restore DB to the pre-curl baseline and document commands/responses in `openspec/changes/recent-searches/reports/YYYY-MM-DD-step-5-curl-api-verification.md`

## 6. Client4 and Redux (HU-01–HU-05 client state)

- [x] 6.1 Add `RecentSearch` types and Client4 methods; verify client unit tests hit the three URLs
- [x] 6.2 Add Redux actions/reducer/selectors and websocket handler for `recent_search_updated` plus GET-on-reconnect; verify reducer tests for list, upsert, delete, and error

## 7. Search box UI (HU-01–HU-04)

- [x] 7.1 Fire-and-forget save from `runSearch` for `messages`/`files` only; verify Jest that suggestions/paging do not save and a save failure still shows results
- [x] 7.2 Add `recent_searches.tsx` under hints in `search_box.tsx` (max-height 550px, hide when empty, load error does not block search); verify component tests for order, limit 5, empty, and error
- [x] 7.3 Wire rerun through existing `runSearch` and show an error if stored team is unavailable; verify operators and team-missing cases
- [x] 7.4 Wire Clear with `WithTooltip` default "Clear"; verify delete does not search and failed delete restores a consistent list
- [x] 7.5 Run `make i18n-extract` in webapp after new strings and verify en.json contains the new keys

## 8. Keyboard and E2E (HU-06)

- [x] 8.1 Add keyboard/focus/accessible-name coverage in RTL; verify Escape still closes the popover
- [x] 8.2 Extend Playwright search-box helpers and add a spec for list, rerun, clear, and persist-after-reload (UI-critical)

## 9. Frontend test review and run (MANDATORY)

- [x] 9.1 Review existing `new_search` / `search_box` tests and update snapshots/selectors if needed
- [x] 9.2 Run `npm test` for the affected webapp workspaces (AGENT MUST EXECUTE) and record results in `openspec/changes/recent-searches/reports/YYYY-MM-DD-step-9-webapp-unit-tests.md`

## 10. E2E Testing with Playwright (MANDATORY if applicable - AGENT MUST EXECUTE)

- [x] 10.1 Ensure the Docker Mattermost stack and test user exist at `http://localhost:8065`
- [x] 10.2 Execute the Playwright spec for register, list, rerun, and clear (AGENT MUST EXECUTE; use repo Playwright, not user-run)
- [x] 10.3 Restore any test searches created and write `openspec/changes/recent-searches/reports/YYYY-MM-DD-step-10-e2e-playwright.md`

## 11. Update Technical Documentation (MANDATORY)

- [x] 11.1 Update public API docs (`api/` / OpenAPI) for the three endpoints and verify the documented paths match the handlers
- [x] 11.2 Prepare PR notes from `.github/PULL_REQUEST_TEMPLATE.md` including screenshots and a release-note describing the user-facing history (not `NONE`)
