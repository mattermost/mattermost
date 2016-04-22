// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/websocket"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"time"
)

const (
	WRITE_WAIT  = 10 * time.Second
	PONG_WAIT   = 60 * time.Second
	PING_PERIOD = (PONG_WAIT * 9) / 10
	MAX_SIZE    = 512
	REDIS_WAIT  = 60 * time.Second
)

type WebConn struct {
	WebSocket               *websocket.Conn
	Send                    chan *model.Message
	SessionId               string
	UserId                  string
	hasPermissionsToChannel map[string]bool
	hasPermissionsToTeam    map[string]bool
}

func NewWebConn(ws *websocket.Conn, userId string, sessionId string) *WebConn {
	go func() {
		achan := Srv.Store.User().UpdateUserAndSessionActivity(userId, sessionId, model.GetMillis())
		pchan := Srv.Store.User().UpdateLastPingAt(userId, model.GetMillis())

		if result := <-achan; result.Err != nil {
			l4g.Error(utils.T("api.web_conn.new_web_conn.last_activity.error"), userId, sessionId, result.Err)
		}

		if result := <-pchan; result.Err != nil {
			l4g.Error(utils.T("api.web_conn.new_web_conn.last_ping.error"), userId, result.Err)
		}
	}()

	return &WebConn{
		Send:                    make(chan *model.Message, 64),
		WebSocket:               ws,
		UserId:                  userId,
		SessionId:               sessionId,
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

		go func() {
			if result := <-Srv.Store.User().UpdateLastPingAt(c.UserId, model.GetMillis()); result.Err != nil {
				l4g.Error(utils.T("api.web_conn.new_web_conn.last_ping.error"), c.UserId, result.Err)
			}
		}()

		return nil
	})

	for {
		var msg model.Message
		if err := c.WebSocket.ReadJSON(&msg); err != nil {
			return
		} else {
			msg.UserId = c.UserId
			PublishAndForget(&msg)
		}
	}
}

func (c *WebConn) writePump() {
	ticker := time.NewTicker(PING_PERIOD)

	defer func() {
		ticker.Stop()
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
				return
			}

		case <-ticker.C:
			c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.WebSocket.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		}
	}
}

func (c *WebConn) InvalidateCache() {
	c.hasPermissionsToChannel = make(map[string]bool)
	c.hasPermissionsToTeam = make(map[string]bool)
}

func (c *WebConn) HasPermissionsToTeam(teamId string) bool {
	perm, ok := c.hasPermissionsToTeam[teamId]
	if !ok {
		session := GetSession(c.SessionId)
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
