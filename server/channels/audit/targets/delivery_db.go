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

const DeliveryDBTargetType = "audit_delivery_db"

const (
	deliveryQueueSize     = 10000
	deliveryBatchSize     = 1000
	deliveryFlushInterval = 100 * time.Millisecond
	deliveryWorkers       = 4
)

func init() {
	mlog.ValidationFactories = &mlog.Factories{
		TargetFactory: func(targetType string, _ json.RawMessage) (logr.Target, error) {
			if strings.ToLower(targetType) == DeliveryDBTargetType {
				return &DeliveryDBTarget{}, nil
			}
			return nil, fmt.Errorf("unrecognized target type %q", targetType)
		},
		// Config validation resolves the formatter too, so the "noop" format
		// name must be recognized here as well or IsValid rejects the config.
		FormatterFactory: func(format string, _ json.RawMessage) (logr.Formatter, error) {
			if strings.ToLower(format) == DeliveryNoopFormat {
				return NoopFormatter{}, nil
			}
			return nil, fmt.Errorf("unrecognized formatter %q", format)
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

	queueSize     int
	batchSize     int
	flushInterval time.Duration
	workers       int

	queue   chan auditDeliveryItem
	wg      sync.WaitGroup
	stopped atomic.Bool
}

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

	t.logBlocked()
	t.queue <- item
	return len(p), nil
}

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

func (t *DeliveryDBTarget) logBlocked() {
	if t.logger == nil {
		return
	}

	t.logger.Warn(
		"audit_delivery_db: queue full, Write blocked",
		mlog.Int("queue_size", t.queueSize),
		mlog.Int("queue_len", len(t.queue)),
	)
}

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
