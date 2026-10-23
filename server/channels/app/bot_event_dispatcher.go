// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	botEventMaxConcurrentBots = 8
	botEventMaxEventsPerTurn  = 100
	botEventLeaseDuration     = 30 * time.Second // must stay well above 2 × BotEventMaxRequestTimeout
	botEventSweepInterval     = 10 * time.Second
	botEventSweepLimit        = 1000
	botEventMaxResponseBytes  = 64 * 1024
)

var botEventBackoffSchedule = []time.Duration{5 * time.Second, 30 * time.Second, 2 * time.Minute, 10 * time.Minute, 30 * time.Minute, time.Hour}

// botEventDispatcher pushes events to callback URLs. Events are strictly ordered per bot:
// one in-flight request per bot, guarded within a node by `active` and across nodes by a
// lease row in the database. Retries come from the periodic sweep, not from timers.
type botEventDispatcher struct {
	srv    *Server
	nodeID string
	logger mlog.LoggerIFace
	client *http.Client
	sem    chan struct{}

	// Tests may override these before start().
	now           func() time.Time
	leaseDuration time.Duration
	sweepInterval time.Duration
	settleWindow  time.Duration
	backoff       []time.Duration

	mu       sync.Mutex
	started  bool
	stopping bool
	active   map[string]bool // bot id -> another kick arrived while its turn was running
	ctx      context.Context // parent of outbound requests; cancelled by stop
	cancel   context.CancelFunc
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

func newBotEventDispatcher(srv *Server) *botEventDispatcher {
	nodeID := model.NewId()
	return &botEventDispatcher{
		srv:           srv,
		nodeID:        nodeID,
		logger:        srv.Log().With(mlog.String("component", "bot_event_dispatcher"), mlog.String("node_id", nodeID)),
		client:        srv.botEventClient,
		sem:           make(chan struct{}, botEventMaxConcurrentBots),
		now:           time.Now,
		leaseDuration: botEventLeaseDuration,
		sweepInterval: botEventSweepInterval,
		settleWindow:  time.Duration(model.BotEventSettleWindowMillis) * time.Millisecond,
		backoff:       botEventBackoffSchedule,
		active:        map[string]bool{},
	}
}

func (d *botEventDispatcher) app() *App {
	return New(ServerConnector(d.srv.Channels()))
}

func (d *botEventDispatcher) requestTimeout() time.Duration {
	timeout := time.Duration(*d.srv.platform.Config().ServiceSettings.OutgoingIntegrationRequestsTimeout) * time.Second
	return min(timeout, model.BotEventMaxRequestTimeout)
}

func (d *botEventDispatcher) isStopping() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.stopping
}

func (d *botEventDispatcher) start() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.started || d.stopping {
		return
	}
	d.started = true
	d.ctx, d.cancel = context.WithCancel(d.srv.Platform().GoContext())
	d.stopCh = make(chan struct{})

	d.wg.Add(1)
	go d.sweepLoop()
	d.logger.Info("Bot event dispatcher started")
}

// stop aborts in-flight requests and waits for every turn to release its lease.
func (d *botEventDispatcher) stop() {
	d.mu.Lock()
	if !d.started || d.stopping {
		d.mu.Unlock()
		return
	}
	d.stopping = true
	close(d.stopCh)
	d.cancel()
	d.mu.Unlock()

	d.wg.Wait()
}

func (d *botEventDispatcher) sweepLoop() {
	defer d.wg.Done()

	d.sweepOnce()
	ticker := time.NewTicker(d.sweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-d.stopCh:
			return
		case <-ticker.C:
			d.sweepOnce()
		}
	}
}

// Wake schedules delivery for the bots once their new events have settled. It does no
// I/O because it runs inside CreatePost.
func (d *botEventDispatcher) Wake(botUserIDs ...string) {
	d.mu.Lock()
	running := d.started && !d.stopping
	d.mu.Unlock()
	if !running {
		return
	}

	time.AfterFunc(d.settleWindow+100*time.Millisecond, func() {
		for _, id := range botUserIDs {
			d.kick(id)
		}
	})
}

