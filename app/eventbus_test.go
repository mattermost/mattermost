// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/shared/eventbus"
	"github.com/stretchr/testify/require"
)

type testEvent struct {
	ID      string `json:"id"`
	Message string `json:"message"`
}

func TestEventBus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("subscribe to a topic", func(t *testing.T) {
		err := th.App.RegisterTopic("test-topic", "test description", &testEvent{}) // Register a topic
		require.NoError(t, err)

		rcv := make(chan any)
		id, err := th.App.SubscribeTopic("test-topic", func(event eventbus.Event) error {
			rcv <- true
			return nil
		})

		require.NoError(t, err)
		require.NotEmpty(t, id)

		err = th.App.PublishEvent("test-topic", request.EmptyContext(th.App.Srv().Log()), &testEvent{ID: "1", Message: "test message"}) // Publish an event
		require.NoError(t, err)

		select {
		case <-rcv:
		case <-time.After(2 * time.Second):
			require.Fail(t, "event receive timeout")
		}
	})

	t.Run("unsubscribe from the event", func(t *testing.T) {
		err := th.App.RegisterTopic("test-topic", "test description", &testEvent{}) // Register a topic
		require.NoError(t, err)

		rcv := make(chan any)
		id, err := th.App.SubscribeTopic("test-topic", func(event eventbus.Event) error {
			rcv <- true
			return nil
		})

		require.NoError(t, err)
		require.NotEmpty(t, id)

		err = th.App.PublishEvent("test-topic", request.EmptyContext(th.App.Srv().Log()), &testEvent{ID: "1", Message: "test message"}) // Publish an event
		require.NoError(t, err)

		select {
		case <-rcv:
		case <-time.After(time.Second):
			require.Fail(t, "event receive timeout")
		}

		err = th.App.UnsubscribeTopic("test-topic", id) // Unsubscribe from the event
		require.NoError(t, err)

		err = th.App.PublishEvent("test-topic", request.EmptyContext(th.App.Srv().Log()), &testEvent{ID: "1", Message: "test message"}) // Publish an event
		require.NoError(t, err)

		select {
		case <-rcv:
			require.Fail(t, "event received after unsubscribe")
		case <-time.After(time.Second):
		}
	})
}
