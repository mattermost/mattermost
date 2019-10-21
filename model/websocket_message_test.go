// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWebSocketEvent(t *testing.T) {
	m := NewWebSocketEvent("some_event", NewId(), NewId(), NewId(), nil)
	m.Add("RootId", NewId())
	json := m.ToJson()
	result := WebSocketEventFromJson(strings.NewReader(json))

	badresult := WebSocketEventFromJson(strings.NewReader("junk"))
	require.Nil(t, badresult, "should not have parsed")

	require.True(t, m.IsValid(), "should be valid")

	require.Equal(t, m.Broadcast.TeamId, result.Broadcast.TeamId, "Ids do not match")

	require.Equal(t, m.Data["RootId"], result.Data["RootId"], "Ids do not match")
}

func TestWebSocketResponse(t *testing.T) {
	m := NewWebSocketResponse("OK", 1, map[string]interface{}{})
	e := NewWebSocketError(1, &AppError{})
	m.Add("RootId", NewId())
	json := m.ToJson()
	result := WebSocketResponseFromJson(strings.NewReader(json))
	json2 := e.ToJson()
	WebSocketResponseFromJson(strings.NewReader(json2))

	badresult := WebSocketResponseFromJson(strings.NewReader("junk"))
	require.Nil(t, badresult, "should not have parsed")

	require.True(t, m.IsValid(), "should be valid")

	require.Equal(t, m.Data["RootId"], result.Data["RootId"], "Ids do not match")
}

func TestWebSocketEvent_PrecomputeJSON(t *testing.T) {
	event := NewWebSocketEvent(WEBSOCKET_EVENT_POSTED, "foo", "bar", "baz", nil)
	event.Sequence = 7

	before := event.ToJson()
	event.PrecomputeJSON()
	after := event.ToJson()

	assert.JSONEq(t, before, after)
}

var stringSink string

func BenchmarkWebSocketEvent_ToJson(b *testing.B) {
	event := NewWebSocketEvent(WEBSOCKET_EVENT_POSTED, "foo", "bar", "baz", nil)
	for i := 0; i < 100; i++ {
		event.Data[NewId()] = NewId()
	}

	b.Run("SerializedNTimes", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			stringSink = event.ToJson()
		}
	})

	b.Run("PrecomputedNTimes", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			event.PrecomputeJSON()
		}
	})

	b.Run("PrecomputedAndSerializedNTimes", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			event.PrecomputeJSON()
			stringSink = event.ToJson()
		}
	})

	event.PrecomputeJSON()
	b.Run("PrecomputedOnceAndSerializedNTimes", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			stringSink = event.ToJson()
		}
	})
}
