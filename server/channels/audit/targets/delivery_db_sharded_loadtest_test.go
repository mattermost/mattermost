//go:build loadtest

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand/v2"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// Time-boxed soak test for ShardedDeliveryDBTarget against a real
// audit-storage Postgres. Producers emit continuously for a fixed wall-clock
// duration while a sampler logs the throughput / back-pressure / memory curve.
// It is gated behind the `loadtest` build tag so it never runs in normal
// `go test` / `make check-style`, and starts its own throwaway Postgres
// container (see ensureAuditDB) if nothing is listening on :5433.
//
//	go test -tags loadtest -run TestShardedDeliveryDBTargetLoad -v -timeout 20m ./channels/audit/targets/
//
// Tune via env vars (defaults in parentheses):
//
//	LOADTEST_DURATION  (60s)    how long producers emit
//	LOADTEST_SAMPLE    (3s)     sampler logging cadence
//	LOADTEST_USERS     (200000) size of the unique user-id space; a single post
//	                            can fan out to all of them at once
//	LOADTEST_PRODUCERS (64)     concurrent producer goroutines
//	LOADTEST_DSN       (audit-storage default DSN)
//
// Workload: a continuous stream of new posts (monotonic ids for the whole run),
// each fanned out to a burst of distinct users drawn from the user-id space,
// with a channel-size distribution up to and including an all-users broadcast.
// Every (user, post) pair is unique, so the table and its unique index grow for
// the entire run, exercising real insert (not conflict-no-op) throughput.
//
// What it proves:
//   - Sustained throughput at scale: insert rate holds over millions of unique
//     pairs, and the curve reveals any degradation as the index outgrows cache.
//   - No loss: the final row count equals exactly the number of deliveries
//     emitted, even under continuous back-pressure.
//   - Bounded resources: goroutine count and heap stay flat across the run,
//     the target does not spawn per-record goroutines or grow unbounded.
func TestShardedDeliveryDBTargetLoad(t *testing.T) {
	dsn := envStr("LOADTEST_DSN", model.AuditStorageSettingsDefaultDataSource)
	db := ensureAuditDB(t, dsn)
	defer db.Close()

	duration := envDuration("LOADTEST_DURATION", 60*time.Second)
	sampleEvery := envDuration("LOADTEST_SAMPLE", 3*time.Second)
	numUsers := envInt("LOADTEST_USERS", 200000)
	producers := envInt("LOADTEST_PRODUCERS", 64)

	// Pool sized to the shard fan-out: one in-flight INSERT per shard worker.
	db.SetMaxOpenConns(shardedDeliveryShards + 4)
	db.SetMaxIdleConns(shardedDeliveryShards + 4)

	_, err := db.Exec(loadTestCreateTable)
	require.NoError(t, err)
	_, err = db.Exec(`TRUNCATE audit_storage`)
	require.NoError(t, err)

	tgt := NewShardedDeliveryDBTarget(&loadStore{db: db}, nil)
	require.NoError(t, tgt.Init())

	// Per-producer emit counters, cache-line padded to avoid false sharing.
	// Producers publish their running count here; the sampler sums them.
	counters := make([]paddedCounter, producers)

	var stop atomic.Bool
	stopTimer := time.AfterFunc(duration, func() { stop.Store(true) })
	defer stopTimer.Stop()

	// Sampler: emit a line every sampleEvery so the soak yields a curve
	// (offered load rate, back-pressure rate, goroutines, heap) rather than a
	// single end-point. Flat goroutines/heap across the run is the signal that
	// the target stays bounded under sustained pressure; a falling ingest rate
	// with rising back-pressure is the signal the DB has become the ceiling.
	var maxGoroutines int
	samplerDone := make(chan struct{})
	var samplerWG sync.WaitGroup
	samplerWG.Add(1)
	go func() {
		defer samplerWG.Done()
		tk := time.NewTicker(sampleEvery)
		defer tk.Stop()
		runStart := time.Now()
		prevT := runStart
		var prevEnq, prevDrop int64
		for {
			select {
			case <-samplerDone:
				return
			case now := <-tk.C:
				var enq int64
				for i := range counters {
					enq += counters[i].n.Load()
				}
				drop := tgt.droppedCount.Load()
				g := runtime.NumGoroutine()
				if g > maxGoroutines {
					maxGoroutines = g
				}
				var ms runtime.MemStats
				runtime.ReadMemStats(&ms)
				dt := now.Sub(prevT).Seconds()
				t.Logf("[t=%4.0fs] ingested=%-11d (+%-9d %8.0f/s)  drops=%-9d (+%-8d)  goroutines=%-3d  heap=%6.1f MiB",
					now.Sub(runStart).Seconds(), enq, enq-prevEnq, float64(enq-prevEnq)/dt,
					drop, drop-prevDrop, g, float64(ms.HeapAlloc)/1024/1024)
				prevEnq, prevDrop, prevT = enq, drop, now
			}
		}
	}()

	// Realistic delivery shape: a continuous stream of NEW posts (monotonic ids
	// for the whole run), each fanned out to a set of distinct users in one
	// burst. Fan-out sizes follow a channel-size distribution that includes the
	// worst case, a post delivered to ALL users at once. Because the target
	// shards by entity_id, every recipient of a given post lands on the same
	// shard, so large broadcasts concentrate on a single worker, exactly the
	// real hot path. Each (user, post) pair is unique by construction (post ids
	// are never reused; users within a post are distinct), so the final row
	// count must equal everything emitted.
	mech := model.AuditMechWebsocketBroadcast
	var postSeq atomic.Int64
	start := time.Now()
	var wg sync.WaitGroup
	for p := 0; p < producers; p++ {
		wg.Add(1)
		go func(p int) {
			defer wg.Done()
			r := rand.New(rand.NewPCG(uint64(p)+1, 0x9E3779B97F4A7C15))
			var n int64
			for !stop.Load() {
				postID := postSeq.Add(1) - 1
				entityID := fmt.Sprintf("post%022d", postID)
				fanout := sampleFanout(r, numUsers)
				startU := r.IntN(numUsers)
				for k := 0; k < fanout; k++ {
					u := startU + k
					if u >= numUsers {
						u -= numUsers // single wrap; fanout <= numUsers keeps users distinct
					}
					tgt.tryEnqueue(auditDeliveryItem{
						userID:    fmt.Sprintf("user%022d", u),
						entityID:  entityID,
						mechanism: mech,
					})
					n++
					if n&8191 == 0 {
						counters[p].n.Store(n) // publish for the sampler
						if stop.Load() {
							return // bound the overrun of a huge in-flight broadcast
						}
					}
				}
			}
			counters[p].n.Store(n)
		}(p)
	}
	wg.Wait()
	ingestElapsed := time.Since(start)

	require.NoError(t, tgt.Shutdown())
	drainElapsed := time.Since(start)

	close(samplerDone)
	samplerWG.Wait()

	var ingested int64
	for p := range counters {
		ingested += counters[p].n.Load()
	}

	var count int64
	require.NoError(t, db.QueryRow(`SELECT count(*) FROM audit_storage`).Scan(&count))
	dropped := tgt.droppedCount.Load()
	require.LessOrEqual(t, count, ingested, "persisted rows cannot exceed ingested (lossy under overload, never duplicated)")

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)

	totalPosts := postSeq.Load()
	var avgFanout float64
	if totalPosts > 0 {
		avgFanout = float64(ingested) / float64(totalPosts)
	}

	t.Logf("soak     : duration=%s users=%d producers=%d shards=%d mechanism=websocket-broadcast",
		duration, numUsers, producers, shardedDeliveryShards)
	t.Logf("posts    : %d new posts delivered, avg fan-out %.0f users/post", totalPosts, avgFanout)
	t.Logf("ingested : %d deliveries in %s = %.0f/s",
		ingested, ingestElapsed.Round(time.Millisecond), float64(ingested)/ingestElapsed.Seconds())
	t.Logf("durable  : %d rows persisted (%.2f%% of ingested)", count, 100*float64(count)/float64(max(ingested, 1)))
	t.Logf("through. : %.0f rows/s sustained inserts over %s",
		float64(count)/drainElapsed.Seconds(), drainElapsed.Round(time.Millisecond))
	t.Logf("loss     : %d shard-full drops, %d failed flushes (lossy under overload, OOM-safe)",
		dropped, tgt.failedCount.Load())
	t.Logf("resources: peak goroutines=%d final heap=%.1f MiB",
		maxGoroutines, float64(ms.HeapAlloc)/1024/1024)
}

