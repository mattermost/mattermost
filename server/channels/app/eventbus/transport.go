// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus

import (
	"fmt"
	"slices"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
)

// eventEnvelope is one emitted event, before it is matched to subscribers.
type eventEnvelope struct {
	ID                 string
	PublisherID        string
	Name               string
	Group              string
	Version            int
	Visibility         model.EventVisibility
	AllowedSubscribers []string
	Payload            map[string]model.EventValue
	TraceID            string
	Hop                int
	OriginUserID       string
	Cause              model.EventCause
	EmittedAt          int64
}

func (e *eventEnvelope) fullName() string {
	return e.PublisherID + "/" + e.Name
}

func (e *eventEnvelope) isVisibleTo(subscriberID string) bool {
	return e.Visibility != model.EventVisibilityAllowlist || slices.Contains(e.AllowedSubscribers, subscriberID)
}

// Implementations may deliver an envelope more than once; subscribers dedupe on ID.
type eventTransport interface {
	Publish(env *eventEnvelope) error
	Subscribe(consumer string, deliver func(*eventEnvelope)) (unsubscribe func(), err error)
}

// memoryTransport hands each envelope to every consumer on this node, synchronously. Consumers
// must not block.
type memoryTransport struct {
	mu        sync.RWMutex
	consumers map[string]func(*eventEnvelope)
}

func newMemoryTransport() *memoryTransport {
	return &memoryTransport{consumers: map[string]func(*eventEnvelope){}}
}

func (t *memoryTransport) Publish(env *eventEnvelope) error {
	t.mu.RLock()
	defer t.mu.RUnlock()
	for _, deliver := range t.consumers {
		deliver(env)
	}
	return nil
}

func (t *memoryTransport) Subscribe(consumer string, deliver func(*eventEnvelope)) (func(), error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if _, ok := t.consumers[consumer]; ok {
		return nil, fmt.Errorf("consumer %q is already subscribed", consumer)
	}
	t.consumers[consumer] = deliver
	return func() {
		t.mu.Lock()
		defer t.mu.Unlock()
		delete(t.consumers, consumer)
	}, nil
}
