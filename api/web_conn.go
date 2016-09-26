// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"time"

	"github.com/mattermost/platform/model"

	"github.com/gorilla/websocket"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

const (
	WRITE_WAIT  = 10 * time.Second
	PONG_WAIT   = 60 * time.Second
	PING_PERIOD = (PONG_WAIT * 9) / 10
	MAX_SIZE    = 512
	REDIS_WAIT  = 60 * time.Second
)

type WebConn struct {
	WebSocket         *websocket.Conn
	Send              chan model.WebSocketMessage
	SessionToken      string
	UserId            string
	T                 goi18n.TranslateFunc
	Locale            string
	isMemberOfChannel map[string]bool
	isMemberOfTeam    map[string]bool
}

func NewWebConn(c *Context, ws *websocket.Conn) *WebConn {
	go SetStatusOnline(c.Session.UserId, c.Session.Id, false)

	return &WebConn{
		Send:              make(chan model.WebSocketMessage, 64),
		WebSocket:         ws,
		UserId:            c.Session.UserId,
		SessionToken:      c.Session.Token,
		T:                 c.T,
		Locale:            c.Locale,
		isMemberOfChannel: make(map[string]bool),
		isMemberOfTeam:    make(map[string]bool),
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
		go SetStatusAwayIfNeeded(c.UserId, false)
		return nil
	})

	for {
		var req model.WebSocketRequest
		if err := c.WebSocket.ReadJSON(&req); err != nil {
			return
		} else {
			BaseRoutes.WebSocket.ServeWebSocket(c, &req)
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
	c.isMemberOfTeam = make(map[string]bool)
	c.isMemberOfChannel = make(map[string]bool)
}

func (c *WebConn) InvalidateCacheForChannel(channelId string) {
	delete(c.isMemberOfChannel, channelId)
}

func (c *WebConn) IsMemberOfTeam(teamId string) bool {
	isMember, ok := c.isMemberOfTeam[teamId]
	if !ok {
		session := GetSession(c.SessionToken)
		if session == nil {
			isMember = false
			c.isMemberOfTeam[teamId] = isMember
		} else {
			member := session.GetTeamByTeamId(teamId)

			if member != nil {
				isMember = true
				c.isMemberOfTeam[teamId] = isMember
			} else {
				isMember = true
				c.isMemberOfTeam[teamId] = isMember
			}

		}
	}

	return isMember
}

func (c *WebConn) IsMemberOfChannel(channelId string) bool {
	isMember, ok := c.isMemberOfChannel[channelId]
	if !ok {
		if cresult := <-Srv.Store.Channel().GetMember(channelId, c.UserId); cresult.Err != nil {
			isMember = false
			c.isMemberOfChannel[channelId] = isMember
		} else {
			isMember = true
			c.isMemberOfChannel[channelId] = isMember
		}
	}

	return isMember
}
