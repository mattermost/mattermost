// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus

import (
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/invopop/jsonschema"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

type Event struct {
	Context   request.CTX // request information
	Topic     string      // topic name
	Message   any         // actual event data
	createAt  int64
	requestID string
}

type Handler func(ev Event) error

type EventType struct {
	Topic       string `json:"topic"`
	Description string `json:"description"`
	Schema      string `json:"schema,omitempty"`
}

type subscriber struct {
	id      string
	handler Handler
}

const STOPPING = 1

type BrokerService struct {
	queueLimit            int
	goroutineLimit        int
	onStopTimeout         time.Duration
	subscribers           map[string][]subscriber
	subscriberMutex       *sync.Mutex
	channel               chan Event
	eventTypes            map[string]EventType
	eventMutex            *sync.Mutex
	goroutineCount        int32
	eventCount            int32
	goroutineExitSignal   chan struct{}
	goroutineLimitChannel chan struct{}
	stopping              int32
	stoppedChannel        chan struct{}
}

func NewBroker(queueLimit, goroutineLimit int, onStopTimeout time.Duration) *BrokerService {
	return &BrokerService{
		queueLimit:            queueLimit,
		goroutineLimit:        goroutineLimit,
		onStopTimeout:         onStopTimeout,
		subscribers:           map[string][]subscriber{},
		subscriberMutex:       &sync.Mutex{},
		channel:               make(chan Event, queueLimit),
		eventMutex:            &sync.Mutex{},
		eventTypes:            map[string]EventType{},
		goroutineCount:        0,
		eventCount:            0,
		goroutineExitSignal:   make(chan struct{}, 1),
		goroutineLimitChannel: make(chan struct{}, goroutineLimit),
		stopping:              0,
		stoppedChannel:        make(chan struct{}, 1),
	}
}

func (b *BrokerService) Register(topic, description string, typ any) error {
	schema := jsonschema.Reflect(typ)
	buf, err := schema.MarshalJSON()
	if err != nil {
		return errors.Wrap(err, "can't register the topic")
	}

	evT := EventType{
		Topic:       topic,
		Description: description,
		Schema:      string(buf),
	}

	b.eventMutex.Lock()
	defer b.eventMutex.Unlock()
	b.eventTypes[topic] = evT
	return nil
}

func (b *BrokerService) EventTypes() []EventType {
	// there's really no race condition here, but we need this lock to pass race condition tests.
	b.eventMutex.Lock()
	types := make([]EventType, 0, len(b.eventTypes))
	for _, event := range b.eventTypes {
		types = append(types, event)
	}
	b.eventMutex.Unlock()

	sort.Slice(types, func(i, j int) bool {
		return types[i].Topic < types[j].Topic
	})
	return types
}

func (b *BrokerService) Publish(topic string, ctx request.CTX, data any) error {
	// no need for mutex since no race condition here
	// this is done not to receive events after Stop() was called
	// Since here we have not global mutex(for performance reasons) "couple of"
	// events might pass through even after calling Stop(), but it should be Ok.
	stopping := atomic.LoadInt32(&b.stopping) == STOPPING
	if stopping {
		return errors.New("event bus was stopped")
	}

	if !b.validTopic(topic) {
		return errors.New("topic does not exist")
	}

	ev := Event{
		Topic:     topic,
		Context:   ctx,
		Message:   data,
		createAt:  model.GetMillis(),
		requestID: ctx.RequestId(),
	}

	select {
	case b.channel <- ev:
		atomic.AddInt32(&b.eventCount, 1)
	case <-ctx.Context().Done():
		return nil
	}
	return nil
}

func (b *BrokerService) Subscribe(topic string, handler Handler) (string, error) {
	b.subscriberMutex.Lock()
	defer b.subscriberMutex.Unlock()

	if !b.validTopic(topic) {
		return "", errors.New("topic does not exist")
	}

	id := model.NewId()
	b.subscribers[topic] = append(b.subscribers[topic], subscriber{
		id:      id,
		handler: handler,
	})
	return id, nil
}

func (b *BrokerService) Unsubscribe(topic, id string) error {
	b.subscriberMutex.Lock()
	defer b.subscriberMutex.Unlock()

	if !b.validTopic(topic) {
		return errors.New("topic does not exist")
	}

	subscribers := b.subscribers[topic]
	for i, subscriber := range subscribers {
		if subscriber.id == id {
			newSubscribers := append(subscribers[:i], subscribers[i+1:]...)
			b.subscribers[topic] = newSubscribers
			return nil
		}
	}
	return errors.New("id was not found")
}

func (b *BrokerService) Start() {
	go b.runHandlers()
}

func (b *BrokerService) runHandlers() {
	for {
		// checks whether the event bus was stopped
		select {
		case <-b.stoppedChannel:
			return
		default:
		}

		ev := <-b.channel
		// there's really no race condition here, but we need this lock to pass race condition tests.
		b.subscriberMutex.Lock()
		for _, subscriber := range b.subscribers[ev.Topic] {
			handler := subscriber.handler
			b.runGoroutine(func() { handler(ev) })
		}
		b.subscriberMutex.Unlock()

		atomic.AddInt32(&b.eventCount, -1)
		select {
		case b.goroutineExitSignal <- struct{}{}:
		default:
		}
	}
}

// runGoroutine creates a goroutine, but maintains a record of it to ensure that execution completes before
// the server is shutdown.
func (b *BrokerService) runGoroutine(f func()) {
	b.goroutineLimitChannel <- struct{}{}
	atomic.AddInt32(&b.goroutineCount, 1)

	go func() {
		f()
		<-b.goroutineLimitChannel

		atomic.AddInt32(&b.goroutineCount, -1)
		select {
		case b.goroutineExitSignal <- struct{}{}:
		default:
		}
	}()
}

// Stop blocks until all goroutines created by runGoroutine are finish or exists
// when time is out.
func (b *BrokerService) Stop() error {
	atomic.StoreInt32(&b.stopping, STOPPING)
	done := make(chan struct{}, 1)
	go func() {
		// We are waiting for all goroutines to be finished and all published events to be handled
		for atomic.LoadInt32(&b.goroutineCount) != 0 || atomic.LoadInt32(&b.eventCount) != 0 {
			<-b.goroutineExitSignal
		}
		done <- struct{}{}
	}()

	select {
	case <-done:
		b.stoppedChannel <- struct{}{}
		return nil
	case <-time.After(b.onStopTimeout):
		return errors.Errorf("not able to finish all handlers in %d seconds", b.onStopTimeout)
	}
}

func (b *BrokerService) validTopic(topic string) bool {
	// there's really no race condition here, but we need this lock to pass race condition tests.
	b.eventMutex.Lock()
	defer b.eventMutex.Unlock()
	_, ok := b.eventTypes[topic]
	return ok
}
