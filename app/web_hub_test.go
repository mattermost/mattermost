package app

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/websocket"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func dummyWebsocketHandler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		upgrader := &websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		}
		conn, err := upgrader.Upgrade(w, req, nil)
		for err == nil {
			_, _, err = conn.ReadMessage()
		}
		if _, ok := err.(*websocket.CloseError); !ok {
			require.NoError(t, err)
		}
	}
}

func registerDummyWebConn(t *testing.T, a *App, addr net.Addr, userId string) *WebConn {
	session, appErr := a.CreateSession(&model.Session{
		UserId: userId,
	})
	require.Nil(t, appErr)

	d := websocket.Dialer{}
	c, _, err := d.Dial("ws://"+addr.String()+"/ws", nil)
	require.NoError(t, err)

	wc := a.NewWebConn(c, *session, goi18n.IdentityTfunc(), "en")
	a.HubRegister(wc)
	go wc.Pump()
	return wc
}

func TestHubStopWithMultipleConnections(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	s := httptest.NewServer(http.HandlerFunc(dummyWebsocketHandler(t)))
	defer s.Close()

	th.App.HubStart()
	wc1 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
	wc2 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
	wc3 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
	defer wc1.Close()
	defer wc2.Close()
	defer wc3.Close()
}
