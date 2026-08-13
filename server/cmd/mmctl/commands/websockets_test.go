// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestProcessWebSocketEvents(t *testing.T) {
	t.Run("nil event in channel does not panic and returns nil", func(t *testing.T) {
		ch := make(chan *model.WebSocketEvent, 1)
		ch <- nil
		close(ch)

		c := &model.WebSocketClient{EventChannel: ch}
		err := processWebSocketEvents(c)
		require.NoError(t, err)
	})

	t.Run("non-nil event is processed and returns nil", func(t *testing.T) {
		ch := make(chan *model.WebSocketEvent, 1)
		ch <- model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		close(ch)

		c := &model.WebSocketClient{EventChannel: ch}
		err := processWebSocketEvents(c)
		require.NoError(t, err)
	})

	t.Run("ListenError is surfaced after channel closes", func(t *testing.T) {
		ch := make(chan *model.WebSocketEvent)
		close(ch)

		appErr := model.NewAppError("Listen", "model.websocket_client.connect_fail.app_error", nil, "connection refused", http.StatusInternalServerError)
		c := &model.WebSocketClient{
			EventChannel: ch,
			ListenError:  appErr,
		}
		err := processWebSocketEvents(c)
		require.Error(t, err)
		require.Contains(t, err.Error(), appErr.Error())
	})
}
