// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// ShardedDeliveryDBTarget is a higher-throughput drop-in replacement for DeliveryDBTarget.
// It absorbs a high volume of post-delivery audit records: one row per (user, entity, mechanism))
// and writes them to the audit-storage DB in large batched, deduplicated, ON CONFLICT inserts.
//
// Design goals, in priority order, matching the audit contract:
//
//  1. Never drop a record because the server is busy. When a shard cannot
//     keep up, the target applies back-pressure (Write blocks) rather than
//     discarding. A persistently unreachable audit DB therefore slows
//     producers instead of losing data.
//  2. Bounded, short-lived in-memory residency. A flush timer caps how long
//     any record sits in memory (sub-second), so a hard crash loses at most
//     a few seconds of records, the accepted hard-failure bound.
//  3. Decouple the request goroutine from the audit DB. logr drains its
//     per-target queue on a single goroutine that calls Write; Write only
//     routes into a per-shard channel, so the DB round-trip never runs on
//     the request goroutine.
//
// Why sharding (the key difference from DeliveryDBTarget): records are routed
// to a shard by hash(user_id), and each shard is drained by exactly one worker.
// Because a given user_id is owned by one worker, concurrent workers never
// write overlapping (user, entity, mechanism) keys (the triple shares a user_id
// so it always lands on the same shard), so their ON CONFLICT DO NOTHING
// inserts never contend on the same unique-index tuples and cannot deadlock
// against each other. The per-shard worker also deduplicates within a batch (a
// re-read or overlapping broadcast collapses to one row) so the DB never sees
// redundant rows that ON CONFLICT would just discard.
//
// Sharding on user_id (rather than entity_id) keeps a large fan-out parallel:
// a single post delivered to many users spreads across all shards instead of
// piling onto one worker. The only thing that concentrates on a single shard is
// fan-in (one user reading many posts), which is bounded by page size and far
// smaller than a broadcast.
type ShardedDeliveryDBTarget struct {
	store  store.AuditStorageStore
	logger *mlog.Logger

	numShards     int
	shardQueue    int           // per-shard channel capacity
	batchSize     int           // flush when a shard accumulates this many unique rows
	maxPending    int           // stop draining a shard above this backlog (back-pressure)
	flushInterval time.Duration // also caps in-memory residency, and the retry cadence
	maxBackoff    time.Duration // upper bound on per-shard retry backoff after repeated failures

	shards  []chan auditDeliveryItem
	done    chan struct{}
	wg      sync.WaitGroup
	stopped atomic.Bool

	blockedCount atomic.Int64
}

const (
	shardedDeliveryShards        = 8
	shardedDeliveryShardQueue    = 1000
	shardedDeliveryBatchSize     = 500
	shardedDeliveryMaxPending    = 4000
	shardedDeliveryFlushInterval = 100 * time.Millisecond
	shardedDeliveryMaxBackoff    = 30 * time.Second
	shardedDeliveryShutdownTries = 3

	// shardedDeliveryErrorLogEvery rate-limits the "flush failed" error so a
	// persistent audit-DB outage produces a handful of logs (1st failure, then
	// every Nth) instead of one per flushInterval per shard.
	shardedDeliveryErrorLogEvery = 50
)

var _ logr.Target = (*ShardedDeliveryDBTarget)(nil)

// NewShardedDeliveryDBTarget builds a target backed by the given store. The
// signature mirrors NewDeliveryDBTarget so it is a drop-in replacement at the
// app.configureAudit factory. A nil store yields a validation-time stub whose
// Init/Write/Shutdown are safe no-ops.
func NewShardedDeliveryDBTarget(s store.AuditStorageStore, logger *mlog.Logger) *ShardedDeliveryDBTarget {
	return &ShardedDeliveryDBTarget{
		store:         s,
		logger:        logger,
		numShards:     shardedDeliveryShards,
		shardQueue:    shardedDeliveryShardQueue,
		batchSize:     shardedDeliveryBatchSize,
		maxPending:    shardedDeliveryMaxPending,
		flushInterval: shardedDeliveryFlushInterval,
		maxBackoff:    shardedDeliveryMaxBackoff,
	}
}

func (t *ShardedDeliveryDBTarget) Init() error {
	if t.store == nil {
		// Validation-time stub: never run. Skip worker startup so the stub
		// can be GC'd cleanly without leaking goroutines.
		return nil
	}
	t.done = make(chan struct{})
	t.shards = make([]chan auditDeliveryItem, t.numShards)
	t.wg.Add(t.numShards)
	for i := range t.shards {
		ch := make(chan auditDeliveryItem, t.shardQueue)
		t.shards[i] = ch
		go t.shardLoop(ch)
	}
	return nil
}

