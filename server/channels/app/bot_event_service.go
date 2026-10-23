// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	defaultBotEventRecheckInterval = 2 * time.Second

	// botEventSettleMargin is added to the settle window before a poll looks again. The
	// database clock is rounded to milliseconds, so a read exactly one window after the
	// write can miss the event by a millisecond and would then wait for the next recheck.
	botEventSettleMargin = 50 * time.Millisecond
)

// botEventService tracks in-flight long-polls so that event producers can wake them.
type botEventService struct {
	settleWindow    time.Duration
	recheckInterval time.Duration

	mu        sync.Mutex
	waiters   map[string]map[*botEventWaiter]struct{}
	closed    chan struct{}
	closeOnce sync.Once
}

type botEventWaiter struct {
	botUserID string
	wake      chan struct{}
}

func newBotEventService() *botEventService {
	return &botEventService{
		settleWindow:    time.Duration(model.BotEventSettleWindowMillis) * time.Millisecond,
		recheckInterval: defaultBotEventRecheckInterval,
		waiters:         map[string]map[*botEventWaiter]struct{}{},
		closed:          make(chan struct{}),
	}
}

func (s *botEventService) register(botUserID string) *botEventWaiter {
	s.mu.Lock()
	defer s.mu.Unlock()

	w := &botEventWaiter{botUserID: botUserID, wake: make(chan struct{}, 1)}
	if s.waiters[botUserID] == nil {
		s.waiters[botUserID] = map[*botEventWaiter]struct{}{}
	}
	s.waiters[botUserID][w] = struct{}{}
	return w
}

func (s *botEventService) unregister(w *botEventWaiter) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.waiters[w.botUserID], w)
	if len(s.waiters[w.botUserID]) == 0 {
		delete(s.waiters, w.botUserID)
	}
}

func (s *botEventService) settleDelay() time.Duration {
	return s.settleWindow + botEventSettleMargin
}

func (s *botEventService) notify(botUserIDs ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, id := range botUserIDs {
		for w := range s.waiters[id] {
			select {
			case w.wake <- struct{}{}:
			default:
			}
		}
	}
}

func (s *botEventService) shutdown() {
	s.closeOnce.Do(func() { close(s.closed) })
}

// notifyBotEventsAvailable is the single place that announces newly written events: it
// wakes long-polls and the push dispatcher here and on the other nodes.
func (a *App) notifyBotEventsAvailable(botUserIDs []string) {
	if len(botUserIDs) == 0 {
		return
	}
	a.Srv().botEvents.notify(botUserIDs...)
	a.Srv().botEventDispatcher.Wake(botUserIDs...)
	a.Srv().publishBotEventsAvailable(botUserIDs)
}

// publishBotEventsAvailable is best effort: a lost message is covered by the long-poll
// recheck and the dispatcher sweep.
func (s *Server) publishBotEventsAvailable(botUserIDs []string) {
	cluster := s.platform.Cluster()
	if cluster == nil {
		return
	}
	data, err := json.Marshal(botUserIDs)
	if err != nil {
		s.Log().Warn("Failed to encode bot events available message", mlog.Err(err))
		return
	}
	cluster.SendClusterMessage(&model.ClusterMessage{
		Event:    model.ClusterEventBotEventsAvailable,
		SendType: model.ClusterSendBestEffort,
		Data:     data,
	})
}

func (s *Server) clusterBotEventsAvailableHandler(msg *model.ClusterMessage) {
	var botUserIDs []string
	if err := json.Unmarshal(msg.Data, &botUserIDs); err != nil {
		s.Log().Warn("Failed to decode bot events available message", mlog.Err(err))
		return
	}

	valid := botUserIDs[:0]
	for _, id := range botUserIDs {
		if model.IsValidId(id) {
			valid = append(valid, id)
		}
	}
	s.botEvents.notify(valid...)
	s.botEventDispatcher.Wake(valid...)
}
