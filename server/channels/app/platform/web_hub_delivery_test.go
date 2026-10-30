// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// deliveryRecorderSpy collects the (marker, userID) pairs the hub hands to the recorder.
type deliveryRecorderSpy struct {
	calls []deliveryRecorderCall
}

type deliveryRecorderCall struct {
	marker *model.PostDeliveryMarker
	userID string
}

func (s *deliveryRecorderSpy) record(marker *model.PostDeliveryMarker, userID string) {
	s.calls = append(s.calls, deliveryRecorderCall{marker: marker, userID: userID})
}

// newDeliveryTestConn builds an authenticated WebConn with a send buffer of the given size,
// registered in connIndex.
func newDeliveryTestConn(t *testing.T, th *TestHelper, connIndex *hubConnectionIndex, userID string, sendBuffer int) *WebConn {
	t.Helper()

	wc := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   userID,
		send:     make(chan model.WebSocketMessage, sendBuffer),
	}
	wc.SetConnectionID(model.NewId())
	wc.SetSession(&model.Session{UserId: userID})
	wc.Active.Store(true)
	wc.SetSessionExpiresAt(model.GetMillis() + 100000)
	require.NoError(t, connIndex.Add(wc))

	return wc
}

func TestHubBroadcastDelivery(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	marker := &model.PostDeliveryMarker{
		PostId:    model.NewId(),
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	// Addressed to the recipient directly, so ShouldSendEvent resolves without needing
	// channel membership plumbed into the index.
	newEvent := func() *model.WebSocketEvent {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", th.BasicUser2.Id, nil, "")
		event.Add("post", "{}")
		return event
	}

	t.Run("records when the event is enqueued", func(t *testing.T) {
		spy := &deliveryRecorderSpy{}
		th.Service.SetPostDeliveryRecorder(spy.record)
		t.Cleanup(func() { th.Service.SetPostDeliveryRecorder(nil) })

		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
		wc := newDeliveryTestConn(t, th, connIndex, th.BasicUser2.Id, 1)

		hub := th.Service.GetHubForUserId(th.BasicUser2.Id)
		deliver(hub, connIndex, wc, newEvent(), marker)

		require.Len(t, spy.calls, 1)
		require.Equal(t, marker, spy.calls[0].marker)
		require.Equal(t, th.BasicUser2.Id, spy.calls[0].userID)
		require.Len(t, wc.send, 1)
	})

	t.Run("records nothing when the connection is not registered", func(t *testing.T) {
		spy := &deliveryRecorderSpy{}
		th.Service.SetPostDeliveryRecorder(spy.record)
		t.Cleanup(func() { th.Service.SetPostDeliveryRecorder(nil) })

		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
		wc := newDeliveryTestConn(t, th, connIndex, th.BasicUser2.Id, 1)
		connIndex.Remove(wc)

		hub := th.Service.GetHubForUserId(th.BasicUser2.Id)
		deliver(hub, connIndex, wc, newEvent(), marker)

		require.Empty(t, spy.calls)
	})

	t.Run("records nothing when the send buffer is full", func(t *testing.T) {
		spy := &deliveryRecorderSpy{}
		th.Service.SetPostDeliveryRecorder(spy.record)
		t.Cleanup(func() { th.Service.SetPostDeliveryRecorder(nil) })

		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
		// A zero-capacity buffer with no reader means the send always hits the default branch.
		wc := newDeliveryTestConn(t, th, connIndex, th.BasicUser2.Id, 0)

		hub := th.Service.GetHubForUserId(th.BasicUser2.Id)
		deliver(hub, connIndex, wc, newEvent(), marker)

		require.Empty(t, spy.calls)
	})

	t.Run("records nothing for the post's author", func(t *testing.T) {
		spy := &deliveryRecorderSpy{}
		th.Service.SetPostDeliveryRecorder(spy.record)
		t.Cleanup(func() { th.Service.SetPostDeliveryRecorder(nil) })

		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
		// BasicUser wrote the post the marker describes.
		wc := newDeliveryTestConn(t, th, connIndex, th.BasicUser.Id, 1)

		authorEvent := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", th.BasicUser.Id, nil, "")
		authorEvent.Add("post", "{}")

		hub := th.Service.GetHubForUserId(th.BasicUser.Id)
		deliver(hub, connIndex, wc, authorEvent, marker)

		require.Empty(t, spy.calls, "the author's own post echo is not a delivery")
		require.Len(t, wc.send, 1, "the event still reaches the author")
	})

	t.Run("records nothing without a marker", func(t *testing.T) {
		spy := &deliveryRecorderSpy{}
		th.Service.SetPostDeliveryRecorder(spy.record)
		t.Cleanup(func() { th.Service.SetPostDeliveryRecorder(nil) })

		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
		wc := newDeliveryTestConn(t, th, connIndex, th.BasicUser2.Id, 1)

		hub := th.Service.GetHubForUserId(th.BasicUser2.Id)
		deliver(hub, connIndex, wc, newEvent(), nil)

		require.Empty(t, spy.calls)
		require.Len(t, wc.send, 1)
	})

	t.Run("no recorder configured is a no-op", func(t *testing.T) {
		th.Service.SetPostDeliveryRecorder(nil)

		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
		wc := newDeliveryTestConn(t, th, connIndex, th.BasicUser2.Id, 1)

		hub := th.Service.GetHubForUserId(th.BasicUser2.Id)
		require.NotPanics(t, func() {
			deliver(hub, connIndex, wc, newEvent(), marker)
		})
	})
}

// rejectForUserHook rejects the event for one user, as a per-recipient access check does.
type rejectForUserHook struct {
	userID string
}

func (h *rejectForUserHook) Process(msg *HookedWebSocketEvent, webConn *WebConn, _ map[string]any) error {
	if webConn.UserId == h.userID {
		msg.Reject()
	}
	return nil
}

func TestHubBroadcastRejectedByHook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	marker := &model.PostDeliveryMarker{
		PostId:    model.NewId(),
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
	}

	const hookID = "reject_for_user"
	hub := &Hub{
		platform:       th.Service,
		broadcastHooks: map[string]BroadcastHook{hookID: &rejectForUserHook{userID: th.BasicUser2.Id}},
	}

	// The denied connection can come before the allowed one or after it, when the allowed
	// one's event is already queued; its rejection must reach neither.
	for _, tc := range []struct {
		name        string
		deniedFirst bool
	}{
		{name: "denied connection first", deniedFirst: true},
		{name: "denied connection last", deniedFirst: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			spy := &deliveryRecorderSpy{}
			th.Service.SetPostDeliveryRecorder(spy.record)
			t.Cleanup(func() { th.Service.SetPostDeliveryRecorder(nil) })

			connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
			denied := newDeliveryTestConn(t, th, connIndex, th.BasicUser2.Id, 1)
			allowed := newDeliveryTestConn(t, th, connIndex, th.SystemAdminUser.Id, 1)

			// One event for every connection, as the hub's broadcast loop hands it out.
			event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
			event.Add("post", "{}")
			order := []*WebConn{allowed, denied}
			if tc.deniedFirst {
				order = []*WebConn{denied, allowed}
			}
			for _, wc := range order {
				hub.broadcastToConn(connIndex, wc, event, decodeChannelID(event.GetBroadcast().ChannelId), marker, []string{hookID}, []map[string]any{{}})
			}

			require.Empty(t, denied.send, "a rejected event must not be queued")
			require.Len(t, allowed.send, 1)
			delivered, ok := (<-allowed.send).(*model.WebSocketEvent)
			require.True(t, ok)
			require.False(t, delivered.IsRejected(), "one connection's rejection must not reach another")
			require.False(t, event.IsRejected())

			require.Len(t, spy.calls, 1, "only the connection that got the event is recorded")
			require.Equal(t, th.SystemAdminUser.Id, spy.calls[0].userID)
		})
	}
}

// deliver calls broadcastToConn with the event's channel decoded, as the hub's broadcast arm does.
func deliver(hub *Hub, connIndex *hubConnectionIndex, wc *WebConn, ev *model.WebSocketEvent, marker *model.PostDeliveryMarker) {
	hub.broadcastToConn(connIndex, wc, ev, decodeChannelID(ev.GetBroadcast().ChannelId), marker, nil, nil)
}
