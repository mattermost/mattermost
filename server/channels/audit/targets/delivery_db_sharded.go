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

// ShardedDeliveryDBTarget batches post-delivery audit records into one row
// per (user, entity, mechanism) and flushes them to the audit-storage DB via
// MarkBulk. Records are routed to a shard by hash(user_id); each shard is
// drained by exactly one worker, so concurrent flushes never contend on the
// same (user, entity, mechanism) tuples and ON CONFLICT inserts never deadlock
// against each other.
//
// Lossless under overload: this target applies back-pressure instead of
// shedding load. A full shard channel makes Write block until room opens; a
// failed MarkBulk retains the batch and retries on the next tick. Per-shard
// memory is bounded by maxPending — once the retained batch reaches that
// size the worker stops draining the channel, which pushes back through Write
// to the logr drain goroutine and onward to producers. A persistently
// unreachable audit DB therefore slows producers rather than losing records.
type ShardedDeliveryDBTarget struct {
	store  store.AuditStorageStore
	logger *mlog.Logger

	numShards     int
	shardQueue    int           // per-shard channel capacity
	batchSize     int           // flush when a shard accumulates this many unique rows
	maxPending    int           // stop draining a shard above this backlog (back-pressure)
	flushInterval time.Duration // time-based flush cadence; caps in-memory residency, and the retry cadence

	shards  []chan auditDeliveryItem
	done    chan struct{}
	wg      sync.WaitGroup
	stopped atomic.Bool

	blockedCount atomic.Int64
}

const (
	shardedDeliveryShards        = 8
	shardedDeliveryShardQueue    = 8192
	shardedDeliveryBatchSize     = 500
	shardedDeliveryMaxPending    = 2000
	shardedDeliveryFlushInterval = 100 * time.Millisecond
	shardedDeliveryShutdownTries = 3

	// shardedDeliveryLogEvery rate-limits the back-pressure log. A sustained
	// overload then produces ~1 log per N stalls instead of one per stall,
	// so audit problems don't amplify into log storms.
	shardedDeliveryLogEvery = 1000
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

// Write expands a LogRec's meta into one row per (user, entity, mechanism)
// and routes each row directly to its owning shard. The walk does not
// materialize an intermediate slice — on a fan-out broadcast to N users this
// saves an N-element allocation on the logr drain goroutine.
func (t *ShardedDeliveryDBTarget) Write(p []byte, rec *mlog.LogRec) (int, error) {
	if t.shards == nil {
		return 0, errors.New("audit_delivery_sharded: target not initialized")
	}
	t.route(rec.Fields())
	return len(p), nil
}

// route walks the meta map once and pushes each row directly to its shard,
// handling all three producer shapes inline:
//
//   - user_ids []string + entity_id  -> fan-out (one post, many users)
//   - user_id + entity_ids []string  -> fan-in  (one user, many posts)
//   - user_id + entity_id            -> single row
func (t *ShardedDeliveryDBTarget) route(fields []mlog.Field) {
	for _, f := range fields {
		if f.Key != model.AuditKeyMeta {
			continue
		}
		meta, ok := f.Interface.(map[string]any)
		if !ok {
			return
		}
		mech, _ := meta["mechanism"].(int16)

		if userIDs, ok := meta["user_ids"].([]string); ok {
			entityID, _ := meta["entity_id"].(string)
			if entityID == "" {
				return
			}
			for _, userID := range userIDs {
				if userID == "" {
					continue
				}
				t.enqueue(auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech})
			}
			return
		}

		if entityIDs, ok := meta["entity_ids"].([]string); ok {
			userID, _ := meta["user_id"].(string)
			if userID == "" {
				return
			}
			for _, entityID := range entityIDs {
				if entityID == "" {
					continue
				}
				t.enqueue(auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech})
			}
			return
		}

		userID, _ := meta["user_id"].(string)
		entityID, _ := meta["entity_id"].(string)
		if userID == "" || entityID == "" {
			return
		}
		t.enqueue(auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech})
		return
	}
}

// enqueue sends to the owning shard, blocking when the shard channel is full.
// Blocking is the lossless alternative to discarding under load: back-pressure
// flows back through logr to the producer goroutines so a slow audit DB slows
// the server instead of silently losing audit rows.
func (t *ShardedDeliveryDBTarget) enqueue(item auditDeliveryItem) {
	ch := t.shards[shardFor(item.userID, t.numShards)]
	select {
	case ch <- item:
	default:
		n := t.blockedCount.Add(1)
		if t.logger != nil && (n == 1 || n%shardedDeliveryLogEvery == 0) {
			t.logger.Warn(
				"audit_delivery_sharded: shard full, Write blocked (back-pressure, no records dropped)",
				mlog.Int("blocked_total", n),
				mlog.Int("shard_queue_size", t.shardQueue),
				mlog.Int("shard_queue_len", len(ch)),
			)
		}
		ch <- item
	}
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

	// flush attempts one MarkBulk. On success it empties pending and returns
	// true. On error it logs and KEEPS pending so the rows are retried on the
	// next tick: a failed write never silently drops records.
	flush := func() bool {
		if len(pending) == 0 {
			return true
		}
		batch := make([]model.AuditDeliveryRecord, 0, len(pending))
		for it := range pending {
			batch = append(batch, model.AuditDeliveryRecord{
				UserID:    it.userID,
				EntityID:  it.entityID,
				Mechanism: it.mechanism,
			})
		}
		if err := t.store.MarkBulk(context.Background(), batch); err != nil {
			if t.logger != nil {
				t.logger.Error(
					"audit_delivery_sharded: bulk flush failed, will retry",
					mlog.Int("batch_size", len(batch)),
					mlog.Err(err),
				)
			}
			return false
		}
		clear(pending)
		return true
	}

	for {
		// While a failed-flush backlog sits above maxPending, stop draining
		// new items (a nil channel disables that select case). The shard
		// channel then fills and back-pressure flows to Write, rather than
		// pending growing unbounded toward OOM. The ticker still fires, so
		// the backlog is retried every flushInterval.
		inCh := in
		if len(pending) >= t.maxPending {
			inCh = nil
		}

		select {
		case item := <-inCh:
			pending[item] = struct{}{}
			if len(pending) >= t.batchSize {
				flush()
			}
		case <-ticker.C:
			flush()
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
func (t *ShardedDeliveryDBTarget) finalize(in chan auditDeliveryItem, pending map[auditDeliveryItem]struct{}, flush func() bool) {
DrainLoop:
	for {
		select {
		case item := <-in:
			pending[item] = struct{}{}
		default:
			break DrainLoop
		}
	}
	for attempt := 0; attempt < shardedDeliveryShutdownTries && !flush(); attempt++ {
		time.Sleep(t.flushInterval)
	}
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
