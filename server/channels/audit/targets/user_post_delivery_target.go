// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// DeliveryDBTargetType is the advanced-logging "type" name that selects the
// post-delivery target. Reference it from ExperimentalAuditSettings.AdvancedLoggingJSON.
const DeliveryDBTargetType = "user_post_delivery_db"

const (
	deliveryShards        = 8
	deliveryShardQueue    = 4096
	deliveryBatchSize     = 1000
	deliveryMaxPending    = 4000
	deliveryFlushInterval = 100 * time.Millisecond
	deliveryShutdownTries = 3
)

func init() {
	// Register the type/format names so LoggerConfiguration.IsValid accepts a
	// config referencing this target before the runtime factory (which needs a
	// wired store) exists.
	mlog.ValidationFactories = &mlog.Factories{
		TargetFactory: func(targetType string, _ json.RawMessage) (logr.Target, error) {
			if strings.ToLower(targetType) == DeliveryDBTargetType {
				return &UserPostDeliveryTarget{}, nil
			}
			return nil, fmt.Errorf("unrecognized target type %q", targetType)
		},
		FormatterFactory: func(format string, _ json.RawMessage) (logr.Formatter, error) {
			if strings.ToLower(format) == DeliveryNoopFormat {
				return NoopFormatter{}, nil
			}
			return nil, fmt.Errorf("unrecognized formatter %q", format)
		},
	}
}

// deliveryItem is one row to persist; it is comparable, so it doubles as the map
// key for in-batch dedup.
type deliveryItem struct {
	postID     string
	targetID   string
	targetType string
	mechanism  int16
}

// UserPostDeliveryTarget is a logr target that batches post-delivery audit
// records into deduplicated, ON CONFLICT inserts on the post-delivery DB.
//
// Records are sharded by hash(target_id) and each shard is drained by exactly
// one worker. Because the unique tuple contains target_id, a given key always
// lands on the same worker, so concurrent workers never contend on the same
// ON CONFLICT rows or deadlock. Sharding on target_id (not post_id) keeps a
// large fan-out parallel; only fan-in concentrates on one shard, bounded by
// page size.
//
// Back-pressure is lossless: when a shard is full Write blocks rather than
// dropping, and a failed flush is retried rather than discarded. A flush timer
// bounds in-memory residency, so a hard crash loses at most a few seconds.
type UserPostDeliveryTarget struct {
	store  store.UserPostDeliveryStore
	logger *mlog.Logger

	numShards     int
	shardQueue    int           // per-shard channel capacity
	batchSize     int           // flush when a shard accumulates this many unique rows
	maxPending    int           // stop draining a shard above this backlog (back-pressure)
	flushInterval time.Duration // caps in-memory residency and sets the retry cadence

	shards  []chan deliveryItem
	done    chan struct{}
	wg      sync.WaitGroup
	stopped atomic.Bool

	blockedCount atomic.Int64
}

var _ logr.Target = (*UserPostDeliveryTarget)(nil)

// NewUserPostDeliveryTarget builds a target backed by the given store. A nil
// store yields a validation-time stub whose Init/Write/Shutdown are safe no-ops.
func NewUserPostDeliveryTarget(s store.UserPostDeliveryStore, logger *mlog.Logger) *UserPostDeliveryTarget {
	return &UserPostDeliveryTarget{
		store:         s,
		logger:        logger,
		numShards:     deliveryShards,
		shardQueue:    deliveryShardQueue,
		batchSize:     deliveryBatchSize,
		maxPending:    deliveryMaxPending,
		flushInterval: deliveryFlushInterval,
	}
}

func (t *UserPostDeliveryTarget) Init() error {
	if t.store == nil {
		return nil // validation-time stub: no workers to start
	}
	t.done = make(chan struct{})
	t.shards = make([]chan deliveryItem, t.numShards)
	t.wg.Add(t.numShards)
	for i := range t.shards {
		ch := make(chan deliveryItem, t.shardQueue)
		t.shards[i] = ch
		go t.shardLoop(ch)
	}
	return nil
}

func (t *UserPostDeliveryTarget) Shutdown() error {
	if t.shards == nil {
		return nil
	}
	if t.stopped.Swap(true) {
		return nil
	}
	// logr has drained its queue before Shutdown, so no Write calls race here;
	// closing done lets each worker make a best-effort final flush.
	close(t.done)
	t.wg.Wait()
	return nil
}

// Write routes a record's rows to their shards. It blocks (never drops) when a
// shard is full.
func (t *UserPostDeliveryTarget) Write(p []byte, rec *mlog.LogRec) (int, error) {
	items, ok := t.extractItems(rec.Fields())
	if !ok {
		return 0, nil
	}
	if t.shards == nil {
		return 0, errors.New("UserPostDeliveryTarget.Write: target not initialized")
	}
	t.enqueue(items)
	return len(p), nil
}

