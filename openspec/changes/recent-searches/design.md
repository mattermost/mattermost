# Design

## Context

See proposal.md for motivation. Search already runs through `new_search.tsx` → `runSearch` → Redux `showSearchResults`. There is no product history today. Migration `000084_recent_searches` created unused table `recentsearches` (`userid`, `searchpointer`, `query jsonb`) marked to be dropped; its schema cannot express typed terms/team/recency.

Constraints: follow existing App → Store → SQL and Client4 → Redux layers (`server/AGENTS.md`, `webapp/AGENTS.md`). Do not edit shipped migrations. Latest Postgres sequence is `000232`; add `000233_create_recent_search_queries`. Course stack is reachable at `http://localhost:8065`.

## Goals / Non-Goals

**Goals:**

- Server is source of truth for persist, dedup, retain-5, timestamps, and auth.
- Client writes only from `runSearch` for `messages`/`files`, and renders history under hints.
- User-scoped WebSocket plus GET-on-reconnect keep sessions aligned.

**Non-Goals:**

- Preference-store persistence, plugin history, or a new search engine.
- Changing `000084_recent_searches` or copying its jsonb rows.

## Decisions

### 1. New table `recentsearchqueries`, not `recentsearches`

- **Why:** Unused table has a different PK and jsonb `query`. Mattermost forbids editing shipped migrations.
- **Rejected:** Reuse/alter `recentsearches` (incompatible, scheduled drop). Preferences (harder retention, no first-class API, weaker concurrency).

Schema (additive create only):

- `id` CHAR(26) PK
- `userid` CHAR(26) NOT NULL
- `terms` TEXT NOT NULL
- `searchtype` VARCHAR(16) NOT NULL
- `teamid` CHAR(26) NOT NULL DEFAULT ''
- `createat` BIGINT NOT NULL
- `updateat` BIGINT NOT NULL
- Unique `(userid, terms, searchtype, teamid)`
- Index `(userid, updateat DESC)`

### 2. Dedicated `RecentSearchStore` on the Store interface

- **Why:** Matches other first-class entities; `make store-mocks` / `make store-layers` keep layers honest.
- **Rejected:** Logic only in App with raw SQL (skips store tests and layers).

Store methods: `Save` (upsert + prune in one transaction), `GetByUser(userID, limit)`, `Delete(userID, id)`.

### 3. REST on `BaseRoutes.User`

- `POST /api/v4/users/{user_id}/recent_searches`
- `GET /api/v4/users/{user_id}/recent_searches` → `{items: [...]}`
- `DELETE /api/v4/users/{user_id}/recent_searches/{search_id}`

`user_id` must be session user or `me`. Session required. No admin override to read another user's history.

- **Why:** Same pattern as preferences and other per-user resources.
- **Rejected:** Team-scoped routes (history is per user, team is only a field).

### 4. Write hook in `runSearch`, fire-and-forget

- **Why:** One confirm can hit messages and files internally; hooking `runSearch` once avoids double insert. Results must not wait on history.
- **Rejected:** Persist from every search API call (false positives from paging/internal fetches).

### 5. User-scoped WebSocket `recent_search_updated`

Use `model.NewWebSocketEvent(..., userId)` so only that user's connections receive it. Payload: `action` plus `item` or `id`. Client handler updates Redux; on reconnect, GET.

- **Why:** Matches other per-user events; avoids polling.
- **Rejected:** Broadcast to team (leaks queries). Client-only localStorage (fails HU-05).

### 6. UI component under hints

New `recent_searches.tsx` mounted in `search_box.tsx` after `SearchBoxHints`. Integrante 3 owns `new_search.tsx` / `search_box.tsx` to limit merge conflicts. Use `WithTooltip` and `react-intl`. Missing team: toast, no silent team switch.

## Risks / Trade-offs

- **[Risk] Unique key on raw `terms` can collide on whitespace variants** → Trim on write; do not normalize operators.
- **[Risk] Concurrent POSTs exceed five briefly** → Single transaction: upsert then delete overflow by `updateat`.
- **[Risk] Terms are sensitive** → Auth + 404-for-foreign-delete; debug logs without terms.
- **[Risk] Migration number 000233 races upstream** → Re-check latest `postgres/*.up.sql` before apply; run `make migrations-extract`.
- **[Trade-off] Store limit equals display limit (5)** → Simpler than store-N/show-5; change later only if product asks.

## Migration Plan

1. Ship additive `000233` create table + indexes. Down: drop `recentsearchqueries` only.
2. Deploy server before relying on UI writes (old clients ignore new APIs).
3. Rollback: revert app/api; table can remain empty. Do not drop `recentsearches`.
4. Verify on empty DB and on a DB that already has unused `recentsearches`.

## Open Questions

- Precise `react-intl` message ids (choose at implementation; behavior is specified).
- Whether Playwright lives in `e2e-tests/playwright/specs/functional` vs extending `search_box.ts` only — either satisfies HU-06 if the four flows are covered.
