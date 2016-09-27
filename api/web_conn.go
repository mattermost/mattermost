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
	WRITE_WAIT  = 10 * time.Second
	PONG_WAIT   = 60 * time.Second
	PING_PERIOD = (PONG_WAIT * 9) / 10
	MAX_SIZE    = 512
	REDIS_WAIT  = 60 * time.Second
)

type WebConn struct {
	send              chan model.WebSocketMessage
	broadcast         chan *model.WebSocketEvent // I wonder if this should be by Value vs Ref.  Then you can remove the nil check in <- boradcast if by Ref.  But its needed because of funky units tests.
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

	c.webSocket.SetReadLimit(MAX_SIZE)
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
				if msg == nil {
					l4g.Error("Broadcast message was nil, this shouldn't happen.")
				} else if c.shouldSendEvent(msg) {
					c.webSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
					if err := c.webSocket.WriteJSON(msg); err != nil {
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
				return
			}

		case <-ticker.C:
			c.webSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.webSocket.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
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
			l4g.Error(cresult.Err.Error())
		} else {
			c.isMemberOfChannel = cresult.Data.(map[string]bool)
		}
	}

	return c.isMemberOfChannel[channelId]
}

func (c *WebConn) shouldSendEvent(msg *model.WebSocketEvent) bool {
	if c.UserId == msg.UserId {
		// Don't need to tell the user they are typing
		if msg.Event == model.WEBSOCKET_EVENT_TYPING {
			return false
		}

		// We have to make sure the user is in the channel. Otherwise system messages that
		// post about users in channels they are not in trigger warnings.
		if len(msg.ChannelId) > 0 {
			allowed := c.IsMemberOfChannel(msg.ChannelId)

			if !allowed {
				return false
			}
		}
	} else {
		// Don't share a user's view or preference events with other users
		if msg.Event == model.WEBSOCKET_EVENT_CHANNEL_VIEWED {
			return false
		} else if msg.Event == model.WEBSOCKET_EVENT_PREFERENCE_CHANGED {
			return false
		} else if msg.Event == model.WEBSOCKET_EVENT_EPHEMERAL_MESSAGE {
			// For now, ephemeral messages are sent directly to individual users
			return false
		} else if msg.Event == model.WEBSOCKET_EVENT_WEBRTC {
			// No need to tell anyone that a webrtc event is going on
			return false
		}

		// Only report events to users who are in the team for the event
		if len(msg.TeamId) > 0 {
			allowed := c.IsMemberOfTeam(msg.TeamId)

			if !allowed {
				return false
			}
		}

		// Only report events to users who are in the channel for the event execept deleted events
		if len(msg.ChannelId) > 0 && msg.Event != model.WEBSOCKET_EVENT_CHANNEL_DELETED {
			allowed := c.IsMemberOfChannel(msg.ChannelId)

			if !allowed {
				return false
			}
		}
	}

	return true
}
