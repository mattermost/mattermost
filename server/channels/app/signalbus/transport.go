// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package signalbus

import (
	"fmt"
	"slices"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
)

// signalEnvelope is one emitted signal, before it is matched to subscribers.
type signalEnvelope struct {
	ID                 string
	PublisherID        string
	Name               string
	Group              string
	Version            int
	Visibility         model.SignalVisibility
	AllowedSubscribers []string
	Payload            map[string]model.SignalValue
	TraceID            string
	Hop                int
	OriginUserID       string
	Cause              model.SignalCause
	EmittedAt          int64
}

func (e *signalEnvelope) fullName() string {
	return e.PublisherID + "/" + e.Name
}

func (e *signalEnvelope) isVisibleTo(subscriberID string) bool {
	return e.Visibility != model.SignalVisibilityAllowlist || slices.Contains(e.AllowedSubscribers, subscriberID)
}

// Implementations may deliver an envelope more than once; subscribers dedupe on ID.
type signalTransport interface {
	Publish(env *signalEnvelope) error
	Subscribe(consumer string, deliver func(*signalEnvelope)) (unsubscribe func(), err error)
}

// memoryTransport hands each envelope to every consumer on this node, synchronously. Consumers
// must not block.
type memoryTransport struct {
	mu        sync.RWMutex
	consumers map[string]func(*signalEnvelope)
}

func newMemoryTransport() *memoryTransport {
	return &memoryTransport{consumers: map[string]func(*signalEnvelope){}}
}

func (t *memoryTransport) Publish(env *signalEnvelope) error {
	t.mu.RLock()
	defer t.mu.RUnlock()
	for _, deliver := range t.consumers {
		deliver(env)
	}
	return nil
}

func (t *memoryTransport) Subscribe(consumer string, deliver func(*signalEnvelope)) (func(), error) {
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