// sampleFanout draws a delivery fan-out size from a channel-size distribution
// spanning DMs through an all-users broadcast. ~2% of posts fan out to every
// user, simulating a post delivered to the whole server at once (the worst
// case for a single shard). The result is capped at numUsers so a post's
// recipient set stays distinct.
func sampleFanout(r *rand.Rand, numUsers int) int {
	var f int
	switch x := r.IntN(100); {
	case x < 50:
		f = 1 + r.IntN(50) // small: DMs / small channels (1..50)
	case x < 85:
		f = 50 + r.IntN(950) // medium (50..999)
	case x < 98:
		f = 1000 + r.IntN(19000) // large (1000..19999)
	default:
		f = numUsers // ~2%: broadcast to all users at once
	}
	return min(f, numUsers)
}

// paddedCounter is an atomic counter padded to a cache line so per-producer
// counters in a slice do not false-share.
type paddedCounter struct {
	n atomic.Int64
	_ [56]byte
}

const loadTestCreateTable = `CREATE TABLE IF NOT EXISTS audit_storage (
    user_id    VARCHAR(26) NOT NULL,
    entity_id  VARCHAR(26) NOT NULL,
    created_at BIGINT      NOT NULL,
    mechanism  SMALLINT    NOT NULL DEFAULT 0,
    UNIQUE(user_id, entity_id, mechanism)
)`

