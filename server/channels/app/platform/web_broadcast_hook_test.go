// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const broadcastTest = "test_broadcast_hook"

type testBroadcastHook struct{}

func (h *testBroadcastHook) Process(msg *HookedWebSocketEvent, webConn *WebConn, args map[string]any) error {
	if args["makes_changes"].(bool) {
		changesMade, _ := msg.Get("changes_made").(int)
		msg.Add("changes_made", changesMade+1)
	}

	return nil
}

func TestRunBroadcastHooks(t *testing.T) {
	mainHelper.Parallel(t)
	hub := &Hub{
		broadcastHooks: map[string]BroadcastHook{
			broadcastTest: &testBroadcastHook{},
		},
	}
	webConn := &WebConn{}

	t.Run("should not allocate a new object when no hooks are passed", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		result, _ := hub.runBroadcastHooks(event, webConn, nil, nil)

		assert.Same(t, event, result)
	})

	t.Run("should not allocate a new object when a hook is not making changes", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		hookIDs := []string{
			broadcastTest,
		}
		hookArgs := []map[string]any{
			{
				"makes_changes": false,
			},
		}

		result, _ := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

		assert.Same(t, event, result)
	})

	t.Run("should allocate a new object and remove when a hook makes changes", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		hookIDs := []string{
			broadcastTest,
		}
		hookArgs := []map[string]any{
			{
				"makes_changes": true,
			},
		}

		result, _ := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

		assert.NotSame(t, event, result)
		model.AssertNotSameMap(t, event.GetData(), result.GetData())
		assert.Equal(t, map[string]any{}, event.GetData())
		assert.Equal(t, result.GetData(), map[string]any{
			"changes_made": 1,
		})
	})

	t.Run("should not allocate a new object when multiple hooks are not making changes", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		hookIDs := []string{
			broadcastTest,
			broadcastTest,
			broadcastTest,
		}
		hookArgs := []map[string]any{
			{
				"makes_changes": false,
			},
			{
				"makes_changes": false,
			},
			{
				"makes_changes": false,
			},
		}

		result, _ := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

		assert.Same(t, event, result)
	})

	t.Run("should be able to make changes from only one of make hooks", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		var hookIDs []string
		var hookArgs []map[string]any
		for i := range 10 {
			hookIDs = append(hookIDs, broadcastTest)
			hookArgs = append(hookArgs, map[string]any{
				"makes_changes": i == 6,
			})
		}

		result, _ := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

		assert.NotSame(t, event, result)
		model.AssertNotSameMap(t, event.GetData(), result.GetData())
		assert.Equal(t, event.GetData(), map[string]any{})
		assert.Equal(t, result.GetData(), map[string]any{
			"changes_made": 1,
		})
	})

	t.Run("should be able to make changes from multiple hooks", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		var hookIDs []string
		var hookArgs []map[string]any
		for range 10 {
			hookIDs = append(hookIDs, broadcastTest)
			hookArgs = append(hookArgs, map[string]any{
				"makes_changes": true,
			})
		}

		result, _ := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

		assert.NotSame(t, event, result)
		model.AssertNotSameMap(t, event.GetData(), result.GetData())
		assert.Equal(t, event.GetData(), map[string]any{})
		assert.Equal(t, result.GetData(), map[string]any{
			"changes_made": 10,
		})
	})

	t.Run("should not remove precomputed JSON when a hook doesn't make changes", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		event = event.PrecomputeJSON()

		// Ensure that the event has precomputed JSON because changes aren't included when ToJSON is called again
		originalJSON, _ := event.ToJSON()
		event.Add("data", 1234)
		eventJSON, _ := event.ToJSON()
		require.Equal(t, string(originalJSON), string(eventJSON))

		hookIDs := []string{
			broadcastTest,
		}
		hookArgs := []map[string]any{
			{
				"makes_changes": false,
			},
		}

		result, _ := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

		eventJSON, _ = event.ToJSON()
		assert.Equal(t, string(originalJSON), string(eventJSON))

		resultJSON, _ := result.ToJSON()
		assert.Equal(t, originalJSON, resultJSON)
	})

	t.Run("should remove precomputed JSON when a hook makes changes", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		event = event.PrecomputeJSON()

		// Ensure that the event has precomputed JSON because changes aren't included when ToJSON is called again
		originalJSON, _ := event.ToJSON()
		event.Add("data", 1234)
		eventJSON, _ := event.ToJSON()
		require.Equal(t, originalJSON, eventJSON)

		hookIDs := []string{
			broadcastTest,
		}
		hookArgs := []map[string]any{
			{
				"makes_changes": true,
			},
		}

		result, _ := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

		eventJSON, _ = event.ToJSON()
		assert.Equal(t, string(originalJSON), string(eventJSON))

		resultJSON, _ := result.ToJSON()
		assert.NotEqual(t, originalJSON, resultJSON)
	})
}

const broadcastRejectTest = "test_reject_broadcast_hook"

// testRejectBroadcastHook rejects the event for the connection whose user id is args["reject_user_id"].
type testRejectBroadcastHook struct{}

func (h *testRejectBroadcastHook) Process(msg *HookedWebSocketEvent, webConn *WebConn, args map[string]any) error {
	if rejectUserID, _ := args["reject_user_id"].(string); webConn.UserId == rejectUserID {
		msg.Reject()
	}
	return nil
}

func TestRunBroadcastHooksReject(t *testing.T) {
	mainHelper.Parallel(t)
	hub := &Hub{
		broadcastHooks: map[string]BroadcastHook{
			broadcastTest:       &testBroadcastHook{},
			broadcastRejectTest: &testRejectBroadcastHook{},
		},
	}
	deniedConn := &WebConn{UserId: "denied"}
	allowedConn := &WebConn{UserId: "allowed"}

	newEvent := func(t *testing.T) (*model.WebSocketEvent, []byte) {
		t.Helper()
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "channel", "", nil, "")
		event.Add("post", "some post")
		event = event.PrecomputeJSON()
		eventJSON, err := event.ToJSON()
		require.NoError(t, err)
		return event, eventJSON
	}

	t.Run("rejecting for one connection should not reject the shared event for later connections", func(t *testing.T) {
		event, eventJSON := newEvent(t)

		hookIDs := []string{broadcastRejectTest}
		hookArgs := []map[string]any{{"reject_user_id": "denied"}}

		// The hub runs the hooks on the same event for every connection, so this mirrors the production path
		// where a rejected connection is processed before an allowed one.
		_, rejected := hub.runBroadcastHooks(event, deniedConn, hookIDs, hookArgs)
		require.True(t, rejected)

		allowedResult, rejected := hub.runBroadcastHooks(event, allowedConn, hookIDs, hookArgs)
		assert.False(t, rejected)
		assert.Same(t, event, allowedResult, "an allowed connection should still get the shared event")

		allowedJSON, err := allowedResult.ToJSON()
		require.NoError(t, err)
		assert.Equal(t, eventJSON, allowedJSON)

		assert.False(t, event.IsRejected())
	})

	t.Run("Reject should not copy the event", func(t *testing.T) {
		event, _ := newEvent(t)
		hooked := MakeHookedWebSocketEvent(event)

		hooked.Reject()
		assert.True(t, hooked.IsRejected())
		assert.Nil(t, hooked.copy)
		assert.Same(t, event, hooked.event())
		assert.False(t, event.IsRejected())

		hooked.Add("changes_made", 1)
		model.AssertNotSameMap(t, event.GetData(), hooked.event().GetData())
		assert.True(t, hooked.IsRejected())
		assert.Equal(t, map[string]any{"post": "some post"}, event.GetData())
	})
}
