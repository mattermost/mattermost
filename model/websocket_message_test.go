// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWebSocketEvent(t *testing.T) {
	userId := NewId()
	m := NewWebSocketEvent("some_event", NewId(), NewId(), userId, nil)
	m.Add("RootId", NewId())
	user := &User{
		Id: userId,
	}
	m.Add("user", user)
	json := m.ToJson()
	result := WebSocketEventFromJson(strings.NewReader(json))

	require.True(t, m.IsValid(), "should be valid")
	require.Equal(t, m.GetBroadcast().TeamId, result.GetBroadcast().TeamId, "Team ids do not match")
	require.Equal(t, m.GetData()["RootId"], result.GetData()["RootId"], "Root ids do not match")
	require.Equal(t, m.GetData()["user"].(*User).Id, result.GetData()["user"].(*User).Id, "User ids do not match")
}

func TestWebSocketEventImmutable(t *testing.T) {
	m := NewWebSocketEvent("some_event", NewId(), NewId(), NewId(), nil)

	new := m.SetEvent("new_event")
	if new == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.NotEqual(t, m.EventType(), new.EventType())
	require.Equal(t, new.EventType(), "new_event")

	new = m.SetSequence(45)
	if new == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.NotEqual(t, m.GetSequence(), new.GetSequence())
	require.Equal(t, new.GetSequence(), int64(45))

	broadcast := &WebsocketBroadcast{}
	new = m.SetBroadcast(broadcast)
	if new == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.NotEqual(t, m.GetBroadcast(), new.GetBroadcast())
	require.Equal(t, new.GetBroadcast(), broadcast)

	data := map[string]interface{}{
		"key":  "val",
		"key2": "val2",
	}
	new = m.SetData(data)
	if new == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.NotEqual(t, m, new)
	require.Equal(t, new.data, data)
	require.Equal(t, new.data, new.GetData())

	copy := m.Copy()
	if copy == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.Equal(t, m, copy)
}

func TestWebSocketEventFromJson(t *testing.T) {
	ev := WebSocketEventFromJson(strings.NewReader("junk"))
	require.Nil(t, ev, "should not have parsed")
	data := `{"event": "test", "data": {"key": "val"}, "seq": 45, "broadcast": {"user_id": "userid"}}`
	ev = WebSocketEventFromJson(strings.NewReader(data))
	require.NotNil(t, ev, "should have parsed")
	require.Equal(t, ev.EventType(), "test")
	require.Equal(t, ev.GetSequence(), int64(45))
	require.Equal(t, ev.data, map[string]interface{}{"key": "val"})
	require.Equal(t, ev.GetBroadcast(), &WebsocketBroadcast{UserId: "userid"})
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
	event := NewWebSocketEvent(WebsocketEventPosted, "foo", "bar", "baz", nil)
	event = event.SetSequence(7)

	before := event.ToJson()
	event.PrecomputeJSON()
	after := event.ToJson()

	assert.JSONEq(t, before, after)
}

var stringSink string

func BenchmarkWebSocketEvent_ToJson(b *testing.B) {
	event := NewWebSocketEvent(WebsocketEventPosted, "foo", "bar", "baz", nil)
	for i := 0; i < 100; i++ {
		event.GetData()[NewId()] = NewId()
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
