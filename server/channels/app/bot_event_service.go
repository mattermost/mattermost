// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	defaultBotEventRecheckInterval  = 2 * time.Second
	defaultBotEventMaxWaitersPerBot = 5
)

// botEventService tracks in-flight long-polls so that event producers can wake them.
type botEventService struct {
	settleWindow     time.Duration
	recheckInterval  time.Duration
	maxWaitersPerBot int

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
		settleWindow:     time.Duration(model.BotEventSettleWindowMillis) * time.Millisecond,
		recheckInterval:  defaultBotEventRecheckInterval,
		maxWaitersPerBot: defaultBotEventMaxWaitersPerBot,
		waiters:          map[string]map[*botEventWaiter]struct{}{},
		closed:           make(chan struct{}),
	}
}

// register returns false once the bot already has the maximum number of waiters on this node.
func (s *botEventService) register(botUserID string) (*botEventWaiter, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.waiters[botUserID]) >= s.maxWaitersPerBot {
		return nil, false
	}

	w := &botEventWaiter{botUserID: botUserID, wake: make(chan struct{}, 1)}
	if s.waiters[botUserID] == nil {
		s.waiters[botUserID] = map[*botEventWaiter]struct{}{}
	}
	s.waiters[botUserID][w] = struct{}{}
	return w, true
}

func (s *botEventService) unregister(w *botEventWaiter) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.waiters[w.botUserID], w)
	if len(s.waiters[w.botUserID]) == 0 {
		delete(s.waiters, w.botUserID)
	}
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

// notifyBotEventsAvailable is the single place that announces newly written events.
func (a *App) notifyBotEventsAvailable(botUserIDs []string) {
	a.Srv().botEvents.notify(botUserIDs...)
}