// kick runs turns for the bot on one goroutine per bot, coalescing repeat kicks.
func (d *botEventDispatcher) kick(botUserID string) {
	d.mu.Lock()
	if !d.started || d.stopping {
		d.mu.Unlock()
		return
	}
	if _, running := d.active[botUserID]; running {
		d.active[botUserID] = true
		d.mu.Unlock()
		return
	}
	d.active[botUserID] = false
	d.wg.Add(1)
	d.mu.Unlock()

	go func() {
		defer d.wg.Done()
		for {
			d.sem <- struct{}{}
			more := d.runTurnRecovered(botUserID)
			<-d.sem

			d.mu.Lock()
			again := d.active[botUserID]
			if !d.stopping && (more || again) {
				d.active[botUserID] = false
				d.mu.Unlock()
				continue
			}
			delete(d.active, botUserID)
			d.mu.Unlock()
			return
		}
	}()
}

func (d *botEventDispatcher) runTurnRecovered(botUserID string) (more bool) {
	defer func() {
		if r := recover(); r != nil {
			d.logger.Error("Bot event delivery panicked", mlog.String("bot_user_id", botUserID), mlog.String("panic", fmt.Sprint(r)))
			more = false
		}
	}()
	return d.runTurn(botUserID)
}

func (d *botEventDispatcher) sweepOnce() {
	rctx := request.EmptyContext(d.logger)
	ids, err := d.srv.Store().BotEventSubscription().GetPushDeliveryCandidates(rctx, d.now().UnixMilli(), d.settleWindow.Milliseconds(), botEventSweepLimit)
	if err != nil {
		d.logger.Warn("Failed to list bot event delivery candidates", mlog.Err(err))
		return
	}
	for _, id := range ids {
		d.kick(id)
	}
}

// runTurn delivers up to botEventMaxEventsPerTurn events, one request at a time. The lease is
// renewed before each event, which also returns the current URL, secret and ack cursor. It
// reports whether the cap was reached with events possibly remaining.
func (d *botEventDispatcher) runTurn(botUserID string) (more bool) {
	// Writes use a background context so that a 2xx that just arrived is still acknowledged during stop.
	rctx := request.EmptyContext(d.logger.With(mlog.String("bot_user_id", botUserID)))
	subs := d.srv.Store().BotEventSubscription()
	defer func() {
		if err := subs.ReleaseLease(rctx, botUserID, d.nodeID); err != nil {
			rctx.Logger().Warn("Failed to release bot event lease", mlog.Err(err))
		}
	}()

	for range botEventMaxEventsPerTurn {
		if d.isStopping() {
			return false
		}

		sub, err := subs.ClaimForDelivery(rctx, botUserID, d.nodeID, d.leaseDuration.Milliseconds(), d.now().UnixMilli())
		if err != nil {
			rctx.Logger().Warn("Failed to claim bot event subscription", mlog.Err(err))
			return false
		}
		if sub == nil {
			return false
		}

		events, err := d.srv.Store().BotEvent().GetAfterCursor(rctx, botUserID, sub.AckCursor(), d.settleWindow.Milliseconds(), 1)
		if err != nil {
			rctx.Logger().Warn("Failed to read bot events for delivery", mlog.Err(err))
			return false
		}
		if len(events) == 0 {
			return false
		}
		event := events[0]

		env, err := event.ToEnvelope()
		if err != nil {
			rctx.Logger().Error("Skipping undeliverable bot event", mlog.String("event_id", event.Id), mlog.Err(err))
			if err := subs.RecordDeliverySuccess(rctx, botUserID, event.Cursor(), d.now().UnixMilli()); err != nil {
				rctx.Logger().Warn("Failed to acknowledge a skipped bot event", mlog.Err(err))
				return false
			}
			continue
		}

		outcome := d.deliver(sub, env)
		switch outcome.kind {
		case botEventDelivered:
			if err := subs.RecordDeliverySuccess(rctx, botUserID, event.Cursor(), d.now().UnixMilli()); err != nil {
				rctx.Logger().Warn("Failed to acknowledge a delivered bot event", mlog.String("event_id", event.Id), mlog.Err(err))
				return false
			}
		case botEventAborted:
			return false
		case botEventRetry, botEventGone:
			d.recordFailure(rctx, sub, event.Id, outcome)
			return false
		}
	}
	return true
}
