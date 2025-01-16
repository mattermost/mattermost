// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package systembus

import (
	"context"
	"fmt"
	"sync"

	"github.com/ThreeDotsLabs/watermill"
	"github.com/pkg/errors"
	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/ThreeDotsLabs/watermill/pubsub/gochannel"
)

// SystemBus represents an in-memory message bus for system-wide events
type SystemBus struct {
	publisher   message.Publisher
	subscriber  message.Subscriber
	logger      watermill.LoggerAdapter
	mutex       sync.RWMutex
	topics      map[string]*TopicDefinition
}

// New creates a new SystemBus instance
func New() (*SystemBus, error) {
	logger := watermill.NewStdLogger(false, false)
	
	pubSub := gochannel.NewGoChannel(
		gochannel.Config{
			OutputChannelBuffer: 100,
		},
		logger,
	)

	return &SystemBus{
		publisher:   pubSub,
		subscriber:  pubSub,
		logger:      logger,
		topics:      make(map[string]*TopicDefinition),
	}, nil
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
func (b *SystemBus) Publish(topic string, payload []byte) error {
	b.mutex.RLock()
	topicDef, exists := b.topics[topic]
	b.mutex.RUnlock()

	if !exists {
		return fmt.Errorf("topic %q not registered", topic)
	}

	if err := topicDef.ValidatePayload(payload); err != nil {
		return fmt.Errorf("invalid payload for topic %q: %w", topic, err)
	}

	msg := message.NewMessage(watermill.NewUUID(), payload)
	return b.publisher.Publish(topic, msg)
}

// Subscribe creates a subscription for the specified topic
func (b *SystemBus) Subscribe(ctx context.Context, topic string) (<-chan *message.Message, error) {
	b.mutex.RLock()
	_, exists := b.topics[topic]
	b.mutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("topic %q not registered", topic)
	}

	return b.subscriber.Subscribe(ctx, topic)
}

// GetTopicDefinition returns the definition for a given topic
func (b *SystemBus) GetTopicDefinition(name string) (*TopicDefinition, error) {
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
	if err := b.publisher.Close(); err != nil {
		return err
	}
	return b.subscriber.Close()
}

// Topics returns a list of all registered topic definitions
func (b *SystemBus) Topics() []*TopicDefinition {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	topics := make([]*TopicDefinition, 0, len(b.topics))
	for _, def := range b.topics {
		topics = append(topics, def)
	}
	return topics
}
