# Goroutine Leak Profiling Investigation (MM-70631)

**Toolchain**: `go1.27.3` (`go version` from `server/`). All commands below were run in this checkout, from `server/`, with Postgres and Redis running. The enterprise checkout was only read, not built or run (see "Scope of this investigation").

## 1. Does the API exist in 1.27.3, and does it need a `GOEXPERIMENT`?

It exists, it is registered by default, and it needs no experiment.

- `go doc -all runtime/pprof` lists it in the built-in profile table: `goroutineleak  - stack traces of all leaked goroutines`.
- In the toolchain source (`$GOROOT/src/runtime/pprof/pprof.go:193-196, 265`), `goroutineLeakProfile` is created unconditionally and put in the initial `profiles.m` map next to `goroutine` and `heap`. `pprof.Lookup("goroutineleak")` therefore returns a non-nil `*Profile`.
- `grep -rn -i goroutineleak $GOROOT/src/internal/goexperiment` prints nothing, so there is no experiment flag for it. `net/http/pprof` also knows the name (`$GOROOT/src/net/http/pprof/pprof.go:356, 374`).
- `grep -rn GOEXPERIMENT` over every `Makefile`, `*.mk`, `*.yml`/`*.yaml`, `Dockerfile*` and `*.sh` in the repo prints nothing, and `go env GOEXPERIMENT GOFLAGS` is empty. Nothing sets one.
- I could not read the Go 1.27 release notes: the downloaded toolchain in the module cache has no `doc/` directory, and `go doc` does not cover release notes. The behavior above comes from the source of the installed toolchain.

How it works (`pprof.go:784-807`): `writeGoroutineLeak` takes a package-wide lock, runs a full GC cycle with leak detection (`runtime_goroutineLeakGC`), then writes only the goroutines marked "leaked". `debug=2` instead dumps all goroutines, with leaked ones marked `[select (leaked)]` and including `created by` lines, which is what I used to attribute leaks.

What it detects: a goroutine blocked on a channel, `sync.Mutex`/`WaitGroup`/`Cond` or `select` that is **unreachable from any runnable goroutine or global**. It does not detect goroutines blocked on something that is still reachable (a package-level channel, a long-lived struct that is itself still referenced), and it does not detect goroutines blocked in syscalls, `time.Sleep`, or I/O. So it has no false positives for the leaked set, but it under-reports.

## 2. Is `/debug/pprof/goroutineleak` served by the metrics server? (finding the ticket did not expect)

No. The ticket assumes it works "when `net/http/pprof` is imported". `server/channels/app/platform/metrics.go` does not use `http.DefaultServeMux`. It registers `pprof.Index`, `cmdline`, `profile`, `symbol` and `trace` on a gorilla router, then one `pprof.Handler("<name>")` per profile by hand (`metrics.go:186-191`: goroutine, heap, allocs, threadcreate, block, mutex). `goroutineleak` was missing, even though `pprof.Index` (served at `/debug/pprof/`) lists it, so the index page linked to a 404.

Reproduced before the fix, by adding a row to `TestMetricsRouter`:

```
--- FAIL: TestMetricsRouter (0.00s)
    --- FAIL: TestMetricsRouter/pprof_goroutineleak (0.00s)
        metrics_test.go:84:
            	Error:      	Not equal:
            	            	expected: 200
            	            	actual  : 404
```

The first commit on this branch adds the route and a link on the metrics landing page, plus the test row. After it, `TestMetricsRouter/pprof_goroutineleak` passes.

When the endpoint is reachable: only when `MetricsSettings.Enable` is true (default `false`, `public/model/config.go:1297`) and then only on `MetricsSettings.ListenAddress` (default `:8067`, `config.go:1293`), a separate listener from the main API port. It is not behind Mattermost auth. Like the other pprof endpoints, it must be kept off the public network. Details of the production cost are in section 6.

## 3. Test-time: where would a leak check go?

One insertion point covers almost everything. `testlib.MainHelper.Main` (`server/channels/testlib/helper.go`) ends with `h.status = m.Run()`, and `Close()` then calls `os.Exit(h.status)`.

Inventory (commands run):

```
$ grep -rl "func TestMain(" --include=*_test.go .     # in server/
22 files
$ grep -rL testlib $(grep -rl "func TestMain(" --include=*_test.go .)
channels/jobs/health_check/worker_test.go
public/pluginapi/testhelper/main_test.go

$ grep -rl "func TestMain(" --include=*_test.go .     # in ../enterprise, read-only
16 files
$ grep -rL testlib $(grep -rl "func TestMain(" --include=*_test.go .)
(nothing: all 16 enterprise TestMain functions use testlib)
```

