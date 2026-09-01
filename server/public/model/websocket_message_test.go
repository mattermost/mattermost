// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWebSocketEvent(t *testing.T) {
	userId := NewId()
	m := NewWebSocketEvent("some_event", NewId(), NewId(), userId, nil, "")
	m.Add("RootId", NewId())
	user := &User{
		Id: userId,
	}
	m.Add("user", user)
	json, err := m.ToJSON()
	require.NoError(t, err)

	result, err := WebSocketEventFromJSON(bytes.NewReader(json))
	require.NoError(t, err)

	require.True(t, m.IsValid(), "should be valid")
	require.Equal(t, m.GetBroadcast().TeamId, result.GetBroadcast().TeamId, "Team ids do not match")
	require.Equal(t, m.GetData()["RootId"], result.GetData()["RootId"], "Root ids do not match")
	require.Equal(t, m.GetData()["user"].(*User).Id, result.GetData()["user"].(*User).Id, "User ids do not match")
}

func TestWebSocketEventImmutable(t *testing.T) {
	m := NewWebSocketEvent(WebsocketEventPostEdited, NewId(), NewId(), NewId(), nil, "")

	newM := m.SetEvent(WebsocketEventPostDeleted)
	if newM == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.NotEqual(t, m.EventType(), newM.EventType())
	require.Equal(t, newM.EventType(), WebsocketEventPostDeleted)

	newM = m.SetSequence(45)
	if newM == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.NotEqual(t, m.GetSequence(), newM.GetSequence())
	require.Equal(t, newM.GetSequence(), int64(45))

	broadcast := &WebsocketBroadcast{}
	newM = m.SetBroadcast(broadcast)
	if newM == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.NotEqual(t, m.GetBroadcast(), newM.GetBroadcast())
	require.Equal(t, newM.GetBroadcast(), broadcast)

	data := map[string]any{
		"key":  "val",
		"key2": "val2",
	}
	newM = m.SetData(data)
	if newM == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.NotEqual(t, m, newM)
	require.Equal(t, newM.data, data)
	require.Equal(t, newM.data, newM.GetData())

	mCopy := m.Copy()
	if mCopy == m {
		require.Fail(t, "pointers should not be the same")
	}
	require.Equal(t, m, mCopy)
}

func TestWebSocketEventFromJSON(t *testing.T) {
	ev, err := WebSocketEventFromJSON(bytes.NewReader([]byte("junk")))
	require.Error(t, err)
	require.Nil(t, ev, "should not have parsed")
	data := []byte(`{"event": "typing", "data": {"key": "val"}, "seq": 45, "broadcast": {"user_id": "userid"}}`)
	ev, err = WebSocketEventFromJSON(bytes.NewReader(data))
	require.NoError(t, err)
	require.NotNil(t, ev, "should have parsed")
	require.Equal(t, ev.EventType(), WebsocketEventTyping)
	require.Equal(t, ev.GetSequence(), int64(45))
	require.Equal(t, ev.data, map[string]any{"key": "val"})
	require.Equal(t, ev.GetBroadcast(), &WebsocketBroadcast{UserId: "userid"})
}

func TestWebSocketResponse(t *testing.T) {
	m := NewWebSocketResponse("OK", 1, map[string]any{})
	e := NewWebSocketError(1, &AppError{})
	m.Add("RootId", NewId())
	json, err := m.ToJSON()
	require.NoError(t, err)
	result, err := WebSocketResponseFromJSON(bytes.NewReader(json))
	require.NoError(t, err)
	json2, err := e.ToJSON()
	require.NoError(t, err)
	WebSocketResponseFromJSON(bytes.NewReader(json2))

	badresult, err := WebSocketResponseFromJSON(bytes.NewReader([]byte("junk")))
	require.Error(t, err)
	require.Nil(t, badresult, "should not have parsed")

	require.True(t, m.IsValid(), "should be valid")

	require.Equal(t, m.Data["RootId"], result.Data["RootId"], "Ids do not match")
}

func TestWebSocketEvent_PrecomputeJSON(t *testing.T) {
	event := NewWebSocketEvent(WebsocketEventPosted, "foo", "bar", "baz", nil, "")
	event = event.SetSequence(7)

	before, err := event.ToJSON()
	require.NoError(t, err)
	event.PrecomputeJSON()
	after, err := event.ToJSON()
	require.NoError(t, err)

	assert.Equal(t, before, after)
}

var stringSink []byte

func BenchmarkWebSocketEvent_ToJSON(b *testing.B) {
	event := NewWebSocketEvent(WebsocketEventPosted, "foo", "bar", "baz", nil, "")
	for range 100 {
		event.GetData()[NewId()] = NewId()
	}

	b.Run("SerializedNTimes", func(b *testing.B) {
		for b.Loop() {
			stringSink, _ = event.ToJSON()
		}
	})

	b.Run("PrecomputedNTimes", func(b *testing.B) {
		for b.Loop() {
			event.PrecomputeJSON()
		}
	})

	b.Run("PrecomputedAndSerializedNTimes", func(b *testing.B) {
		for b.Loop() {
			event.PrecomputeJSON()
			stringSink, _ = event.ToJSON()
		}
	})

	event.PrecomputeJSON()
	b.Run("PrecomputedOnceAndSerializedNTimes", func(b *testing.B) {
		for b.Loop() {
			stringSink, _ = event.ToJSON()
		}
	})
}

