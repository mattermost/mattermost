// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package signalbus

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type queuedDelivery struct {
	delivery *model.SignalDelivery
	// matched are the subscriptions as they were when the delivery was queued.
	matched []*model.SignalSubscription
}

// startingPollInterval is how often a worker checks whether its plugin has finished OnActivate.
const startingPollInterval = 50 * time.Millisecond

// queue holds one subscriber's pending deliveries. A single worker delivers them in order.
type queue struct {
	pluginID string
	ch       chan *queuedDelivery
	stop     chan struct{}
	stopOnce sync.Once
	done     chan struct{}
}

// newQueue starts the worker. If prev is set, the worker waits for prev's worker to exit first,
// so a plugin never has two deliveries in progress at once, even across re-subscription.
func newQueue(pluginID string, size int, prev *queue, handle func(q *queue, qd *queuedDelivery)) *queue {
	q := &queue{
		pluginID: pluginID,
		ch:       make(chan *queuedDelivery, size),
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
	}
	go q.run(prev, handle)
	return q
}

func (q *queue) run(prev *queue, handle func(q *queue, qd *queuedDelivery)) {
	defer close(q.done)
	if prev != nil {
		select {
		case <-prev.done:
		case <-q.stop:
			return
		}
	}
	for {
		select {
		case <-q.stop:
			return
		case qd := <-q.ch:
			select {
			case <-q.stop:
				return
			default:
			}
			handle(q, qd)
		}
	}
}

// enqueue adds the delivery without blocking and reports whether there was room.
func (q *queue) enqueue(qd *queuedDelivery) bool {
	select {
	case q.ch <- qd:
		return true
	default:
		return false
	}
}

// close stops the worker and discards pending deliveries. It doesn't wait for a delivery in
// progress, which may be the subscriber's own call back into the bus; a queue created after it
// waits instead.
func (q *queue) close() {
	q.stopOnce.Do(func() { close(q.stop) })
}

// waitUntilStarted holds the worker while the plugin's OnActivate is still running, since its
// hooks can't be called until then. It returns false if the queue is closed meanwhile.
func (b *Bus) waitUntilStarted(q *queue) bool {
	if !b.hooks.IsStarting(q.pluginID) {
		return true
	}
	ticker := time.NewTicker(startingPollInterval)
	defer ticker.Stop()
	for b.hooks.IsStarting(q.pluginID) {
		select {
		case <-q.stop:
			return false
		case <-ticker.C:
		}
	}
	return true
}

// deliver runs on the subscriber's worker.
func (b *Bus) deliver(q *queue, qd *queuedDelivery) {
	pluginID := q.pluginID
	d := *qd.delivery
	logFields := []mlog.Field{
		mlog.String("subscriber", pluginID),
		mlog.String("signal", d.Signal),
		mlog.String("delivery_id", d.ID),
	}

	if !b.isEnabled() {
		b.logger.Debug("Dropped signal delivery because the signal bus is disabled", logFields...)
		return
	}

	if !b.waitUntilStarted(q) {
		b.logger.Debug("Dropped signal delivery because the subscriber stopped while starting", logFields...)
		return
	}

	d.SubscriptionIDs = b.subs.current(pluginID, qd.matched)
	if len(d.SubscriptionIDs) == 0 {
		b.logger.Debug("Dropped signal delivery because its subscriptions were removed", logFields...)
		return
	}

	if !b.hooks.IsActive(pluginID) {
		b.logger.Debug("Dropped signal delivery because the subscriber is not active", logFields...)
		return
	}

	if err := b.hooks.OnSignal(pluginID, &d); err != nil {
		b.logger.Warn("Failed to deliver signal", append(logFields, mlog.Err(err))...)
	}
}
