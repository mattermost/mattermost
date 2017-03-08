// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/websocket"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

const (
	WRITE_WAIT   = 10 * time.Second
	PONG_WAIT    = 60 * time.Second
	PING_PERIOD  = (PONG_WAIT * 9) / 10
	MAX_SIZE     = 8192
	REDIS_WAIT   = 60 * time.Second
	AUTH_TIMEOUT = 5 * time.Second
)

type WebConn struct {
	WebSocket               *websocket.Conn
	Send                    chan model.WebSocketMessage
	SessionToken            string
	UserId                  string
	T                       goi18n.TranslateFunc
	Locale                  string
	hasPermissionsToChannel map[string]bool
	hasPermissionsToTeam    map[string]bool
}

func NewWebConn(c *Context, ws *websocket.Conn) *WebConn {
	if len(c.Session.UserId) > 0 {
		go SetStatusOnline(c.Session.UserId, c.Session.Id, false)
	}

	return &WebConn{
		Send:                    make(chan model.WebSocketMessage, 64),
		WebSocket:               ws,
		UserId:                  c.Session.UserId,
		SessionToken:            c.Session.Token,
		T:                       c.T,
		Locale:                  c.Locale,
		hasPermissionsToChannel: make(map[string]bool),
		hasPermissionsToTeam:    make(map[string]bool),
	}
}

func (c *WebConn) readPump() {
	defer func() {
		hub.Unregister(c)
		c.WebSocket.Close()
	}()
	c.WebSocket.SetReadLimit(MAX_SIZE)
	c.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
	c.WebSocket.SetPongHandler(func(string) error {
		c.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
		if c.isAuthenticated() {
			go SetStatusAwayIfNeeded(c.UserId, false)
		}
		return nil
	})

	for {
		var req model.WebSocketRequest
		if err := c.WebSocket.ReadJSON(&req); err != nil {
			// browsers will appear as CloseNoStatusReceived
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
				l4g.Debug(fmt.Sprintf("websocket.read: client side closed socket userId=%v", c.UserId))
			} else {
				l4g.Debug(fmt.Sprintf("websocket.read: closing websocket for userId=%v error=%v", c.UserId, err.Error()))
			}
			return
		} else {
			BaseRoutes.WebSocket.ServeWebSocket(c, &req)
		}
	}
}

func (c *WebConn) writePump() {
	ticker := time.NewTicker(PING_PERIOD)
	authTicker := time.NewTicker(AUTH_TIMEOUT)

	defer func() {
		ticker.Stop()
		authTicker.Stop()
		c.WebSocket.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			if !ok {
				c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
				c.WebSocket.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.WebSocket.WriteJSON(msg); err != nil {
				// browsers will appear as CloseNoStatusReceived
				if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
					l4g.Debug(fmt.Sprintf("websocket.send: client side closed socket userId=%v", c.UserId))
				} else {
					l4g.Debug(fmt.Sprintf("websocket.send: closing websocket for userId=%v, error=%v", c.UserId, err.Error()))
				}
				return
			}

		case <-ticker.C:
			c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.WebSocket.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		case <-authTicker.C:
			if c.SessionToken == "" {
				l4g.Debug(fmt.Sprintf("websocket.authTicker: did not authenticate ip=%v", c.WebSocket.RemoteAddr()))
				return
			}
			authTicker.Stop()
		}
	}
}

func (c *WebConn) InvalidateCache() {
	c.hasPermissionsToChannel = make(map[string]bool)
	c.hasPermissionsToTeam = make(map[string]bool)
}

func (c *WebConn) InvalidateCacheForChannel(channelId string) {
	delete(c.hasPermissionsToChannel, channelId)
}

func (webCon *WebConn) isAuthenticated() bool {
	return webCon.SessionToken != ""
}

func (webCon *WebConn) SendHello() {
	msg := model.NewWebSocketEvent("", "", webCon.UserId, model.WEBSOCKET_EVENT_HELLO)
	msg.Add("server_version", fmt.Sprintf("%v.%v.%v", model.CurrentVersion, model.BuildNumber, utils.CfgHash))

	webCon.Send <- msg
}

func (c *WebConn) HasPermissionsToTeam(teamId string) bool {
	if !c.isAuthenticated() {
		return false
	}
	perm, ok := c.hasPermissionsToTeam[teamId]
	if !ok {
		session := GetSession(c.SessionToken)
		if session == nil {
			perm = false
			c.hasPermissionsToTeam[teamId] = perm
		} else {
			member := session.GetTeamByTeamId(teamId)

			if member != nil {
				perm = true
				c.hasPermissionsToTeam[teamId] = perm
			} else {
				perm = true
				c.hasPermissionsToTeam[teamId] = perm
			}

		}
	}

	return perm
}

func (c *WebConn) HasPermissionsToChannel(channelId string) bool {
	if !c.isAuthenticated() {
		return false
	}
	perm, ok := c.hasPermissionsToChannel[channelId]
	if !ok {
		if cresult := <-Srv.Store.Channel().CheckPermissionsToNoTeam(channelId, c.UserId); cresult.Err != nil {
			perm = false
			c.hasPermissionsToChannel[channelId] = perm
		} else {
			count := cresult.Data.(int64)

			if count == 1 {
				perm = true
				c.hasPermissionsToChannel[channelId] = perm
			} else {
				perm = false
				c.hasPermissionsToChannel[channelId] = perm
			}
		}
	}

	return perm
}
