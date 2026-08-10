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
		hub.broadcastToConn(connIndex, wc, newEvent(), marker, nil, nil)

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
		hub.broadcastToConn(connIndex, wc, newEvent(), marker, nil, nil)

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
		hub.broadcastToConn(connIndex, wc, newEvent(), marker, nil, nil)

		require.Empty(t, spy.calls)
	})

	t.Run("records nothing without a marker", func(t *testing.T) {
		spy := &deliveryRecorderSpy{}
		th.Service.SetPostDeliveryRecorder(spy.record)
		t.Cleanup(func() { th.Service.SetPostDeliveryRecorder(nil) })

		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
		wc := newDeliveryTestConn(t, th, connIndex, th.BasicUser2.Id, 1)

		hub := th.Service.GetHubForUserId(th.BasicUser2.Id)
		hub.broadcastToConn(connIndex, wc, newEvent(), nil, nil, nil)

		require.Empty(t, spy.calls)
		require.Len(t, wc.send, 1)
	})

	t.Run("no recorder configured is a no-op", func(t *testing.T) {
		th.Service.SetPostDeliveryRecorder(nil)

		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)
		wc := newDeliveryTestConn(t, th, connIndex, th.BasicUser2.Id, 1)

		hub := th.Service.GetHubForUserId(th.BasicUser2.Id)
		require.NotPanics(t, func() {
			hub.broadcastToConn(connIndex, wc, newEvent(), marker, nil, nil)
		})
	})
}
