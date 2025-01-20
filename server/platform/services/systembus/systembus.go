// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package systembus

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"reflect"
	"sync"

	"github.com/ThreeDotsLabs/watermill"
	watermillSQL "github.com/ThreeDotsLabs/watermill-sql/v3/pkg/sql"
	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/ThreeDotsLabs/watermill/pubsub/gochannel"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/pkg/errors"
)

type Event interface {
	Serialize() []byte
}

type Message struct {
	UUID     string
	Metadata map[string]string
	Payload  []byte
}

// SystemBus represents an in-memory message bus for system-wide events
type SystemBus struct {
	publisher     message.Publisher
	subscriber    message.Subscriber
	logger        watermill.LoggerAdapter
	mutex         sync.RWMutex
	topics        map[string]*TopicDefinition
	subscriptions map[string]*topicSubscription
}

// New creates a new SystemBus instance using postgres
func NewPostgres(db *sql.DB, logger *mlog.Logger) (*SystemBus, error) {
	wmLogger := newWatermillLoggerAdapter(logger)

	var publisher message.Publisher
	var subscriber message.Subscriber
	var err error

	if db == nil {
		return nil, errors.New("PostgreSQL configuration is required")
	}

	// PostgreSQL implementation
	publisher, err = watermillSQL.NewPublisher(
		db,
		watermillSQL.PublisherConfig{
			SchemaAdapter:        watermillSQL.DefaultPostgreSQLSchema{},
			AutoInitializeSchema: true,
		},
		wmLogger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create PostgreSQL publisher: %w", err)
	}

	subscriber, err = watermillSQL.NewSubscriber(
		db,
		watermillSQL.SubscriberConfig{
			SchemaAdapter:    watermillSQL.DefaultPostgreSQLSchema{},
			OffsetsAdapter:   watermillSQL.DefaultPostgreSQLOffsetsAdapter{},
			InitializeSchema: true,
			ConsumerGroup:    "mattermost",
		},
		wmLogger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create PostgreSQL subscriber: %w", err)
	}

	bus := &SystemBus{
		publisher:     publisher,
		subscriber:    subscriber,
		logger:        wmLogger,
		topics:        make(map[string]*TopicDefinition),
		subscriptions: make(map[string]*topicSubscription),
	}

	return bus, nil
}

// New creates a new SystemBus instance using a go channels
func NewGoChannel(logger *mlog.Logger) (*SystemBus, error) {
	wmLogger := newWatermillLoggerAdapter(logger)

	var publisher message.Publisher
	var subscriber message.Subscriber

	// In-memory implementation using Go channels
	pubSub := gochannel.NewGoChannel(
		gochannel.Config{
			OutputChannelBuffer: 100,
		},
		wmLogger,
	)
	publisher = pubSub
	subscriber = pubSub

	bus := &SystemBus{
		publisher:     publisher,
		subscriber:    subscriber,
		logger:        wmLogger,
		topics:        make(map[string]*TopicDefinition),
		subscriptions: make(map[string]*topicSubscription),
	}

	return bus, nil
}

// RegisterTopic adds a new topic with its schema and description
func (b *SystemBus) RegisterTopic(name, description string, schema json.RawMessage) error {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	if _, exists := b.topics[name]; exists {
		return errors.Errorf("topic %q already registered", name)
	}

	b.topics[name] = &TopicDefinition{
		Name:        name,
		Description: description,
		Schema:      schema,
	}

	return nil
}

// Publish sends a message to the specified topic
func (b *SystemBus) Publish(topic string, event Event) error {
	if b == nil {
		return nil
	}
	b.mutex.RLock()
	topicDef, exists := b.topics[topic]
	b.mutex.RUnlock()

	payload := event.Serialize()

	if !exists {
		return fmt.Errorf("topic %q not registered", topic)
	}

	if err := topicDef.ValidatePayload(payload); err != nil {
		return fmt.Errorf("invalid payload for topic %q: %w", topic, err)
	}

	msg := message.NewMessage(watermill.NewUUID(), payload)
	return b.publisher.Publish(topic, msg)
}

// MessageHandler is a callback function that processes messages for a topic
type MessageHandler func(msg *Message) error

type topicSubscription struct {
	msgs     <-chan *message.Message
	handlers map[uintptr]MessageHandler
	cancel   context.CancelFunc
}

