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
// Lossy under overload: this target sheds load instead of applying
// back-pressure. When a shard channel is full, Write drops the row and
// increments a counter; when a flush fails, the batch is discarded after a
// rate-limited error log. Blocking would let producer goroutines accumulate
// in memory while the audit DB is degraded, which is the OOM path this
// target exists to avoid. Audit completeness is sacrificed for server
// liveness; the dropped/failed counters make the loss observable.
type ShardedDeliveryDBTarget struct {
	store  store.AuditStorageStore
	logger *mlog.Logger

	numShards     int
	shardQueue    int           // per-shard channel capacity (memory bound)
	batchSize     int           // flush when a shard accumulates this many unique rows
	flushInterval time.Duration // time-based flush cadence; caps in-memory residency

	shards  []chan auditDeliveryItem
	done    chan struct{}
	wg      sync.WaitGroup
	stopped atomic.Bool

	droppedCount atomic.Int64
	failedCount  atomic.Int64
}

const (
	shardedDeliveryShards        = 8
	shardedDeliveryShardQueue    = 8192
	shardedDeliveryBatchSize     = 500
	shardedDeliveryFlushInterval = 100 * time.Millisecond

	// shardedDeliveryLogEvery rate-limits both the drop and failure logs.
	// A persistent overload then produces ~1 log per N events instead of
	// one per event, so audit problems don't amplify into log storms.
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
				t.tryEnqueue(auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech})
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
				t.tryEnqueue(auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech})
			}
			return
		}

		userID, _ := meta["user_id"].(string)
		entityID, _ := meta["entity_id"].(string)
		if userID == "" || entityID == "" {
			return
		}
		t.tryEnqueue(auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech})
		return
	}
}

// tryEnqueue is a non-blocking send. A full shard channel means the audit DB
// cannot drain as fast as the producer is emitting; the row is counted and
// dropped rather than blocking the logr drain goroutine. That blocking is
// what causes the OOM cascade this target exists to prevent.
func (t *ShardedDeliveryDBTarget) tryEnqueue(item auditDeliveryItem) {
	ch := t.shards[shardFor(item.userID, t.numShards)]
	select {
	case ch <- item:
	default:
		n := t.droppedCount.Add(1)
		if t.logger != nil && (n == 1 || n%shardedDeliveryLogEvery == 0) {
			t.logger.Warn(
				"audit_delivery_sharded: shard full, record dropped",
				mlog.Int("dropped_total", n),
				mlog.Int("shard_queue_size", t.shardQueue),
			)
		}
	}
}

// shardLoop owns one shard. It drains the channel into a dedup map and flushes
// on size or on the tick. On flush failure the batch is discarded after a
// rate-limited error log — retrying would just enlarge the in-memory footprint
// while the audit DB stays sick, which is the failure mode that lights up
// OOM in production.
func (t *ShardedDeliveryDBTarget) shardLoop(in chan auditDeliveryItem) {
	defer t.wg.Done()

	// auditDeliveryItem is comparable, so using it as the map key gives us
	// in-batch dedup for free: duplicate deliveries collapse to one row.
	pending := make(map[auditDeliveryItem]struct{}, t.batchSize)
	ticker := time.NewTicker(t.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case item := <-in:
			pending[item] = struct{}{}
			if len(pending) >= t.batchSize {
				t.flush(pending)
			}
		case <-ticker.C:
			t.flush(pending)
		case <-t.done:
			// Best-effort drain of any buffered items, then a single final
			// flush. No retry loop on shutdown: holding rows for a sick DB
			// is exactly the OOM-inducing behavior we are removing.
		drain:
			for {
				select {
				case item := <-in:
					pending[item] = struct{}{}
				default:
					break drain
				}
			}
			t.flush(pending)
			return
		}
	}
}

// flush attempts one MarkBulk, then unconditionally clears pending. Whether
// the call succeeded or not, the worker moves on; the per-shard footprint is
// thereby bounded by batchSize between flushes.
func (t *ShardedDeliveryDBTarget) flush(pending map[auditDeliveryItem]struct{}) {
	if len(pending) == 0 {
		return
	}
	batch := make([]model.AuditDeliveryRecord, 0, len(pending))
	for it := range pending {
		batch = append(batch, model.AuditDeliveryRecord{
			UserID:    it.userID,
			EntityID:  it.entityID,
			Mechanism: it.mechanism,
		})
	}
	clear(pending)

	if err := t.store.MarkBulk(context.Background(), batch); err != nil {
		n := t.failedCount.Add(1)
		if t.logger != nil && (n == 1 || n%shardedDeliveryLogEvery == 0) {
			t.logger.Error(
				"audit_delivery_sharded: bulk flush failed, batch discarded",
				mlog.Int("batch_size", len(batch)),
				mlog.Int("failed_total", n),
				mlog.Err(err),
			)
		}
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
