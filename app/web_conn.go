// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"time"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/websocket"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

const (
	SEND_QUEUE_SIZE           = 256
	SEND_SLOW_WARN            = (SEND_QUEUE_SIZE * 50) / 100
	SEND_DEADLOCK_WARN        = (SEND_QUEUE_SIZE * 95) / 100
	WRITE_WAIT                = 30 * time.Second
	PONG_WAIT                 = 100 * time.Second
	PING_PERIOD               = (PONG_WAIT * 6) / 10
	AUTH_TIMEOUT              = 5 * time.Second
	WEBCONN_MEMBER_CACHE_TIME = 1000 * 60 * 30 // 30 minutes
)

type WebConn struct {
	WebSocket        *websocket.Conn
	Send             chan model.WebSocketMessage
	SessionToken     string
	SessionExpiresAt int64
	Session          *model.Session
	UserId           string
	T                goi18n.TranslateFunc
	Locale           string
	Sequence         int64
}

func NewWebConn(ws *websocket.Conn, session model.Session, t goi18n.TranslateFunc, locale string) *WebConn {
	if len(session.UserId) > 0 {
		go func() {
			SetStatusOnline(session.UserId, session.Id, false)
			UpdateLastActivityAtIfNeeded(session)
		}()
	}

	return &WebConn{
		Send:             make(chan model.WebSocketMessage, SEND_QUEUE_SIZE),
		WebSocket:        ws,
		UserId:           session.UserId,
		SessionToken:     session.Token,
		SessionExpiresAt: session.ExpiresAt,
		T:                t,
		Locale:           locale,
	}
}

func (c *WebConn) ReadPump() {
	defer func() {
		HubUnregister(c)
		c.WebSocket.Close()
	}()
	c.WebSocket.SetReadLimit(model.SOCKET_MAX_MESSAGE_SIZE_KB)
	c.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
	c.WebSocket.SetPongHandler(func(string) error {
		c.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
		if c.IsAuthenticated() {
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
			Srv.WebSocketRouter.ServeWebSocket(c, &req)
		}
	}
}

func (c *WebConn) WritePump() {
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

			evt, evtOk := msg.(*model.WebSocketEvent)

			skipSend := false
			if len(c.Send) >= SEND_SLOW_WARN {
				// When the pump starts to get slow we'll drop non-critical messages
				if msg.EventType() == model.WEBSOCKET_EVENT_TYPING ||
					msg.EventType() == model.WEBSOCKET_EVENT_STATUS_CHANGE ||
					msg.EventType() == model.WEBSOCKET_EVENT_CHANNEL_VIEWED {
					l4g.Info(fmt.Sprintf("websocket.slow: dropping message userId=%v type=%v channelId=%v", c.UserId, msg.EventType(), evt.Broadcast.ChannelId))
					skipSend = true
				}
			}

			if !skipSend {
				var msgBytes []byte
				if evtOk {
					cpyEvt := &model.WebSocketEvent{}
					*cpyEvt = *evt
					cpyEvt.Sequence = c.Sequence
					msgBytes = []byte(cpyEvt.ToJson())
					c.Sequence++
				} else {
					msgBytes = []byte(msg.ToJson())
				}

				if len(c.Send) >= SEND_DEADLOCK_WARN {
					if evtOk {
						l4g.Error(fmt.Sprintf("websocket.full: message userId=%v type=%v channelId=%v size=%v", c.UserId, msg.EventType(), evt.Broadcast.ChannelId, len(msg.ToJson())))
					} else {
						l4g.Error(fmt.Sprintf("websocket.full: message userId=%v type=%v size=%v", c.UserId, msg.EventType(), len(msg.ToJson())))
					}
				}

				c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
				if err := c.WebSocket.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
					// browsers will appear as CloseNoStatusReceived
					if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
						l4g.Debug(fmt.Sprintf("websocket.send: client side closed socket userId=%v", c.UserId))
					} else {
						l4g.Debug(fmt.Sprintf("websocket.send: closing websocket for userId=%v, error=%v", c.UserId, err.Error()))
					}

					return
				}

				if einterfaces.GetMetricsInterface() != nil {
					go einterfaces.GetMetricsInterface().IncrementWebSocketBroadcast(msg.EventType())
				}

			}
		case <-ticker.C:
			c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.WebSocket.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				// browsers will appear as CloseNoStatusReceived
				if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
					l4g.Debug(fmt.Sprintf("websocket.ticker: client side closed socket userId=%v", c.UserId))
				} else {
					l4g.Debug(fmt.Sprintf("websocket.ticker: closing websocket for userId=%v error=%v", c.UserId, err.Error()))
				}

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

func (webCon *WebConn) InvalidateCache() {
	webCon.SessionExpiresAt = 0
	webCon.Session = nil
}

func (webCon *WebConn) IsAuthenticated() bool {
	// Check the expiry to see if we need to check for a new session
	if webCon.SessionExpiresAt < model.GetMillis() {
		if webCon.SessionToken == "" {
			return false
		}

		session, err := GetSession(webCon.SessionToken)
		if err != nil {
			l4g.Error(utils.T("api.websocket.invalid_session.error"), err.Error())
			webCon.SessionToken = ""
			webCon.SessionExpiresAt = 0
			webCon.Session = nil
			return false
		}

		webCon.SessionToken = session.Token
		webCon.SessionExpiresAt = session.ExpiresAt
		webCon.Session = session
	}

	return true
}

func (webCon *WebConn) SendHello() {
	msg := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_HELLO, "", "", webCon.UserId, nil)
	msg.Add("server_version", fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, model.BuildNumber, utils.ClientCfgHash, utils.IsLicensed))
	webCon.Send <- msg
}
