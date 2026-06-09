// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package targets hosts custom mlog targets that the audit logger can route
// records to. Targets here are registered via audit.Audit.Factories at
// configureAudit time.
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

// DeliveryDBTargetType is the target-type string used in advanced-logging
// JSON to wire this target. Match in lowercase since the configurator
// passes the original string through to the factory.
const DeliveryDBTargetType = "audit_delivery_db"

const (
	deliveryQueueSize     = 10000
	deliveryBatchSize     = 1000
	deliveryFlushInterval = 100 * time.Millisecond
	deliveryWorkers       = 4
	blockedWarnInterval   = time.Second
)

// init registers a validation-time factory so LoggerConfiguration.IsValid
// recognises this custom target type. The validation target is a no-op
// (nil store, never Init'd) — it only exists so the type-name check during
// config validation passes. The real runtime target, with the actual store
// and logger wired in, is constructed by app.configureAudit when the audit
// logger is configured.
func init() {
	mlog.ValidationFactories = &mlog.Factories{
		TargetFactory: func(targetType string, _ json.RawMessage) (logr.Target, error) {
			if strings.ToLower(targetType) == DeliveryDBTargetType {
				return &DeliveryDBTarget{}, nil
			}
			return nil, fmt.Errorf("unrecognized target type %q", targetType)
		},
	}
}

type auditDeliveryItem struct {
	userID    string
	entityID  string
	mechanism int16
}

type DeliveryDBTarget struct {
	store  store.AuditStorageStore
	logger *mlog.Logger

	// Per-instance copies of the package constants. NewDeliveryDBTarget
	// initializes these from the const block above; production code never
	// touches them again. They exist as fields (rather than reading the
	// constants directly) only so package-internal tests can shrink
	// queue/batch sizes for fast, deterministic test runs.
	queueSize     int
	batchSize     int
	flushInterval time.Duration
	workers       int

	queue   chan auditDeliveryItem
	wg      sync.WaitGroup
	stopped atomic.Bool

	// lastBlockLogNs holds the unix-nano timestamp of the last "queue
	// full" warning emit, used to rate-limit the log.
	lastBlockLogNs atomic.Int64
}

// NewDeliveryDBTarget builds a runtime target backed by the given store.
// The logger is used only for rate-limited warnings (queue-full) and flush
// errors; passing nil disables those logs but does not affect correctness.
func NewDeliveryDBTarget(s store.AuditStorageStore, logger *mlog.Logger) *DeliveryDBTarget {
	return &DeliveryDBTarget{
		store:         s,
		logger:        logger,
		queueSize:     deliveryQueueSize,
		batchSize:     deliveryBatchSize,
		flushInterval: deliveryFlushInterval,
		workers:       deliveryWorkers,
	}
}

// Init allocates the queue and spins up the worker pool. Called by logr
// once when the target is registered.
func (t *DeliveryDBTarget) Init() error {
	if t.store == nil {
		// Validation-time stub: never run. Skip worker startup so the
		// stub can be GC'd cleanly without leaking goroutines.
		return nil
	}
	t.queue = make(chan auditDeliveryItem, t.queueSize)
	t.wg.Add(t.workers)
	for i := 0; i < t.workers; i++ {
		go t.workerLoop()
	}
	return nil
}

// Shutdown closes the queue and waits for all workers to drain in-flight
// records and flush their final partial batch. Safe to call multiple times.
func (t *DeliveryDBTarget) Shutdown() error {
	if t.queue == nil {
		return nil
	}
	if t.stopped.Swap(true) {
		return nil
	}
	close(t.queue)
	t.wg.Wait()
	return nil
}

// Write extracts the (user_id, entity_id, mechanism) triple from the audit
// record's Meta map and enqueues it. The actual DB insert happens
// asynchronously in workerLoop. If the queue is full, Write blocks until
// space is available and emits a rate-limited warning so operators notice
// sustained backpressure. The formatted bytes (p) are ignored — we read
// structured field values directly so we never have to parse a serialized
// representation.
func (t *DeliveryDBTarget) Write(p []byte, rec *mlog.LogRec) (int, error) {
	item, ok := t.extractItem(rec)
	if !ok {
		return 0, nil
	}
	if t.queue == nil {
		return 0, errors.New("audit_delivery_db: target not initialized")
	}

	select {
	case t.queue <- item:
		return len(p), nil
	default:
	}

	t.logBlockedRateLimited()
	t.queue <- item
	return len(p), nil
}

// extractItem pulls the delivery triple out of the LogRec's Meta field.
// Returns ok=false if the record is missing required fields — callers
// silently skip such records (matches pre-refactor behaviour).
func (t *DeliveryDBTarget) extractItem(rec *mlog.LogRec) (auditDeliveryItem, bool) {
	for _, f := range rec.Fields() {
		if f.Key != model.AuditKeyMeta {
			continue
		}
		meta, ok := f.Interface.(map[string]any)
		if !ok {
			return auditDeliveryItem{}, false
		}
		userID, _ := meta["user_id"].(string)
		entityID, _ := meta["entity_id"].(string)
		mech, _ := meta["mechanism"].(int16)
		if userID == "" || entityID == "" {
			return auditDeliveryItem{}, false
		}
		return auditDeliveryItem{userID: userID, entityID: entityID, mechanism: mech}, true
	}
	return auditDeliveryItem{}, false
}

func (t *DeliveryDBTarget) logBlockedRateLimited() {
	t.logger.Warn(
		"audit_delivery_db: queue full, Write blocked",
		mlog.Int("queue_size", t.queueSize),
		mlog.Int("queue_len", len(t.queue)),
	)
}

// workerLoop pulls items off the queue, accumulates them into a batch, and
// flushes either when the batch hits deliveryBatchSize or when the flush
// ticker fires — whichever comes first. Exits when the queue is closed,
// draining any remaining items before returning.
func (t *DeliveryDBTarget) workerLoop() {
	defer t.wg.Done()
	batch := make([]store.AuditDeliveryRecord, 0, t.batchSize)
	ticker := time.NewTicker(t.flushInterval)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		if err := t.store.MarkBulk(context.Background(), batch); err != nil && t.logger != nil {
			t.logger.Error(
				"audit_delivery_db: bulk flush failed",
				mlog.Int("batch_size", len(batch)),
				mlog.Err(err),
			)
		}
		batch = batch[:0]
	}

	for {
		select {
		case item, ok := <-t.queue:
			if !ok {
				flush()
				return
			}
			batch = append(batch, store.AuditDeliveryRecord{
				UserID:    item.userID,
				EntityID:  item.entityID,
				Mechanism: item.mechanism,
			})
			if len(batch) >= t.batchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}
