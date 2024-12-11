// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type BroadcastHook interface {
	// Process takes a WebSocket event and modifies it in some way. It is passed a HookedWebSocketEvent which allows
	// safe modification of the event.
	Process(msg *HookedWebSocketEvent, webConn *WebConn, args map[string]any) error
}

func (h *Hub) runBroadcastHooks(msg *model.WebSocketEvent, webConn *WebConn, hookIDs []string, hookArgs []map[string]any) *model.WebSocketEvent {
	if len(hookIDs) == 0 {
		return msg
	}

	hookedEvent := MakeHookedWebSocketEvent(msg)

	for i, hookID := range hookIDs {
		hook := h.broadcastHooks[hookID]
		args := hookArgs[i]
		if hook == nil {
			mlog.Warn("runBroadcastHooks: Unable to find broadcast hook", mlog.String("hook_id", hookID))
			continue
		}

		err := hook.Process(hookedEvent, webConn, args)
		if err != nil {
			mlog.Warn("runBroadcastHooks: Error processing hook", mlog.String("hook_id", hookID), mlog.Err(err))
		}
	}

	return hookedEvent.Event()
}

// HookedWebSocketEvent is a wrapper for model.WebSocketEvent that is intended to provide a similar interface, except
// it ensures the original WebSocket event is not modified.
type HookedWebSocketEvent struct {
	original *model.WebSocketEvent
	copy     *model.WebSocketEvent
}

func MakeHookedWebSocketEvent(event *model.WebSocketEvent) *HookedWebSocketEvent {
	return &HookedWebSocketEvent{
		original: event,
	}
}

func (he *HookedWebSocketEvent) Add(key string, value any) {
	he.copyIfNecessary()

	he.copy.Add(key, value)
}

func (he *HookedWebSocketEvent) EventType() model.WebsocketEventType {
	if he.copy == nil {
		return he.original.EventType()
	}

	return he.copy.EventType()
}

// Get returns a value from the WebSocket event data. You should never mutate a value returned by this method.
func (he *HookedWebSocketEvent) Get(key string) any {
	if he.copy == nil {
		return he.original.GetData()[key]
	}

	return he.copy.GetData()[key]
}

// copyIfNecessary should be called by any mutative method to ensure that the copy is instantiated.
func (he *HookedWebSocketEvent) copyIfNecessary() {
	if he.copy == nil {
		he.copy = he.original.RemovePrecomputedJSON()
	}
}

func (he *HookedWebSocketEvent) Event() *model.WebSocketEvent {
	if he.copy == nil {
		return he.original
	}

	return he.copy
}