(An earlier pattern, `func TestMain`, also matched `TestMaintainUnreadRepliesInThread` in `channels/api4/user_test.go`. Use `func TestMain(`.)

The two exceptions in `server/`:

- `channels/jobs/health_check/worker_test.go:24`: sets `jobs.DefaultWatcherPollingInterval = 50` and calls `os.Exit(m.Run())`. It would need its own call to a leak check, or to be moved to `testlib`.
- `server/public/pluginapi/testhelper/main_test.go:22`: builds a test plugin, runs, removes the directory, exits. It is in the `server/public` module, which cannot import `server/v8/channels/testlib`, so a shared hook there would need its own copy.

Packages with no `TestMain` at all are not covered by a `testlib` hook either.

## 4. Prototype

`server/channels/testlib/goroutineleak.go` adds `reportGoroutineLeaks()`, called right after `m.Run()` in `Main`. It is off unless `MM_TEST_GOROUTINE_LEAK` is set:

- `report`: write the leak profile (`debug=1`, grouped by stack) to stderr and print `GOROUTINE LEAK REPORT: N leaked goroutine(s)`.
- `fail`: same, and turn a passing run (`status == 0`) into a failing one (`status = 1`) when `N > 0`.
- unset: nothing changes. No package changes behavior in this PR.

It runs before `Close()`, so goroutines owned by the shared `MainHelper` store are still reachable and are not reported.

## 5. Evidence on `channels/app/platform`

Test binary built with `go test -c ./channels/app/platform`, run from the package directory, `-test.count=1`, full package, Postgres running.

**Time.** Alternating runs of the same binary, with and without the variable:

```
off    34.06s   PASS
report 35.58s   535 leaked goroutines
off    34.71s   PASS
report 34.56s   535 leaked goroutines
off    34.28s   PASS
report 37.82s   535 leaked goroutines
off    36.19s   PASS
report 45.02s   535 leaked goroutines   (overlapped with a concurrent go build/vet in this session: discard)
```

Excluding the contaminated last run, the overhead is at most a few seconds out of 34 and is not separable from run-to-run noise (the four "off" runs span 2.1 s, the three clean "report" runs 3.3 s; means 34.8 s and 36.0 s). One extra GC plus a profile write at process exit is cheap.

**Count.** Deterministic: 535 leaked goroutines in each run.

**What they are.** All 535 belong to three stacks, all in logging:

| Count | Top frame | Created by |
|------:|-----------|-----------|
| 250 | `logr/v2.(*TargetHost).start` (`target.go:269`) | `logr.newTargetHost` (`target.go:94`) |
| 159 | `lumberjack.v2.(*Logger).millRun` (`lumberjack.go:379`) | `(*Logger).mill.func1` (`lumberjack.go:390`) |
| 126 | `logr/v2.(*Logr).start` (`logr.go:436`) | `logr.New` (`logr.go:76`) |

**Root cause 1 (Mattermost code, 369 of 535).** `PlatformService` creates its application logger in `initLogging` (`channels/app/platform/log.go:44`, `mlog.NewLogger`) and nothing ever calls `Shutdown` on it: `PlatformService.Shutdown` (`service.go:613-660`) and `ShutdownConfig` (`service.go:548`) do not touch `ps.logger`, and a repo-wide search for non-test `Shutdown()` calls on a platform logger finds none (only `channels/audit/audit.go:90`, `cmd/mattermost/commands/db*.go` and `mlog.go:78` shut loggers down). Every `TestHelper` in the package therefore leaves one logr instance, its target hosts and its lumberjack mill behind.

To confirm, I temporarily added `th.Service.Log().(*mlog.Logger).Shutdown()` to `TestHelper.Shutdown` in `channels/app/platform/helper_test.go` (reverted, not in this PR) and re-ran the full package:

```
GOROUTINE LEAK REPORT: 166 leaked goroutine(s)     (was 535)
TestIsLeader                       15 -> 6
TestServerSyncSharedChannelHandler 33 -> 9
```

The remaining 166 are 159 `lumberjack.millRun`, 5 `logr.(*Logr).start` and 2 `TargetHost.start`.