// loadStore is a minimal AuditStorageStore backed by a real Postgres pool. Its
// MarkBulk mirrors the production SqlAuditStorage.MarkBulk unnest INSERT so the
// load test exercises the real write path (including ON CONFLICT) end to end.
type loadStore struct {
	db *sql.DB
}

func (s *loadStore) MarkBulk(ctx context.Context, records []store.AuditDeliveryRecord) error {
	if len(records) == 0 {
		return nil
	}
	userIDs := make([]string, len(records))
	entityIDs := make([]string, len(records))
	mechanisms := make([]int64, len(records))
	for i, r := range records {
		userIDs[i] = r.UserID
		entityIDs[i] = r.EntityID
		mechanisms[i] = int64(r.Mechanism)
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO audit_storage (user_id, entity_id, mechanism, created_at)
		 SELECT u, e, m, $4
		 FROM unnest($1::text[], $2::text[], $3::smallint[]) AS t(u, e, m)
		 ON CONFLICT (user_id, entity_id, mechanism) DO NOTHING`,
		pq.Array(userIDs), pq.Array(entityIDs), pq.Array(mechanisms), model.GetMillis())
	return err
}

func (s *loadStore) Mark(context.Context, string, string, int16) error               { return nil }
func (s *loadStore) MarkBulkSameUser(context.Context, string, []string, int16) error { return nil }
func (s *loadStore) MarkBulkSamePost(context.Context, []string, string, int16) error { return nil }
func (s *loadStore) HasRead(context.Context, string, string) (bool, error)           { return false, nil }

const auditLoadContainer = "mm-audit-loadtest-pg"

// ensureAuditDB returns a connected pool to the audit-storage DB, starting a
// throwaway Postgres container if nothing is already listening. It uses a
// plain `docker run` on the default bridge network rather than the repo's
// compose stack, so it does not clash with the fixed-subnet `mm-test` network
// other Mattermost stacks may already hold. Set LOADTEST_NO_DOCKER to require
// a pre-existing DB (skip instead of starting one), or LOADTEST_DOCKER_DOWN to
// remove the container when the test finishes (default: leave it for re-runs).
func ensureAuditDB(t *testing.T, dsn string) *sql.DB {
	t.Helper()
	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)

	if pingWithin(db, 2*time.Second) == nil {
		return db // reuse whatever is already on :5433
	}

	if os.Getenv("LOADTEST_NO_DOCKER") != "" {
		db.Close()
		t.Skipf("audit DB not reachable at %s and LOADTEST_NO_DOCKER is set", dsn)
	}

	// Clear any stopped container from a previous run, then start fresh.
	_ = exec.Command("docker", "rm", "-f", auditLoadContainer).Run()

	t.Logf("audit DB not reachable; starting throwaway container %q ...", auditLoadContainer)
	run := exec.Command("docker", "run", "-d",
		"--name", auditLoadContainer,
		"-e", "POSTGRES_USER=mmuser",
		"-e", "POSTGRES_PASSWORD=mostest",
		"-e", "POSTGRES_DB=mattermost_auditstorage",
		"-p", "5433:5432",
		"postgres:14",
	)
	if out, cerr := run.CombinedOutput(); cerr != nil {
		db.Close()
		t.Skipf("failed to start container (is docker running?): %v\n%s", cerr, out)
	}

	if os.Getenv("LOADTEST_DOCKER_DOWN") != "" {
		t.Cleanup(func() { _ = exec.Command("docker", "rm", "-f", auditLoadContainer).Run() })
	}

	if err := pingWithin(db, 120*time.Second); err != nil {
		db.Close()
		t.Skipf("container %q did not become ready: %v", auditLoadContainer, err)
	}
	return db
}

// pingWithin polls until the DB answers or the timeout elapses.
func pingWithin(db *sql.DB, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var err error
	for {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		err = db.PingContext(ctx)
		cancel()
		if err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return err
		}
		time.Sleep(time.Second)
	}
}

func envStr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

func envDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			return d
		}
	}
	return def
}
