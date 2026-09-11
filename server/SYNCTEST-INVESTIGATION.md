# `testing/synctest` Adoption Investigation (MM-70630)

**Go version**: stable since 1.25 (already available in the installed 1.26.7 toolchain — no toolchain bump needed).

## Inventory

`grep -rln 'time\.Sleep' --include=*_test.go .` found 73 test files using `time.Sleep`. Most fall into one of three buckets:

1. **Integration/API tests** (`channels/api4/*_test.go`, `channels/app/*_test.go`) — sleeps waiting on a full `TestHelper` stack (real Postgres store, real HTTP server, websocket hub, plugin sandbox). These spin goroutines and connections that exist *outside* any bubble the test could create, so `synctest` cannot see them. Not viable without a much larger test-infrastructure rewrite (fake network, fake store).
2. **Enterprise search client tests** (`enterprise/elasticsearch/**/bulk_client_req_test.go`, `bulk_test.go`) — sleeps forcing a periodic flusher to contend for a mutex, built around a real `httptest.Server`. `synctest`'s own docs list "avoid using the network" as a hard guideline; the goroutines handling `net/http` requests are not created within the bubble. Not a good fit as written.
3. **Pure in-process unit tests** with lazy time-based expiry or a single background goroutine and bubble-local channels — the good-fit category, covered below.

## Converted examples

### 1. `platform/services/cache/lru_test.go` — `TestLRUExpire`
Cache expiry is checked lazily via `time.Now().After(e.expires)` on `Get` (`lru.go:222`), with no background goroutine. Wrapped the whole test in `synctest.Test`; the `time.Sleep(time.Second * 2)` now advances the bubble's fake clock instantly instead of blocking wall-clock time.

### 2. `platform/services/cache/provider_test.go` — `TestNewCache` / `TestNewCache_Striped`, "with all options specified" subtests
Same lazy-expiry pattern, exercised through the `Provider` wrapper. Wrapped each subtest in `synctest.Test`, replacing two `time.Sleep(expiry + 1*time.Second)` calls (1s+1s wall time each) with the same call now running on the fake clock.

**Result for both cache examples**: `go test -run 'TestLRUExpire|TestNewCache' -count=20 -v ./platform/services/cache` — 20 iterations of all three tests, previously ~4s of real sleep *each* (80s+ total), now completes in **0.013s** total elapsed test time, deterministically, every run.

### 3. `channels/jobs/server_test.go` — `TestStartWorkers` (`already running`, `not running`) and `TestStopWorkers` (`running`)
Each subtest builds a fresh `*JobServer` via `makeJobServer(t)` and calls `jobServer.initWorkers()` itself, so the `Watcher`'s `stop`/`stopped` channels (`jobs_watcher.go:30-31`) are created *inside* the subtest — and therefore inside the bubble once wrapped in `synctest.Test`. `StartWorkers()` spawns the watcher goroutine, which does an initial random-jitter delay via `<-time.After(...)` before its polling loop; that's a bubble timer, so it durably blocks. Replaced the `time.Sleep(1 * time.Millisecond)` "parking" comment/call (there to let the watcher goroutine actually get scheduled before `StopWorkers()` races it) with `synctest.Wait()`, which blocks until the watcher goroutine reaches that durably-blocked state — removing a race against the scheduler entirely, not just the sleep.

**Result**: `go test -run 'TestStartWorkers$|TestStopWorkers$' -count=5 -v ./channels/jobs` passes deterministically in ~0.4s (previously relied on a 1ms sleep being "probably enough" — a latent flakiness source under load, now structurally impossible to race).

Full `go build ./...`, `go vet ./...`, and the complete `channels/jobs` and `platform/services/cache` package test suites (including the DB-backed tests, run against a local Postgres) pass with these changes.

## Attempted and reverted: `channels/jobs/schedulers_test.go` — `TestScheduler`

`TestScheduler`'s six subtests share one `*JobServer` created once at the top of the parent test, with `jobServer.initSchedulers()` called *before* any subtest (and thus before any bubble exists). `initSchedulers()` creates the `Schedulers.configChanged` and `Schedulers.clusterLeaderChanged` channels (`server.go:49-50`). When the "Base" subtest's body was wrapped in `synctest.Test` and its `time.Sleep(2 * time.Second)` replaced with `synctest.Wait()`, the scheduler's background goroutine (`schedulers.go:70-97`) sits in a `select` with cases on `stop`/`timer.C` (bubble-local, created inside `Start()`) **and** `configChanged`/`clusterLeaderChanged` (created outside any bubble). Per the `synctest` docs, a `select` only durably blocks when *every* case is a bubble-local channel — this one isn't, so `synctest.Wait()` hung until the test framework's deadline killed it (confirmed via goroutine dump: the select shows `[select, ...]` without the `(durable)` marker that the truly-blocked goroutines have).

This is a real adoption-cost data point: converting `TestScheduler` would require restructuring `initSchedulers()`/`Schedulers` construction so the channels are created per-subtest inside the bubble (e.g., calling `initSchedulers()` fresh in each `t.Run`, as `TestStartWorkers`/`TestStopWorkers` already do for workers) — a larger, riskier change than this ticket's scope, since the six subtests currently rely on sharing scheduler state across `t.Run` calls. Reverted this attempt; left `schedulers_test.go` untouched.

## Adoption cost assessment

- **Easy wins** (no production code changes needed): any test where the code under test only touches `time.Now`/`time.Sleep`/`time.After`/`time.NewTimer`/`time.NewTicker` directly, and where all relevant goroutines and channels are created from within the test body itself (not shared fixtures created before/outside the test). The `cache` package and the `jobs` package's per-subtest-fresh-server tests (`server_test.go`) both qualify already — zero production code changes were needed for either conversion above.
- **Structural blocker, not a code blocker**: tests that share long-lived fixtures across `t.Run` subtests (like `TestScheduler`) need their channel/goroutine setup moved inside each subtest before `synctest` can help — this is a test-structure change, not a synctest limitation per se, but it's extra work per test file and carries regression risk if the shared-state pattern is intentional (e.g., testing cross-subtest state transitions).
- **Not adoptable as-is**: anything going through real network I/O (`httptest.Server`, real Postgres/Redis, websockets) or the full `TestHelper` integration stack. These would need fake transports/clocks injected into production code to route through `time` package calls the bubble can see — out of scope here per the ticket's own P4 note that a broader `time` abstraction rework isn't warranted.

## Recommendation

**Adopt selectively, not broadly.** `testing/synctest` is a clear win for self-contained, single-goroutine-or-simple-background-goroutine unit tests that use `time.Sleep`/`time.After` as a synchronization proxy — convert opportunistically wherever such a test is touched next (the `cache` and `jobs` conversions above are already merged as examples). Do **not** attempt a codebase-wide sweep: the majority of the 73 `time.Sleep`-in-tests sites are integration tests built on the shared `TestHelper` (real DB/HTTP/websocket), which are structurally incompatible with `synctest`'s "no network, bubble-only goroutines" model and would need a much larger fake-transport investment to benefit — not worth it for this ticket's scope. Tests with shared cross-subtest fixtures (like `TestScheduler`) are worth revisiting individually if/when someone is already refactoring that file, but converting them purely for `synctest`'s sake isn't justified on its own.
