// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package systembus

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/ThreeDotsLabs/watermill/pubsub/gochannel"
	watermillSQL "github.com/ThreeDotsLabs/watermill-sql/v3/pkg/sql"
	"github.com/pkg/errors"
)

// Config holds the configuration for SystemBus
type Config struct {
	// PostgreSQL configuration, if nil will use in-memory implementation
	PostgreSQL *PostgreSQLConfig
}

// PostgreSQLConfig holds PostgreSQL specific configuration
type PostgreSQLConfig struct {
	DB             *sql.DB // Database connection
	SchemaAdapter   watermillSQL.SchemaAdapter
	ConsumerGroup   string // Unique name for the consumer group
	AutoCreateTable bool   // Whether to create required tables automatically
}

// SystemBus represents an in-memory message bus for system-wide events
type SystemBus struct {
	publisher   message.Publisher
	subscriber  message.Subscriber
	logger      watermill.LoggerAdapter
	mutex       sync.RWMutex
	topics      map[string]*TopicDefinition
}

// New creates a new SystemBus instance
func New(config *Config, logger *mlog.Logger) (*SystemBus, error) {
	// TODO: Make logger optional via config when we add systembus settings
	wmLogger := newWatermillLoggerAdapter(logger)

	var publisher message.Publisher
	var subscriber message.Subscriber
	var err error

	if config != nil && config.PostgreSQL != nil {
		// PostgreSQL implementation
		publisher, err = watermillSQL.NewPublisher(
			config.PostgreSQL.DB,
			watermillSQL.PublisherConfig{
				SchemaAdapter: config.PostgreSQL.SchemaAdapter,
			},
			logger,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create PostgreSQL publisher: %w", err)
		}

		subscriber, err = watermillSQL.NewSubscriber(
			config.PostgreSQL.DB,
			watermillSQL.SubscriberConfig{
				SchemaAdapter:  config.PostgreSQL.SchemaAdapter,
				ConsumerGroup: config.PostgreSQL.ConsumerGroup,
			},
			logger,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create PostgreSQL subscriber: %w", err)
		}
	} else {
		// In-memory implementation using Go channels
		pubSub := gochannel.NewGoChannel(
			gochannel.Config{
				OutputChannelBuffer: 100,
			},
			logger,
		)
		publisher = pubSub
		subscriber = pubSub
	}

	return &SystemBus{
		publisher:   publisher,
		subscriber:  subscriber,
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
