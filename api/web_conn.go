// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"time"

	"github.com/mattermost/platform/model"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/websocket"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

const (
	WRITE_WAIT  = 20 * time.Second
	PONG_WAIT   = 60 * time.Second
	PING_PERIOD = (PONG_WAIT * 9) / 10
	REDIS_WAIT  = 60 * time.Second
)

type WebConn struct {
	send              chan model.WebSocketMessage
	broadcast         chan *model.WebSocketEvent
	invalidateCache   chan bool
	webSocket         *websocket.Conn
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
		send:              make(chan model.WebSocketMessage, 64),
		broadcast:         make(chan *model.WebSocketEvent, 64),
		invalidateCache:   make(chan bool),
		webSocket:         ws,
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
		c.webSocket.Close()
	}()

	c.webSocket.SetReadLimit(SOCKET_MAX_MESSAGE_SIZE_KB)
	c.webSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
	c.webSocket.SetPongHandler(func(string) error {
		c.webSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
		go SetStatusAwayIfNeeded(c.UserId, false)
		return nil
	})

	for {
		var req model.WebSocketRequest
		if err := c.webSocket.ReadJSON(&req); err != nil {
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
		c.webSocket.Close()
	}()

	for {
		select {

		case s, ok := <-c.invalidateCache:
			if ok && s {
				c.isMemberOfTeam = make(map[string]bool)
				c.isMemberOfChannel = make(map[string]bool)
			}

		case msg, ok := <-c.broadcast:
			if ok {
				if c.shouldSendEvent(msg) {
					c.webSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
					if err := c.webSocket.WriteMessage(websocket.TextMessage, msg.PreComputeJson); err != nil {
						l4g.Error("websocket.broadcast: " + err.Error())
						return
					}

				}
			}

		case msg, ok := <-c.send:
			if !ok {
				c.webSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
				c.webSocket.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.webSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.webSocket.WriteJSON(msg); err != nil {
				l4g.Error("websocket.send: " + err.Error())
				return
			}

		case <-ticker.C:
			c.webSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.webSocket.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				l4g.Error("websocket.ticker: " + err.Error())
				return
			}
		}
	}
}

func (c *WebConn) InvalidateCache() {
	c.invalidateCache <- true
}

func (c *WebConn) Send(message model.WebSocketMessage) {
	c.send <- message
}

func (c *WebConn) Broadcast(message *model.WebSocketEvent) {
	c.broadcast <- message
}

func (c *WebConn) Close() {
	close(c.send)
	close(c.broadcast)
	close(c.invalidateCache)
}

func (c *WebConn) CloseSocket() {
	c.webSocket.Close()
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

	if len(c.isMemberOfChannel) == 0 {
		if cresult := <-Srv.Store.Channel().GetAllChannelIdsForAllTeams(c.UserId); cresult.Err != nil {
			l4g.Error("IsMemberOfChannel: " + cresult.Err.Error())
		} else {
			c.isMemberOfChannel = cresult.Data.(map[string]bool)
		}
	}

	return c.isMemberOfChannel[channelId]
}

func (c *WebConn) shouldSendEvent(msg *model.WebSocketEvent) bool {
	// Only report events to users who are in the channel for the event
	if len(msg.Broadcast.ChannelId) > 0 {
		return c.IsMemberOfChannel(msg.Broadcast.ChannelId)
	}

	// Only report events to users who are in the team for the event
	if len(msg.Broadcast.TeamId) > 0 {
		return c.IsMemberOfTeam(msg.Broadcast.TeamId)

	}

	return true
}