// enqueue routes each row to its owning shard.
func (t *UserPostDeliveryTarget) enqueue(items []deliveryItem) {
	for _, item := range items {
		ch := t.shards[shardFor(item.targetID, t.numShards)]
		select {
		case ch <- item:
		default:
			// Shard saturated: record the stall, then block until there is room
			// (back-pressure, not a drop).
			t.blockedCount.Add(1)
			t.logBlocked(len(ch))
			ch <- item
		}
	}
}

// extractItems reads the Meta map off the record and expands it into one
// deliveryItem per row. It accepts three producer shapes:
//
//   - target_ids []string + post_id   -> fan-out (one post, many targets)
//   - target_id  + post_ids []string  -> fan-in  (one target, many posts)
//   - target_id  + post_id            -> single row
//
// target_type defaults to "user" when absent.
func (t *UserPostDeliveryTarget) extractItems(fields []mlog.Field) ([]deliveryItem, bool) {
	for _, f := range fields {
		if f.Key != model.AuditKeyMeta {
			continue
		}
		meta, ok := f.Interface.(map[string]any)
		if !ok {
			return nil, false
		}

		mech, _ := meta["mechanism"].(int16)
		targetType, _ := meta["target_type"].(string)
		if targetType == "" {
			targetType = model.DeliveryTargetUser
		}

		if targetIDs, ok := meta["target_ids"].([]string); ok {
			postID, _ := meta["post_id"].(string)
			if postID == "" {
				return nil, false
			}
			items := make([]deliveryItem, 0, len(targetIDs))
			for _, targetID := range targetIDs {
				if targetID != "" {
					items = append(items, deliveryItem{postID: postID, targetID: targetID, targetType: targetType, mechanism: mech})
				}
			}
			return items, len(items) > 0
		}

		if postIDs, ok := meta["post_ids"].([]string); ok {
			targetID, _ := meta["target_id"].(string)
			if targetID == "" {
				return nil, false
			}
			items := make([]deliveryItem, 0, len(postIDs))
			for _, postID := range postIDs {
				if postID != "" {
					items = append(items, deliveryItem{postID: postID, targetID: targetID, targetType: targetType, mechanism: mech})
				}
			}
			return items, len(items) > 0
		}

		targetID, _ := meta["target_id"].(string)
		postID, _ := meta["post_id"].(string)
		if targetID == "" || postID == "" {
			return nil, false
		}
		return []deliveryItem{{postID: postID, targetID: targetID, targetType: targetType, mechanism: mech}}, true
	}
	return nil, false
}

// shardLoop owns one shard: it accumulates unique rows and flushes them with a
// single MarkBulk on batch size or on the flush timer.
func (t *UserPostDeliveryTarget) shardLoop(in chan deliveryItem) {
	defer t.wg.Done()

	pending := make(map[deliveryItem]struct{}, t.batchSize)
	ticker := time.NewTicker(t.flushInterval)
	defer ticker.Stop()

	// flush attempts one MarkBulk; on error it keeps pending so the rows retry on
	// the next tick rather than being dropped.
	flush := func() bool {
		if len(pending) == 0 {
			return true
		}
		batch := make([]model.UserPostDelivery, 0, len(pending))
		for it := range pending {
			batch = append(batch, model.UserPostDelivery{
				PostID:     it.postID,
				TargetID:   it.targetID,
				TargetType: it.targetType,
				Mechanism:  it.mechanism,
			})
		}
		if err := t.store.MarkBulk(context.Background(), batch); err != nil {
			if t.logger != nil {
				t.logger.Error(
					"user_post_delivery_db: bulk flush failed, will retry",
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
		// Above maxPending, stop draining (a nil channel disables that select
		// case) so the shard fills and back-pressure flows to Write instead of
		// pending growing unbounded. The ticker still fires, retrying the backlog.
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

// finalize drains buffered items (no new ones arrive once done is closed) and
// makes a bounded best-effort flush; rows still unwritten if the DB is down at
// shutdown are lost.
func (t *UserPostDeliveryTarget) finalize(in chan deliveryItem, pending map[deliveryItem]struct{}, flush func() bool) {
DrainLoop:
	for {
		select {
		case item := <-in:
			pending[item] = struct{}{}
		default:
			break DrainLoop
		}
	}
	for attempt := 0; attempt < deliveryShutdownTries && !flush(); attempt++ {
		time.Sleep(t.flushInterval)
	}
}

func (t *UserPostDeliveryTarget) logBlocked(queueLen int) {
	if t.logger == nil {
		return
	}
	t.logger.Warn(
		"user_post_delivery_db: shard full, Write blocked (back-pressure, no records dropped)",
		mlog.Int("shard_queue_size", t.shardQueue),
		mlog.Int("shard_queue_len", queueLen),
		mlog.Int("blocked_total", t.blockedCount.Load()),
	)
}

// shardFor maps target_id to a shard via an inline FNV-1a hash (inlined to avoid
// the fnv.New32a allocation on this hot path).
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
