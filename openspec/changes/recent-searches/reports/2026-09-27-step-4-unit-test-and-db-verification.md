# Step 4 Report - Unit Tests and Database Verification

- Date: 2026-09-27
- Change: recent-searches
- Agent: Cursor Auto (Windows host)

## Environment

- Branch: `feature/recent-searches`
- Go: 1.27.0 (`C:\mm\server` via junction to the repo)
- Test Postgres: Docker `mm-test-postgres` (`postgres:18`) on host port **5436**
- Test Redis: Docker `mm-test-redis` (`redis:7.4.0`) on host port **6379**
- DSN: `TEST_DATABASE_POSTGRESQL_DSN=postgres://mmuser:mostest_password@127.0.0.1:5436/mattermost_test?sslmode=disable&connect_timeout=10`
- Course stack at `http://localhost:8065` is official `mattermost/docker` enterprise **11.7.0**. It was **not** used as the test database. Migration `000233` is **not** present there.

Windows testlib note: `os.Symlink` needs Developer Mode. `server/channels/testlib/resources.go` falls back to `mklink /J` and uses `filepath.Dir` so nested destinations such as `channels/app/plugin_api_tests` get a parent directory first.

## Commands Executed

```text
# 4.1 / 4.4 course DB (mattermost-docker-postgres-1)
docker exec mattermost-docker-postgres-1 psql -U mmuser -d mattermost -c "SELECT COUNT(*) FROM recentsearches;"
docker exec mattermost-docker-postgres-1 psql -U mmuser -d mattermost -c "SELECT COUNT(*) FROM recentsearchqueries;"

# 4.1 / 4.4 test cluster
docker exec mm-test-postgres psql -U mmuser -d postgres -c "\l"
docker exec mm-test-postgres psql -U mmuser -d mattermost_test -c "\dt *recent*"

# 4.2 targeted
cd C:\mm\server\public && go test ./model -run RecentSearch -count=1
cd C:\mm\server && go test ./channels/store/sqlstore -run RecentSearch -count=1
cd C:\mm\server && go test ./channels/app -run RecentSearch -count=1
cd C:\mm\server && go test ./channels/api4 -run RecentSearchesAPI -count=1

# 4.3 broader subset (store layers + websocket constant; not the full server suite)
cd C:\mm\server && go test ./channels/store/retrylayer -count=1
cd C:\mm\server\public && go test ./model -run Websocket -count=1
```

## Unit Test Results

- Targeted tests: **4 packages passed, 0 failed**
  - `./public/model -run RecentSearch` — ok, 0.207s
  - `./channels/store/sqlstore -run RecentSearch` — ok, 2.242s (covers storetest upsert, retain-5, trim, owner-scoped delete)
  - `./channels/app -run RecentSearch` — ok, 11.417s
  - `./channels/api4 -run RecentSearchesAPI` — ok, 7.040s (after Redis on :6379)
- Broader subset: **2 packages passed, 0 failed**
  - `./channels/store/retrylayer` — ok, 0.597s (RecentSearch mock on Store)
  - `./public/model -run Websocket` — ok, 0.207s
- Full server suite: **not run** (justified: same touched packages + related store/websocket; `openspec/config.yaml` allows a scoped `go test`)
- Runtime: ~22s for the confirmation + subset pass; app+api4 ~18s in the earlier successful run
- Notes: first api4 attempt failed with `dial tcp [::1]:6379` until `mm-test-redis` was started. Course DB was never the test target.

## Database State Verification

- Pre-test baseline:
  - Course `recentsearches`: **0**
  - Course `recentsearchqueries`: **relation does not exist** (official 11.7.0 image, no `000233`)
  - Test `mattermost_test` recent tables: **none** (storetest creates ephemeral databases and drops them)
  - Extra databases on test cluster: **none** besides `postgres` / templates / `mattermost_test`
- Post-test validation:
  - Course `recentsearches`: **0** (unchanged)
  - Course `recentsearchqueries`: **still missing** (unchanged)
  - Test `mattermost_test` recent tables: **none**
  - Extra databases on test cluster: **none**
- State restored: **No restoration needed**
- Restoration actions: none

## Outcome

- Step 4 status: **PASS**
- Blocking issues: none for this group
- Next group (not part of this report): Group 5 curl must hit **this branch**, not official `localhost:8065` (that image lacks `000233` and the Recent Search API)