func TestWebsocketBroadcastCopy(t *testing.T) {
	w := &WebsocketBroadcast{}
	require.Equal(t, w, w.copy())

	w = nil
	require.Equal(t, w, w.copy())

	w = &WebsocketBroadcast{
		OmitUsers: map[string]bool{
			"aaa": true,
			"bbb": true,
			"ccc": false,
		},
		UserId:                "aaa",
		ChannelId:             "bbb",
		TeamId:                "ccc",
		ContainsSanitizedData: true,
		ContainsSensitiveData: true,
		RecordPostDelivery:    &PostDeliveryMarker{PostId: "ddd", ChannelId: "bbb", UserId: "eee"},
		RequiredPermissions:   []string{PermissionReadDataRetentionJob.Id},
	}
	wCopy := w.copy()
	require.Equal(t, w, wCopy)
	require.NotSame(t, &w.RequiredPermissions[0], &wCopy.RequiredPermissions[0])
}

func TestWebSocketEventWithoutRecordPostDelivery(t *testing.T) {
	t.Run("returns the same event when unmarked", func(t *testing.T) {
		ev := NewWebSocketEvent(WebsocketEventPosted, "team", "channel", "", nil, "")

		stripped, marker := ev.WithoutRecordPostDelivery()
		require.Nil(t, marker)
		require.Same(t, ev, stripped)
	})

	t.Run("strips the marker from a copy, leaving the original intact", func(t *testing.T) {
		ev := NewWebSocketEvent(WebsocketEventPosted, "team", "channel", "", nil, "")
		ev.GetBroadcast().RecordPostDelivery = &PostDeliveryMarker{
			PostId:    "post-id",
			ChannelId: "channel",
			UserId:    "author-id",
		}

		stripped, marker := ev.WithoutRecordPostDelivery()
		require.NotNil(t, marker)
		require.Equal(t, "post-id", marker.PostId)
		require.Equal(t, "channel", marker.ChannelId)
		require.Equal(t, "author-id", marker.UserId)

		require.Nil(t, stripped.GetBroadcast().RecordPostDelivery)
		// Publish serializes the original for the cluster after the local broadcast, so the
		// marker must survive on it.
		require.NotNil(t, ev.GetBroadcast().RecordPostDelivery)
	})

	t.Run("crosses the cluster wire", func(t *testing.T) {
		ev := NewWebSocketEvent(WebsocketEventPosted, "team", "channel", "", nil, "")
		ev.GetBroadcast().RecordPostDelivery = &PostDeliveryMarker{
			PostId:    "post-id",
			ChannelId: "channel",
			UserId:    "author-id",
		}

		data, err := ev.ToJSON()
		require.NoError(t, err)

		received, err := WebSocketEventFromJSON(bytes.NewReader(data))
		require.NoError(t, err)
		require.NotNil(t, received.GetBroadcast().RecordPostDelivery)
		require.Equal(t, "post-id", received.GetBroadcast().RecordPostDelivery.PostId)
	})

	t.Run("is absent from the client frame", func(t *testing.T) {
		ev := NewWebSocketEvent(WebsocketEventPosted, "team", "channel", "", nil, "")
		ev.GetBroadcast().RecordPostDelivery = &PostDeliveryMarker{PostId: "post-id"}

		stripped, _ := ev.WithoutRecordPostDelivery()
		data, err := stripped.PrecomputeJSON().ToJSON()
		require.NoError(t, err)
		require.NotContains(t, string(data), "record_post_delivery")
		require.NotContains(t, string(data), "post-id")
	})
}

func TestPrecomputedWebSocketEventJSONCopy(t *testing.T) {
	p := &precomputedWebSocketEventJSON{}
	require.Equal(t, p, p.copy())

	p = nil
	require.Equal(t, p, p.copy())

	p = &precomputedWebSocketEventJSON{
		Event:     []byte{},
		Data:      []byte{},
		Broadcast: []byte{},
	}
	require.Equal(t, p, p.copy())

	p = &precomputedWebSocketEventJSON{
		Event:     []byte{'a', 'b', 'c'},
		Data:      []byte{'d', 'e', 'f'},
		Broadcast: []byte{'g', 'h', 'i'},
	}
	require.Equal(t, p, p.copy())
}

func TestWebSocketEventDeepCopy(t *testing.T) {
	omitUsers := map[string]bool{
		"user1": true,
		"user2": false,
	}

	broadcast := &WebsocketBroadcast{
		OmitUsers:             omitUsers,
		UserId:                "aaa",
		ChannelId:             "bbb",
		TeamId:                "ccc",
		ContainsSanitizedData: true,
		ContainsSensitiveData: true,
		RequiredPermissions:   []string{PermissionReadDataRetentionJob.Id},
		OmitConnectionId:      "ddd",
	}

	ev := NewWebSocketEvent("test", "team", "channel", "user", omitUsers, "ddd")

	ev.Add("post", &Post{})
	ev = ev.SetBroadcast(broadcast)
	ev = ev.PrecomputeJSON()

	evCopy := ev.DeepCopy()
	require.Equal(t, ev, evCopy)
	AssertNotSameMap(t, ev.data, evCopy.data)
	require.NotSame(t, ev.broadcast, evCopy.broadcast)
	require.NotSame(t, &ev.broadcast.RequiredPermissions[0], &evCopy.broadcast.RequiredPermissions[0])
	require.NotSame(t, ev.precomputedJSON, evCopy.precomputedJSON)

	ev.Add("post", &Post{
		Id: "test",
	})
	require.NotEqual(t, ev.data, evCopy.data)
}

var err error

func BenchmarkEncodeJSON(b *testing.B) {
	message := NewWebSocketEvent(WebsocketEventUserAdded, "", "channelID", "", nil, "")
	message.Add("user_id", "userID")
	message.Add("team_id", "teamID")

	ev := message.PrecomputeJSON()

	var seq int64
	enc := json.NewEncoder(io.Discard)
	for b.Loop() {
		ev = ev.SetSequence(seq)
		err = ev.Encode(enc, io.Discard)
		seq++
	}
}
