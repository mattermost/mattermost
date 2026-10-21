# Step 5 Report - Manual curl API verification

- Date: 2026-09-27
- Change: recent-searches
- Agent: Cursor Auto (Windows host)

## Environment

Official `mattermost/docker` enterprise **11.7.0** on `:8065` does **not** include migration `000233` or these routes. For this group the official app container was paused and **this branch** (`feature/recent-searches`, server **12.0.0**) was started instead:

- Config: `%TEMP%\mm-rs-config.json` (not in the repo)
- Postgres: Docker `mm-test-postgres` on host **5436**, database `mattermost_curl`
- DSN: `postgres://mmuser:mostest_password@127.0.0.1:5436/mattermost_curl?sslmode=disable&connect_timeout=10`
- After the curls, `recentsearchqueries` was emptied, the source process on `:8065` was stopped, and `mattermost-docker-mattermost-1` was started again.

Users created on the dedicated DB (not the course DB):

- `rs1` (`efghqfdyh3fimmn8g6f3irq8qw`) system_admin — session token obtained via `POST /api/v4/users/login`
- `rs2` (`4gmrhc5q3bbzjmfhyjmi64rhgo`) system_user

Pre-curl baseline on `mattermost_curl`: `recentsearchqueries = 0`, `recentsearches = 0`.

## Commands and results

All requests used `curl.exe` against `http://localhost:8065` with `Authorization: Bearer <rs1-or-rs2-token>`.

### 5.2 GET empty list

```http
GET /api/v4/users/me/recent_searches
HTTP/1.1 200 OK
{"items":[]}
```

### 5.3 POST messages search then GET

```http
POST /api/v4/users/me/recent_searches
{"terms":"hello from:me","search_type":"messages","team_id":""}
HTTP/1.1 200 OK
{"id":"w8qm4a7dr3yhmf8cdqfzw7krmy","user_id":"efghqfdyh3fimmn8g6f3irq8qw","terms":"hello from:me","search_type":"messages","create_at":1790548102537,"update_at":1790548102537}

GET /api/v4/users/me/recent_searches
HTTP/1.1 200 OK
{"items":[{"id":"w8qm4a7dr3yhmf8cdqfzw7krmy",...,"terms":"hello from:me"}]}
```

DB after POST: 1 row, same id first in the list.

### 5.4 Repeat same key

```http
POST /api/v4/users/me/recent_searches
{"terms":"hello from:me","search_type":"messages","team_id":""}
HTTP/1.1 200 OK
{"id":"w8qm4a7dr3yhmf8cdqfzw7krmy","create_at":1790548102537,"update_at":1790548102831}
```

Same id, `update_at` advanced, still **1** row in `recentsearchqueries`.

### 5.5 Six distinct → retain five

Posted five more distinct terms (`query 1 extra` … `query 5 extra`) after the hello entry (six distinct keys total).

```http
GET /api/v4/users/me/recent_searches
HTTP/1.1 200 OK
{"items":[ query 5, query 4, query 3, query 2, query 1 ]}
```

DB count **5**. Oldest `hello from:me` was pruned.

### 5.6 DELETE owner / fake / foreign

```http
DELETE /api/v4/users/me/recent_searches/djtt5tdjq7ftxyb9wgawmwnn1e
HTTP/1.1 200 OK
{"status":"OK"}

GET /api/v4/users/me/recent_searches
HTTP/1.1 200 OK
{"items":[ query 4, query 3, query 2, query 1 ]}

DELETE /api/v4/users/me/recent_searches/xxxxxxxxxxxxxxxxxxxxxxxxxx
HTTP/1.1 404 Not Found

# rs2 saved {"terms":"user2 only","search_type":"files"} id=unpbkd75j7gytgcxgnn1jimkzr
DELETE /api/v4/users/me/recent_searches/unpbkd75j7gytgcxgnn1jimkzr   (as rs1)
HTTP/1.1 404 Not Found
```

Foreign id is indistinguishable from missing (404). rs2's row remained.

### 5.7 Other user 403 and invalid type 400

```http
GET /api/v4/users/4gmrhc5q3bbzjmfhyjmi64rhgo/recent_searches
HTTP/1.1 403 Forbidden

POST /api/v4/users/4gmrhc5q3bbzjmfhyjmi64rhgo/recent_searches
HTTP/1.1 403 Forbidden

POST /api/v4/users/me/recent_searches
{"terms":"hello","search_type":"channels","team_id":""}
HTTP/1.1 400 Bad Request
{"id":"model.recent_search.is_valid.search_type.app_error",...,"status_code":400}
```

Invalid type was not persisted.

## Database restoration

```sql
DELETE FROM recentsearchqueries;  -- 5 rows
```

Post-restore: `recentsearchqueries = 0`, `recentsearches = 0` (matches pre-curl baseline). Dedicated users/teams were left in `mattermost_curl` only; the course Postgres was not used.

## Outcome

- Step 5 status: **PASS**
- Blocking issues: none
- Note: `team_id` is stored as `CHAR(26)` so an empty team comes back as 26 spaces in JSON. Behavior matches uniqueness on `(userid, terms, searchtype, teamid)`.
