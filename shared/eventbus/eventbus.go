// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus

import (
	"sync"

	"github.com/invopop/jsonschema"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

type Event struct {
	Context request.CTX // request information
	Topic   string      // topic name
	Message any         // actual event data
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

type BrokerService struct {
	queueLimit      int
	goroutineLimit  int
	subscribers     map[string][]subscriber
	subscriberMutex *sync.Mutex
	channel         chan Event
	eventTypes      map[string]EventType
	eventMutex      *sync.Mutex
}

func NewBroker(queueLimit, goroutineLimit int) *BrokerService {
	return &BrokerService{
		queueLimit:      queueLimit,
		goroutineLimit:  goroutineLimit,
		subscribers:     map[string][]subscriber{},
		subscriberMutex: &sync.Mutex{},
		channel:         make(chan Event, queueLimit),
		eventMutex:      &sync.Mutex{},
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
	types := make([]EventType, 0, len(b.eventTypes))
	for _, event := range b.eventTypes {
		types = append(types, event)
	}
	return types
}

func (b *BrokerService) Publish(topic string, ctx request.CTX, data any) error {
	if _, ok := b.eventTypes[topic]; !ok {
		return errors.New("topic does not exist")
	}
	ev := Event{
		Topic:   topic,
		Context: ctx,
		Message: data,
	}

	// run async not to block a caller
	go func() {
		b.channel <- ev
	}()
	return nil
}

func (b *BrokerService) Subscribe(topic string, handler Handler) (string, error) {
	b.subscriberMutex.Lock()
	defer b.subscriberMutex.Unlock()

	if _, ok := b.eventTypes[topic]; !ok {
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

	if _, ok := b.eventTypes[topic]; !ok {
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
		ev := <-b.channel
		for _, subscriber := range b.subscribers[ev.Topic] {
			go subscriber.handler(ev)
		}
	}
}
