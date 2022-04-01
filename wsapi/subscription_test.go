// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"testing"

	"github.com/gorilla/websocket"
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestSubscribe(t *testing.T) {
	s, err := app.NewServer()
	defer s.Shutdown()
	require.NoError(t, err)

	a := app.New(app.ServerConnector(s.Channels()))

	api := &API{
		App:    a,
		Router: s.WebSocketRouter,
	}
	api.initSubscription()

	wc := a.NewWebConn(&app.WebConnConfig{
		WebSocket: &websocket.Conn{},
	})

	tests := map[string]struct {
		action      string
		data        map[string]interface{}
		expectError bool
	}{
		"blank action":    {action: "", data: nil, expectError: true},
		"invalid subject": {action: "susbscribe", data: map[string]interface{}{"subscription_id": "foobar"}, expectError: true},
		"valid subject":   {action: "susbscribe", data: map[string]interface{}{"subscription_id": "activity_feed"}, expectError: false},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			resp, err := api.subscribe(&model.WebSocketRequest{Action: tc.action, Data: tc.data}, wc)
			if tc.expectError {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}
			require.Empty(t, resp)
		})
	}
}
