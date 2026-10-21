# Proposal

## Why

Users cannot recover a search they just ran. Issue #15976 (MM-28251) asks for up to five recent message/file searches under the search options so people can rerun or clear them. The unused `recentsearches` table is not a product feature and must not be reused.

This change implements the course plan in `user_stories.md` / `user_stories.enhanced.md` (TT-01, HU-01–HU-06).

## What Changes

- Persist each confirmed `messages`/`files` search for the current user (HU-01).
- Show up to five recent entries in the search popover, below hints (HU-02).
- Selecting an entry reruns that search with original terms, type, and team (HU-03).
- A Clear control removes one entry (HU-04).
- History stays consistent across the user's sessions via WebSocket and refetch on reconnect (HU-05).
- Keyboard and screen-reader access for list, rerun, and clear (HU-06).
- New PostgreSQL table `recentsearchqueries` via migration `000233_*`. Do not edit `000084_recent_searches`.

## Non-goals

- Plugin search types (keep current behavior; do not store them).
- Editing a saved query, admin/global history, or migrating rows from unused `recentsearches`.
- Changing the existing search engine or result ranking.

## Capabilities

### New Capabilities

- `recent-searches`: Server-owned history — model, store, API, authorization, retention of five, deduplication, and user-scoped WebSocket updates.
- `search-box-recent-history`: Search popover UI — load, display, rerun, delete, empty/error behavior, and accessibility.

### Modified Capabilities

- None. No existing `openspec/specs/` capabilities.

## Impact

- **Server:** `model`, `store`/`sqlstore`, `app`, `api4`, Postgres migration 000233, WebSocket event `recent_search_updated`.
- **Webapp:** Client4, Redux, `new_search.tsx` / `search_box.tsx`, new `recent_searches` component, i18n, Playwright search box helpers.
- **API:** `POST/GET /api/v4/users/{user_id}/recent_searches`, `DELETE .../recent_searches/{search_id}`.
- **Ops:** Docker Mattermost at `http://localhost:8065` for manual API checks.
