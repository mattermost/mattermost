// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMarshalAQ(t *testing.T) {
	ps := PlatformService{}
	events := []model.WebSocketMessage{
		model.NewWebSocketEvent(model.WebsocketEventPosted, "t1", "c1", "u1", nil, ""),
		model.NewWebSocketEvent(model.WebsocketEventReactionAdded, "t2", "c1", "u1", nil, ""),
		model.NewWebSocketEvent(model.WebsocketEventReactionRemoved, "t3", "c1", "u1", nil, ""),
		model.NewWebSocketResponse("hi", 10, nil),
	}

	aq := make(chan model.WebSocketMessage, 10)
	for _, ev := range events {
		aq <- ev
	}
	close(aq)

	queue, err := ps.marshalAQ(aq, "connID", "u1")
	require.NoError(t, err)
	assert.Len(t, queue, 4)

	var gotEvents []model.WebSocketMessage
	for _, item := range queue {
		msg, err := ps.UnmarshalAQItem(item)
		require.NoError(t, err)
		gotEvents = append(gotEvents, msg)
	}

	assert.Equal(t, events, gotEvents)
}

func TestMarshalDQ(t *testing.T) {
	ps := PlatformService{}

	// Nothing in case of dead queue is empty
	got, err := ps.marshalDQ([]*model.WebSocketEvent{}, 0, 0)
	require.NoError(t, err)
	require.Nil(t, got)

	events := []*model.WebSocketEvent{
		model.NewWebSocketEvent(model.WebsocketEventPosted, "t1", "c1", "u1", nil, ""),
		model.NewWebSocketEvent(model.WebsocketEventReactionAdded, "t2", "c1", "u1", nil, "").SetSequence(1),
		model.NewWebSocketEvent(model.WebsocketEventReactionRemoved, "t3", "c1", "u1", nil, "").SetSequence(2),
		nil,
		nil,
	}

	got, err = ps.marshalDQ(events, 0, 3)
	require.NoError(t, err)
	require.Len(t, got, 3)

	gotEvents, dqPtr, err := ps.UnmarshalDQ(got)
	require.NoError(t, err)
	assert.Equal(t, 3, dqPtr)
	assert.Equal(t, events[:3], gotEvents[:3])
}

func TestUnmarshalDQFullBuffer(t *testing.T) {
	ps := PlatformService{}

	t.Run("dq full", func(t *testing.T) {
		// Create exactly deadQueueSize events
		events := make([]*model.WebSocketEvent, deadQueueSize)
		for i := 0; i < deadQueueSize; i++ {
			events[i] = model.NewWebSocketEvent(model.WebsocketEventPosted, "t1", "c1", "u1", nil, "").SetSequence(int64(i))
		}

		// Set up a scenario where the buffer is already filled and has wrapped around
		// Use index 0 and simulate that the dqPtr has wrapped around to 0 again
		got, err := ps.marshalDQ(events, 0, 0)
		require.NoError(t, err)
		require.Len(t, got, deadQueueSize)

		// Unmarshal the full buffer back
		gotEvents, dqPtr, err := ps.UnmarshalDQ(got)
		require.NoError(t, err)

		// Check that dqPtr wraps around to 0, not deadQueueSize
		assert.Equal(t, 0, dqPtr, "dqPtr should be 0 for a full buffer (deadQueueSize % deadQueueSize = 0)")

		// Verify all events were unmarshaled correctly
		assert.Equal(t, events, gotEvents)
	})

	t.Run("dq rollover", func(t *testing.T) {
		// Alternative test: Create a simulation of the circular buffer behavior
		// This test fills up to the max and ensures wraparound works correctly
		events := make([]*model.WebSocketEvent, deadQueueSize)
		for i := 0; i < deadQueueSize; i++ {
			// Create events with sequence numbers that show wraparound
			// Last event will have highest sequence to demonstrate the break condition
			// Seq nos: 100 - 228
			events[i] = model.NewWebSocketEvent(model.WebsocketEventPosted, "t1", "c1", "u1", nil, "").SetSequence(int64(i + 100))
		}

		// Marshal only the last entry wrapping to the first to test wraparound detection
		got2, err := ps.marshalDQ(events, deadQueueSize-1, 0)
		require.NoError(t, err)
		require.Len(t, got2, 1) // Just the last element

		// Unmarshal this single element
		gotEvents2, dqPtr2, err := ps.UnmarshalDQ(got2)
		require.NoError(t, err)
		assert.Equal(t, 1, dqPtr2, "dqPtr should be 1 for a 1-element buffer (1 % deadQueueSize = 1)")
		assert.Equal(t, events[deadQueueSize-1], gotEvents2[0])
	})
}
