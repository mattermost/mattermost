# Step 10 Report - Playwright E2E

- Date: 2026-09-27
- Change: recent-searches
- Agent: Cursor Auto (Windows host)

## Environment

Official `mattermost/docker` enterprise 11.7.0 does not include this branch's API or UI. For this group the official app container was paused and **this branch** (server **12.0.0** + webpack `channels` bundle) was served at `http://localhost:8065`.

- Config: `%TEMP%\mm-e2e-config.json` (not in the repo)
- Postgres: `mm-test-postgres` on host **5436**, database `mattermost_e2e`
- Admin user created via API: `sysadmin` / `Sys@dmin-sample1` (Playwright defaults)
- Webapp: production webpack build of `webapp/channels` served from `server/client` → `webapp/channels/dist`
- Playwright: repo runner `@playwright/test` 1.62.1, project `chrome`, `--no-deps` (setup project skipped; plugin list empty)

After the spec, leftover `recentsearchqueries` rows were deleted, the source process on `:8065` was stopped, and `mattermost-docker-mattermost-1` was started again.

## 10.1 Stack and test user

- `GET /api/v4/system/ping` → `OK`
- Root HTML is this branch's webpack `root.html` (title Mattermost, `/static/main.*.js`)
- `POST /api/v4/users` created `sysadmin` (201); login issued a session token
- `GET /api/v4/users/me/recent_searches` → 200 `{"items":[]}`
- Pre-test `recentsearchqueries` count: **0**

`initSetup()` in the spec created a unique team/user for the browser session.

## 10.2 Spec execution

```text
npx playwright test specs/functional/channels/search/recent_searches.spec.ts --project=chrome --no-deps --reporter=list
```

**Result:** `1 passed (8.2s)` — list, rerun, clear, persist after reload.

Spec/helper adjustments needed to run on this host:

- `from:me` in the first draft triggered the `from:` suggestion; Enter applied the suggestion instead of searching. Terms were changed to `hello e2e recent` / `persist after reload`.
- `GlobalHeader.openSearch()` now no-ops when `aria-expanded="true"` so a still-open popover is not clicked through the overlay.
- The spec waits for the popover to close after each confirm.

## 10.3 Restoration

```sql
-- leftover after the passing run
userid=8mbqasafofy7dpwaycqmkkwcwo  terms='persist after reload'  searchtype=messages
DELETE FROM recentsearchqueries;  -- 1 row
```

Post-restore count: **0**. Course Postgres was not used.

## Outcome

- Step 10 status: **PASS**
- Blocking issues: none for this group