func (t *ShardedDeliveryDBTarget) Shutdown() error {
	if t.shards == nil {
		return nil
	}
	if t.stopped.Swap(true) {
		return nil
	}
	// logr has already drained its queue (no more Write calls will arrive)
	// before Shutdown is invoked, so signalling done lets each worker drain
	// its buffered items and make a best-effort final flush.
	close(t.done)
	t.wg.Wait()
	return nil
}

// Write routes a record's rows to their owning shards. It blocks (never
// drops) when a shard channel is full; that back-pressure is the lossless
// alternative to discarding under load.
func (t *ShardedDeliveryDBTarget) Write(p []byte, rec *mlog.LogRec) (int, error) {
	items, ok := t.extractItems(rec.Fields())
	if !ok {
		return 0, nil
	}
	if t.shards == nil {
		return 0, errors.New("audit_delivery_sharded: target not initialized")
	}
	t.enqueue(items)
	return len(p), nil
}

// enqueue routes each row to its owning shard, blocking (never dropping) when
// a shard channel is full. That back-pressure is the lossless alternative to
// discarding under load.
func (t *ShardedDeliveryDBTarget) enqueue(items []auditDeliveryItem) {
	for _, item := range items {
		ch := t.shards[shardFor(item.userID, t.numShards)]
		select {
		case ch <- item:
		default:
			// Shard is saturated: account the stall, then block until there
			// is room. This is the back-pressure path, not a drop path.
			t.blockedCount.Add(1)
			t.logBlocked(len(ch))
			ch <- item
		}
	}
}

// extractItems reads the structured Meta map off the record and expands it
// into one auditDeliveryItem per (user, entity, mechanism) row. It handles
// all three producer shapes so the target stays correct regardless of which
// the app layer emits:
//
//   - user_ids []string + entity_id  -> fan-out (one post, many users)
//   - user_id + entity_ids []string  -> fan-in  (one user, many posts)
//   - user_id + entity_id            -> single row
//
// The array shapes are far cheaper on the logr queue (one record instead of
// N), so the app layer is free to emit them; this target unpacks either way.
func (t *ShardedDeliveryDBTarget) extractItems(fields []mlog.Field) ([]auditDeliveryItem, bool) {
	for _, f := range fields {
		if f.Key != model.AuditKeyMeta {
			continue
		}
		meta, ok := f.Interface.(map[string]any)
		if !ok {
			return nil, false
		}
		mech, _ := meta["mechanism"].(int16)

		if userIDs, ok := meta["user_ids"].([]string); ok {
			entityID, _ := meta["entity_id"].(string)
			if entityID == "" {
				return nil, false
			}
			items := make([]auditDeliveryItem, 0, len(userIDs))
			for _, userID := range userIDs {
				if userID != "" {
					items = append(items, auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech})
				}
			}
			return items, len(items) > 0
		}

		if entityIDs, ok := meta["entity_ids"].([]string); ok {
			userID, _ := meta["user_id"].(string)
			if userID == "" {
				return nil, false
			}
			items := make([]auditDeliveryItem, 0, len(entityIDs))
			for _, entityID := range entityIDs {
				if entityID != "" {
					items = append(items, auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech})
				}
			}
			return items, len(items) > 0
		}

		userID, _ := meta["user_id"].(string)
		entityID, _ := meta["entity_id"].(string)
		if userID == "" || entityID == "" {
			return nil, false
		}
		return []auditDeliveryItem{{userID: userID, entityID: entityID, mechanism: mech}}, true
	}
	return nil, false
}

