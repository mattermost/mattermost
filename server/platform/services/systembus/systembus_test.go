// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package systembus

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/ThreeDotsLabs/watermill/message"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNew(t *testing.T) {
	t.Run("in-memory bus", func(t *testing.T) {
		bus, err := New(nil, nil)
		require.NoError(t, err)
		require.NotNil(t, bus)
		defer bus.Close()
	})
}

func TestRegisterTopic(t *testing.T) {
	bus, err := New(nil, nil)
	require.NoError(t, err)
	defer bus.Close()

	schema := json.RawMessage(`{"type": "object"}`)

	t.Run("register new topic", func(t *testing.T) {
		err := bus.RegisterTopic("test.topic", "Test topic", schema)
		require.NoError(t, err)

		def, err := bus.GetTopicDefinition("test.topic")
		require.NoError(t, err)
		assert.Equal(t, "test.topic", def.Name)
		assert.Equal(t, "Test topic", def.Description)
		assert.Equal(t, schema, def.Schema)
	})

	t.Run("duplicate topic", func(t *testing.T) {
		err := bus.RegisterTopic("test.topic", "Test topic", schema)
		require.Error(t, err)
	})
}

func TestPublishSubscribe(t *testing.T) {
	bus, err := New(nil, nil)
	require.NoError(t, err)
	defer bus.Close()

	schema := json.RawMessage(`{"type": "object"}`)
	err = bus.RegisterTopic("test.topic", "Test topic", schema)
	require.NoError(t, err)

	t.Run("publish to non-existent topic", func(t *testing.T) {
		err := bus.Publish("non.existent", []byte(`{}`))
		require.Error(t, err)
	})

	t.Run("subscribe to non-existent topic", func(t *testing.T) {
		_, err := bus.Subscribe(context.Background(), "non.existent")
		require.Error(t, err)
	})

	t.Run("publish and subscribe", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		messages, err := bus.Subscribe(ctx, "test.topic")
		require.NoError(t, err)

		payload := []byte(`{"test": "data"}`)
		err = bus.Publish("test.topic", payload)
		require.NoError(t, err)

		select {
		case msg := <-messages:
			assert.Equal(t, string(payload), string(msg.Payload))
		case <-ctx.Done():
			t.Fatal("timeout waiting for message")
		}
	})
}

func TestMultipleSubscribers(t *testing.T) {
	bus, err := New(nil, nil)
	require.NoError(t, err)
	defer bus.Close()

	schema := json.RawMessage(`{"type": "object"}`)
	err = bus.RegisterTopic("test.topic", "Test topic", schema)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Create multiple subscribers
	sub1, err := bus.Subscribe(ctx, "test.topic")
	require.NoError(t, err)
	sub2, err := bus.Subscribe(ctx, "test.topic")
	require.NoError(t, err)
	sub3, err := bus.Subscribe(ctx, "test.topic")
	require.NoError(t, err)

	// Send multiple messages
	messages := []string{
		`{"message": "first"}`,
		`{"message": "second"}`,
		`{"message": "third"}`,
	}

	for _, msg := range messages {
		err = bus.Publish("test.topic", []byte(msg))
		require.NoError(t, err)
	}

	// Helper function to receive messages with timeout
	receiveAll := func(ch <-chan *message.Message) []string {
		var received []string
		for i := 0; i < len(messages); i++ {
			select {
			case msg := <-ch:
				received = append(received, string(msg.Payload))
			case <-ctx.Done():
				t.Fatal("timeout waiting for messages")
			}
		}
		return received
	}

	// Verify each subscriber received all messages
	received1 := receiveAll(sub1)
	received2 := receiveAll(sub2)
	received3 := receiveAll(sub3)

	// Verify each subscriber got all messages
	assert.ElementsMatch(t, messages, received1)
	assert.ElementsMatch(t, messages, received2)
	assert.ElementsMatch(t, messages, received3)
}

func TestTopics(t *testing.T) {
	bus, err := New(nil, nil)
	require.NoError(t, err)
	defer bus.Close()

	schema := json.RawMessage(`{"type": "object"}`)

	topics := []struct {
		name        string
		description string
	}{
		{"topic.1", "First topic"},
		{"topic.2", "Second topic"},
	}

	for _, tt := range topics {
		err := bus.RegisterTopic(tt.name, tt.description, schema)
		require.NoError(t, err)
	}

	registeredTopics := bus.Topics()
	assert.Len(t, registeredTopics, len(topics))

	topicMap := make(map[string]*TopicDefinition)
	for _, topic := range registeredTopics {
		topicMap[topic.Name] = topic
	}

	for _, tt := range topics {
		topic, exists := topicMap[tt.name]
		assert.True(t, exists)
		assert.Equal(t, tt.description, topic.Description)
		assert.Equal(t, schema, topic.Schema)
	}
}