// Subscribe registers a callback handler for the specified topic
func (b *SystemBus) Subscribe(topic string, handler MessageHandler) error {
	if b == nil {
		return nil
	}
	if handler == nil {
		return errors.New("handler cannot be nil")
	}

	b.mutex.Lock()
	defer b.mutex.Unlock()

	_, exists := b.topics[topic]
	if !exists {
		return fmt.Errorf("topic %q not registered", topic)
	}

	sub, exists := b.subscriptions[topic]
	if !exists {
		// Create cancellable context for this subscription
		subCtx, cancel := context.WithCancel(context.Background())

		// Create new subscription using the cancellable context
		msgs, err := b.subscriber.Subscribe(subCtx, topic)
		if err != nil {
			cancel() // Clean up the context if subscription fails
			return fmt.Errorf("failed to subscribe to topic %q: %w", topic, err)
		}
		sub = &topicSubscription{
			handlers: make(map[uintptr]MessageHandler),
			msgs:     msgs,
			cancel:   cancel,
		}
		b.subscriptions[topic] = sub

		// Start message processing goroutine
		go b.handleMessages(subCtx, topic, msgs)
	}

	// Add handler to subscription
	handlerPtr := reflect.ValueOf(handler).Pointer()
	sub.handlers[handlerPtr] = handler

	return nil
}

func (b *SystemBus) handleMessages(ctx context.Context, topic string, msgs <-chan *message.Message) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-msgs:
			if msg == nil {
				continue
			}

			b.mutex.RLock()
			sub, exists := b.subscriptions[topic]
			if !exists {
				b.mutex.RUnlock()
				msg.Ack()
				continue
			}

			// Copy handlers to avoid holding lock during execution
			handlers := make(map[uintptr]MessageHandler, len(sub.handlers))
			for k, v := range sub.handlers {
				handlers[k] = v
			}
			b.mutex.RUnlock()

			handlerMessage := &Message{
				UUID:     msg.UUID,
				Metadata: msg.Metadata,
				Payload:  msg.Payload,
			}

			// Execute all handlers
			for _, handler := range handlers {
				if err := handler(handlerMessage); err != nil {
					b.logger.Error("error executing message handler",
						err,
						watermill.LogFields{
							"topic": topic,
							"error": err.Error(),
						})
				}
			}
			msg.Ack()
		}
	}
}

// GetTopicDefinition returns the definition for a given topic
func (b *SystemBus) GetTopicDefinition(name string) (*TopicDefinition, error) {
	if b == nil {
		return nil, nil
	}

	b.mutex.RLock()
	defer b.mutex.RUnlock()

	def, exists := b.topics[name]
	if !exists {
		return nil, fmt.Errorf("topic %q not found", name)
	}

	return def, nil
}

// Close cleans up resources used by the system bus
func (b *SystemBus) Close() error {
	if b == nil {
		return nil
	}
	if err := b.publisher.Close(); err != nil {
		return err
	}
	return b.subscriber.Close()
}

// Unsubscribe removes a handler from the specified topic
func (b *SystemBus) Unsubscribe(topic string, handler MessageHandler) error {
	if b == nil {
		return nil
	}
	if handler == nil {
		return errors.New("handler cannot be nil")
	}

	b.mutex.Lock()
	defer b.mutex.Unlock()

	sub, exists := b.subscriptions[topic]
	if !exists {
		return fmt.Errorf("no subscriptions found for topic %q", topic)
	}

	handlerPtr := reflect.ValueOf(handler).Pointer()
	if _, exists := sub.handlers[handlerPtr]; !exists {
		return fmt.Errorf("handler not found for topic %q", topic)
	}

	delete(sub.handlers, handlerPtr)

	// If no handlers left, cancel the subscription and remove it
	if len(sub.handlers) == 0 {
		sub.cancel() // Signal the handler goroutine to stop
		delete(b.subscriptions, topic)
	}

	return nil
}

// Topics returns a list of all registered topic definitions
func (b *SystemBus) Topics() []*TopicDefinition {
	if b == nil {
		return nil
	}
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	topics := make([]*TopicDefinition, 0, len(b.topics))
	for _, def := range b.topics {
		topics = append(topics, def)
	}
	return topics
}
