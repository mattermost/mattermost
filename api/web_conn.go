// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"time"

	"github.com/mattermost/platform/model"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/websocket"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

const (
	WRITE_WAIT  = 30 * time.Second
	PONG_WAIT   = 100 * time.Second
	PING_PERIOD = (PONG_WAIT * 6) / 10
)

type WebConn struct {
	WebSocket                 *websocket.Conn
	Send                      chan model.WebSocketMessage
	SessionToken              string
	UserId                    string
	T                         goi18n.TranslateFunc
	Locale                    string
	AllChannelMembers         map[string]string
	LastAllChannelMembersTime int64
}

func NewWebConn(c *Context, ws *websocket.Conn) *WebConn {
	go SetStatusOnline(c.Session.UserId, c.Session.Id, false)

	return &WebConn{
		Send:         make(chan model.WebSocketMessage, 256),
		WebSocket:    ws,
		UserId:       c.Session.UserId,
		SessionToken: c.Session.Token,
		T:            c.T,
		Locale:       c.Locale,
	}
}

func (c *WebConn) readPump() {
	defer func() {
		HubUnregister(c)
		c.WebSocket.Close()
	}()
	c.WebSocket.SetReadLimit(SOCKET_MAX_MESSAGE_SIZE_KB)
	c.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
	c.WebSocket.SetPongHandler(func(string) error {
		c.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
		go SetStatusAwayIfNeeded(c.UserId, false)
		return nil
	})

	for {
		var req model.WebSocketRequest
		if err := c.WebSocket.ReadJSON(&req); err != nil {
			// browsers will appear as CloseNoStatusReceived
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
				l4g.Debug(fmt.Sprintf("websocket.read: client side closed socket userId=%v", c.UserId))
			} else {
				l4g.Debug(fmt.Sprintf("websocket.read: cannot read, closing websocket for userId=%v error=%v", c.UserId, err.Error()))
			}

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
			if err := c.WebSocket.WriteMessage(websocket.TextMessage, msg.GetPreComputeJson()); err != nil {
				// browsers will appear as CloseNoStatusReceived
				if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
					l4g.Debug(fmt.Sprintf("websocket.send: client side closed socket userId=%v", c.UserId))
				} else {
					l4g.Debug(fmt.Sprintf("websocket.send: cannot send, closing websocket for userId=%v, error=%v", c.UserId, err.Error()))
				}

				return
			}

		case <-ticker.C:
			c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.WebSocket.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				// browsers will appear as CloseNoStatusReceived
				if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
					l4g.Debug(fmt.Sprintf("websocket.ticker: client side closed socket userId=%v", c.UserId))
				} else {
					l4g.Debug(fmt.Sprintf("websocket.ticker: cannot read, closing websocket for userId=%v error=%v", c.UserId, err.Error()))
				}

				return
			}
		}
	}
}

func (webCon *WebConn) InvalidateCache() {
	webCon.AllChannelMembers = nil
	webCon.LastAllChannelMembersTime = 0

}

func (webCon *WebConn) ShouldSendEvent(msg *model.WebSocketEvent) bool {
	// If the event is destined to a specific user
	if len(msg.Broadcast.UserId) > 0 && webCon.UserId != msg.Broadcast.UserId {
		return false
	}

	// if the user is omitted don't send the message
	if len(msg.Broadcast.OmitUsers) > 0 {
		if _, ok := msg.Broadcast.OmitUsers[webCon.UserId]; ok {
			return false
		}
	}

	// Only report events to users who are in the channel for the event
	if len(msg.Broadcast.ChannelId) > 0 {

		if model.GetMillis()-webCon.LastAllChannelMembersTime > 1000*60*15 { // 15 minutes
			webCon.AllChannelMembers = nil
			webCon.LastAllChannelMembersTime = 0
		}

		if webCon.AllChannelMembers == nil {
			if result := <-Srv.Store.Channel().GetAllChannelMembersForUser(webCon.UserId, true); result.Err != nil {
				l4g.Error("webhub.shouldSendEvent: " + result.Err.Error())
				return false
			} else {
				webCon.AllChannelMembers = result.Data.(map[string]string)
				webCon.LastAllChannelMembersTime = model.GetMillis()
			}
		}

		if _, ok := webCon.AllChannelMembers[msg.Broadcast.ChannelId]; ok {
			return true
		} else {
			return false
		}
	}

	// Only report events to users who are in the team for the event
	if len(msg.Broadcast.TeamId) > 0 {
		return webCon.IsMemberOfTeam(msg.Broadcast.TeamId)

	}

	return true
}

func (webCon *WebConn) IsMemberOfTeam(teamId string) bool {
	session := GetSession(webCon.SessionToken)
	if session == nil {
		return false
	} else {
		member := session.GetTeamByTeamId(teamId)

		if member != nil {
			return true
		} else {
			return false
		}
	}
}