// shardLoop owns one shard: it accumulates unique rows and flushes them in a
// single MarkBulk round-trip on size or on the flush timer. It is the only
// goroutine that touches its shard's entity_ids, which is what keeps
// concurrent flushes conflict-free at the DB.
func (t *ShardedDeliveryDBTarget) shardLoop(in chan auditDeliveryItem) {
	defer t.wg.Done()

	// auditDeliveryItem is comparable, so using it as the map key gives us
	// in-batch dedup for free: duplicate deliveries collapse to one row.
	pending := make(map[auditDeliveryItem]struct{}, t.batchSize)
	ticker := time.NewTicker(t.flushInterval)
	defer ticker.Stop()

	// failures counts consecutive failed flushes. It drives two things:
	//   - exponential backoff: each new failure doubles the wait before the
	//     next attempt, capped at maxBackoff, so a persistently unreachable
	//     audit DB does not retry every flushInterval indefinitely.
	//   - rate-limited error logging: the 1st failure and every
	//     shardedDeliveryErrorLogEvery'th thereafter logs an Error; in
	//     between we stay quiet so an outage does not amplify into log spam.
	failures := 0
	var nextAttempt time.Time

	// flush attempts one MarkBulk. On success it empties pending, resets the
	// backoff state, and returns true. On error it KEEPS pending so the rows
	// are retried later (lossless), bumps the failure counter, and schedules
	// the next attempt. When force is true the backoff window is bypassed —
	// used by finalize so shutdown can still drain through a sleeping shard.
	flush := func(force bool) bool {
		if len(pending) == 0 {
			return true
		}
		if !force && time.Now().Before(nextAttempt) {
			return false
		}
		batch := make([]store.AuditDeliveryRecord, 0, len(pending))
		for it := range pending {
			batch = append(batch, store.AuditDeliveryRecord{
				UserID:    it.userID,
				EntityID:  it.entityID,
				Mechanism: it.mechanism,
			})
		}
		if err := t.store.MarkBulk(context.Background(), batch); err != nil {
			failures++
			backoff := t.flushInterval << (failures - 1)
			if backoff <= 0 || backoff > t.maxBackoff {
				backoff = t.maxBackoff
			}
			nextAttempt = time.Now().Add(backoff)
			if t.logger != nil && (failures == 1 || failures%shardedDeliveryErrorLogEvery == 0) {
				t.logger.Error(
					"audit_delivery_sharded: bulk flush failed, will retry with backoff",
					mlog.Int("batch_size", len(batch)),
					mlog.Int("consecutive_failures", failures),
					mlog.Duration("next_retry_in", backoff),
					mlog.Err(err),
				)
			}
			return false
		}
		if failures > 0 && t.logger != nil {
			t.logger.Info(
				"audit_delivery_sharded: bulk flush recovered",
				mlog.Int("prior_consecutive_failures", failures),
			)
		}
		failures = 0
		nextAttempt = time.Time{}
		clear(pending)
		return true
	}

	for {
		// While a failed-flush backlog sits above maxPending, stop draining
		// new items (a nil channel disables that select case). The shard
		// channel then fills and back-pressure flows to Write, rather than
		// pending growing unbounded toward OOM. The ticker still fires, so
		// the backlog is retried (subject to backoff) every flushInterval.
		inCh := in
		if len(pending) >= t.maxPending {
			inCh = nil
		}

		select {
		case item := <-inCh:
			pending[item] = struct{}{}
			if len(pending) >= t.batchSize {
				flush(false)
			}
		case <-ticker.C:
			flush(false)
		case <-t.done:
			t.finalize(in, pending, flush)
			return
		}
	}
}

// finalize drains any already-buffered items (no new ones can arrive once
// done is closed) and makes a bounded best-effort flush. If the audit DB is
// unreachable at shutdown the remaining rows are lost, which is the accepted
// hard-failure bound; everything written within flushInterval of a graceful
// shutdown is preserved.
func (t *ShardedDeliveryDBTarget) finalize(in chan auditDeliveryItem, pending map[auditDeliveryItem]struct{}, flush func(force bool) bool) {
DrainLoop:
	for {
		select {
		case item := <-in:
			pending[item] = struct{}{}
		default:
			break DrainLoop
		}
	}
	// Bypass the per-shard backoff window: shutdown has a small fixed budget
	// and skipping attempts because nextAttempt is in the future would just
	// burn the budget without trying.
	for attempt := 0; attempt < shardedDeliveryShutdownTries && !flush(true); attempt++ {
		time.Sleep(t.flushInterval)
	}
}

func (t *ShardedDeliveryDBTarget) logBlocked(queueLen int) {
	if t.logger == nil {
		return
	}
	t.logger.Warn(
		"audit_delivery_sharded: shard full, Write blocked (back-pressure, no records dropped)",
		mlog.Int("shard_queue_size", t.shardQueue),
		mlog.Int("shard_queue_len", queueLen),
		mlog.Int("blocked_total", t.blockedCount.Load()),
	)
}

// shardFor maps a key (the user_id) to a shard with an inline FNV-1a hash.
// Inlining avoids the per-call allocation of hash/fnv.New32a on this hot path.
func shardFor(key string, numShards int) int {
	const (
		offset32 = uint32(2166136261)
		prime32  = uint32(16777619)
	)
	h := offset32
	for i := 0; i < len(key); i++ {
		h ^= uint32(key[i])
		h *= prime32
	}
	return int(h % uint32(numShards))
}
