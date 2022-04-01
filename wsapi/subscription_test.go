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

func TestSubscription(t *testing.T) {
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
		data        map[string]interface{}
		expectError bool
	}{
		"no data":         {data: nil, expectError: true},
		"invalid subject": {data: map[string]interface{}{"subscription_id": "foobar"}, expectError: true},
		"valid subject":   {data: map[string]interface{}{"subscription_id": "activity_feed"}, expectError: false},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			resp1, err1 := api.subscribe(&model.WebSocketRequest{Data: tc.data}, wc)
			resp2, err2 := api.unsubscribe(&model.WebSocketRequest{Data: tc.data}, wc)
			if tc.expectError {
				require.NotNil(t, err1)
				require.NotNil(t, err2)
			} else {
				require.Nil(t, err1)
				require.Nil(t, err2)
			}
			require.Empty(t, resp1)
			require.Empty(t, resp2)
		})
	}
}
