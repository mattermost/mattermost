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