In production the leaked goroutines die with the process, so this mostly costs test hygiene. Whether `Server.Shutdown` or `PlatformService.Shutdown` should shut the logger down (for example to flush queued records) is a design question for the owners, so I did not change it.

**Root cause 2 (third-party, 159).** `gopkg.in/natefinch/lumberjack.v2@v2.2.1` starts `millRun` on the first rotation check and `Close()` (`lumberjack.go:165-177`) never closes `millCh`, so `for range l.millCh` (`lumberjack.go:377-381`) never ends. This is a known upstream bug in the pinned version. In production, it means each file log target that is created and later removed on a config reload (`ConfigureLogger` re-adds targets when logging settings change) leaves one goroutine behind. This is bounded by the number of reloads, but unbounded in a long-running process that gets many logging config changes. I did not measure this on a live server.

**False positives.** None observed. Each of the 535 was a goroutine whose owner (a logger that no one shut down) was gone, so the report was correct each time. The detector's weakness is the opposite one: false negatives. It cannot see a goroutine that is blocked on a channel that is still reachable from a global or from a live object, for example anything owned by a service still referenced from `TestMain` state. Other goroutines the platform tests start (hub, status processor) did not show up, which means either they are shut down correctly or they are still reachable.

**Per-test attribution is cheap.** Running each of the 156 tests of the package in its own process took 20.7 seconds of wall time with 6 in parallel, and gave a per-test count (the highest: `TestServerSyncSharedChannelHandler` 33, `TestRunSearchEngineWatcher` 18, `TestCollectHealthNodes` 17). That is a quick way to find which test leaks.

## 6. When to use this in production

- **As a diagnostic, yes.** `GET /debug/pprof/goroutineleak?debug=1` on the metrics listener (after the route in this PR) lists leaked goroutines, grouped by stack, and it does so more precisely than diffing two `goroutine` profiles. Use it when the `go_goroutines` metric climbs steadily, as the first thing to check. `debug=2` returns all goroutines with leaked ones marked.
- **Cost.** Every request forces a full GC cycle with leak detection and takes a global lock (`goroutineLeakProfileLock`), so concurrent requests serialize. On a large heap that is a noticeable pause. Do not scrape it on a schedule and do not put it in a liveness probe. Call it by hand or from a support-packet style one-shot.
- **Exposure.** The metrics listener is off by default (`MetricsSettings.Enable=false`) and unauthenticated, so the same network rules as the other `/debug/pprof` endpoints apply. The profile includes function names and file paths of the server only, no request data.
- **Do not alert on it.** A non-zero count is a bug report, not an outage signal. It also misses leaks that are still reachable.

## 7. Recommendation

1. **Merge the route** (first commit). It fixes a dead link on the index page and is the only production change in this PR.
2. **Do not enable the check repo-wide yet.** Enable it as opt-in, via `MM_TEST_GOROUTINE_LEAK=report`, so authors can find leaks locally and in an optional CI job. The prototype is small enough to keep as is. It costs nothing when unset.
3. **Do not use `fail` mode until the two sources above are dealt with**: otherwise every package that builds a `PlatformService` would fail on the first run. Fixing root cause 1 (shut the app logger down in `TestHelper.Shutdown`, and decide whether `PlatformService.Shutdown` should do it) removed 369 of the 535 findings (69 percent) in the one package measured. Root cause 2 needs either a lumberjack upgrade or replacement, or an allowlist that ignores goroutines whose top frame is `lumberjack.(*Logger).millRun`. Because the profile is text, an allowlist is a small filter over `debug=1` output.
4. **Follow-up order**: fix the logger shutdown in `testlib` helpers, add the lumberjack filter, then try `fail` mode on one fast package at a time, starting with `channels/app/platform`, then `channels/jobs`.
5. **Hold the two non-`testlib` `TestMain` functions** (`channels/jobs/health_check/worker_test.go`, `public/pluginapi/testhelper/main_test.go`) out of any rollout until someone decides whether to move them to `testlib`.

## Scope of this investigation

- Prototyped only in `server/`, on `channels/app/platform`. The enterprise checkout is not in this worktree's `go.work`, so no enterprise package was built, run or changed. I read it for the `TestMain` inventory in section 3 only, so enterprise prototyping was not done and no enterprise PR is needed.
- The number of leaks in other server packages, and in enterprise, is unmeasured.
- Production claims about config-reload leaks (root cause 2) come from reading the pinned dependency source, not from a live run.
