// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package systembus

import (
	"context"
	"sync"

	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/ThreeDotsLabs/watermill/pubsub/gochannel"
)

// SystemBus represents an in-memory message bus for system-wide events
type SystemBus struct {
	publisher  message.Publisher
	subscriber message.Subscriber
	logger     watermill.LoggerAdapter
	mutex      sync.RWMutex
	topics     map[string]struct{}
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
		publisher:  pubSub,
		subscriber: pubSub,
		logger:     logger,
		topics:     make(map[string]struct{}),
	}, nil
}

// Publish sends a message to the specified topic
func (b *SystemBus) Publish(topic string, payload []byte) error {
	msg := message.NewMessage(watermill.NewUUID(), payload)
	return b.publisher.Publish(topic, msg)
}

// Subscribe creates a subscription for the specified topic
func (b *SystemBus) Subscribe(ctx context.Context, topic string) (<-chan *message.Message, error) {
	b.mutex.Lock()
	b.topics[topic] = struct{}{}
	b.mutex.Unlock()

	return b.subscriber.Subscribe(ctx, topic)
}

// Close cleans up resources used by the system bus
func (b *SystemBus) Close() error {
	if err := b.publisher.Close(); err != nil {
		return err
	}
	return b.subscriber.Close()
}

// Topics returns a list of all active topics
func (b *SystemBus) Topics() []string {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	topics := make([]string, 0, len(b.topics))
	for topic := range b.topics {
		topics = append(topics, topic)
	}
	return topics
}
