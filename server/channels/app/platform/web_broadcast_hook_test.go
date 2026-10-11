// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	broadcastTest       = "test_broadcast_hook"
	broadcastRejectTest = "test_reject_broadcast_hook"
)

type testBroadcastHook struct{}

func (h *testBroadcastHook) Process(msg *HookedWebSocketEvent, webConn *WebConn, args map[string]any) error {
	if args["makes_changes"].(bool) {
		changesMade, _ := msg.Get("changes_made").(int)
		msg.Add("changes_made", changesMade+1)
	}

	return nil
}

type testRejectBroadcastHook struct{}

func (h *testRejectBroadcastHook) Process(msg *HookedWebSocketEvent, webConn *WebConn, args map[string]any) error {
	if webConn.UserId == args["denied_user_id"] {
		msg.Reject()
	}

	return nil
}

func TestRunBroadcastHooks(t *testing.T) {
	mainHelper.Parallel(t)
	hub := &Hub{
		broadcastHooks: map[string]BroadcastHook{
			broadcastTest:       &testBroadcastHook{},
			broadcastRejectTest: &testRejectBroadcastHook{},
		},
	}
	webConn := &WebConn{}

	t.Run("should reject only for the connection the hook rejects", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		deniedConn := &WebConn{UserId: "denied"}
		allowedConn := &WebConn{UserId: "allowed"}

		hookIDs := []string{broadcastRejectTest}
		hookArgs := []map[string]any{{"denied_user_id": "denied"}}

		deniedResult := hub.runBroadcastHooks(event, deniedConn, hookIDs, hookArgs)
		allowedResult := hub.runBroadcastHooks(event, allowedConn, hookIDs, hookArgs)

		assert.NotSame(t, event, deniedResult)
		assert.True(t, deniedResult.IsRejected())
		assert.False(t, event.IsRejected())
		assert.Same(t, event, allowedResult)
		assert.False(t, allowedResult.IsRejected())
	})

	t.Run("should not run later hooks once the event is rejected", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		deniedConn := &WebConn{UserId: "denied"}

		hookIDs := []string{broadcastRejectTest, broadcastTest}
		hookArgs := []map[string]any{{"denied_user_id": "denied"}, {"makes_changes": true}}

		result := hub.runBroadcastHooks(event, deniedConn, hookIDs, hookArgs)

		assert.True(t, result.IsRejected())
		assert.Equal(t, map[string]any{}, result.GetData())
	})

	t.Run("should not allocate a new object when no hooks are passed", func(t *testing.T) {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")

		result := hub.runBroadcastHooks(event, webConn, nil, nil)

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

		result := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

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

		result := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

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

		result := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

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

		result := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

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

		result := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

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

		result := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

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

		result := hub.runBroadcastHooks(event, webConn, hookIDs, hookArgs)

		eventJSON, _ = event.ToJSON()
		assert.Equal(t, string(originalJSON), string(eventJSON))

		resultJSON, _ := result.ToJSON()
		assert.NotEqual(t, originalJSON, resultJSON)
	})
}
