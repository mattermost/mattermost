// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
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
	sessionExpiresAt          int64 // This should stay at the top for 64-bit alignment of 64-bit words accessed atomically
	App                       *App
	WebSocket                 *websocket.Conn
	Send                      chan model.WebSocketMessage
	sessionToken              atomic.Value
	session                   atomic.Value
	LastUserActivityAt        int64
	UserId                    string
	T                         goi18n.TranslateFunc
	Locale                    string
	AllChannelMembers         map[string]string
	LastAllChannelMembersTime int64
	Sequence                  int64
	closeOnce                 sync.Once
	endWritePump              chan struct{}
	pumpFinished              chan struct{}
}

func (a *App) NewWebConn(ws *websocket.Conn, session model.Session, t goi18n.TranslateFunc, locale string) *WebConn {
	if len(session.UserId) > 0 {
		a.Srv.Go(func() {
			a.SetStatusOnline(session.UserId, false)
			a.UpdateLastActivityAtIfNeeded(session)
		})
	}

	wc := &WebConn{
		App:                a,
		Send:               make(chan model.WebSocketMessage, SEND_QUEUE_SIZE),
		WebSocket:          ws,
		LastUserActivityAt: model.GetMillis(),
		UserId:             session.UserId,
		T:                  t,
		Locale:             locale,
		endWritePump:       make(chan struct{}),
		pumpFinished:       make(chan struct{}),
	}

	wc.SetSession(&session)
	wc.SetSessionToken(session.Token)
	wc.SetSessionExpiresAt(session.ExpiresAt)

	return wc
}

func (wc *WebConn) Close() {
	wc.WebSocket.Close()
	wc.closeOnce.Do(func() {
		close(wc.endWritePump)
	})
	<-wc.pumpFinished
}

func (c *WebConn) GetSessionExpiresAt() int64 {
	return atomic.LoadInt64(&c.sessionExpiresAt)
}

func (c *WebConn) SetSessionExpiresAt(v int64) {
	atomic.StoreInt64(&c.sessionExpiresAt, v)
}

func (c *WebConn) GetSessionToken() string {
	return c.sessionToken.Load().(string)
}

func (c *WebConn) SetSessionToken(v string) {
	c.sessionToken.Store(v)
}

func (c *WebConn) GetSession() *model.Session {
	return c.session.Load().(*model.Session)
}

func (c *WebConn) SetSession(v *model.Session) {
	if v != nil {
		v = v.DeepCopy()
	}

	c.session.Store(v)
}

func (c *WebConn) Pump() {
	ch := make(chan struct{})
	go func() {
		c.writePump()
		close(ch)
	}()
	c.readPump()
	c.closeOnce.Do(func() {
		close(c.endWritePump)
	})
	<-ch
	c.App.HubUnregister(c)
	close(c.pumpFinished)
}

func (c *WebConn) readPump() {
	defer func() {
		c.WebSocket.Close()
	}()
	c.WebSocket.SetReadLimit(model.SOCKET_MAX_MESSAGE_SIZE_KB)
	c.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
	c.WebSocket.SetPongHandler(func(string) error {
		c.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
		if c.IsAuthenticated() {
			c.App.Srv.Go(func() {
				c.App.SetStatusAwayIfNeeded(c.UserId, false)
			})
		}
		return nil
	})

	for {
		var req model.WebSocketRequest
		if err := c.WebSocket.ReadJSON(&req); err != nil {
			// browsers will appear as CloseNoStatusReceived
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
				mlog.Debug("websocket.read: client side closed socket", mlog.String("user_id", c.UserId))
			} else {
				mlog.Debug("websocket.read: closing websocket", mlog.String("user_id", c.UserId), mlog.Err(err))
			}
			return
		}
		c.App.Srv.WebSocketRouter.ServeWebSocket(c, &req)
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

			evt, evtOk := msg.(*model.WebSocketEvent)

			skipSend := false
			if len(c.Send) >= SEND_SLOW_WARN {
				// When the pump starts to get slow we'll drop non-critical messages
				if msg.EventType() == model.WEBSOCKET_EVENT_TYPING ||
					msg.EventType() == model.WEBSOCKET_EVENT_STATUS_CHANGE ||
					msg.EventType() == model.WEBSOCKET_EVENT_CHANNEL_VIEWED {
					mlog.Info(
						"websocket.slow: dropping message",
						mlog.String("user_id", c.UserId),
						mlog.String("type", msg.EventType()),
						mlog.String("channel_id", evt.Broadcast.ChannelId),
					)
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
						mlog.Warn(
							"websocket.full",
							mlog.String("user_id", c.UserId),
							mlog.String("type", msg.EventType()),
							mlog.String("channel_id", evt.Broadcast.ChannelId),
							mlog.Int("size", len(msg.ToJson())),
						)
					} else {
						mlog.Warn(
							"websocket.full",
							mlog.String("user_id", c.UserId),
							mlog.String("type", msg.EventType()),
							mlog.Int("size", len(msg.ToJson())),
						)
					}
				}

				c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
				if err := c.WebSocket.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
					// browsers will appear as CloseNoStatusReceived
					if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
						mlog.Debug("websocket.send: client side closed socket", mlog.String("user_id", c.UserId))
					} else {
						mlog.Debug("websocket.send: closing websocket", mlog.String("user_id", c.UserId), mlog.Err(err))
					}
					return
				}

				if c.App.Metrics != nil {
					c.App.Srv.Go(func() {
						c.App.Metrics.IncrementWebSocketBroadcast(msg.EventType())
					})
				}
			}

		case <-ticker.C:
			c.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := c.WebSocket.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				// browsers will appear as CloseNoStatusReceived
				if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
					mlog.Debug("websocket.ticker: client side closed socket", mlog.String("user_id", c.UserId))
				} else {
					mlog.Debug("websocket.ticker: closing websocket", mlog.String("user_id", c.UserId), mlog.Err(err))
				}
				return
			}

		case <-c.endWritePump:
			return

		case <-authTicker.C:
			if c.GetSessionToken() == "" {
				mlog.Debug("websocket.authTicker: did not authenticate", mlog.Any("ip_address", c.WebSocket.RemoteAddr()))
				return
			}
			authTicker.Stop()
		}
	}
}

func (webCon *WebConn) InvalidateCache() {
	webCon.AllChannelMembers = nil
	webCon.LastAllChannelMembersTime = 0
	webCon.SetSession(nil)
	webCon.SetSessionExpiresAt(0)
}

func (webCon *WebConn) IsAuthenticated() bool {
	// Check the expiry to see if we need to check for a new session
	if webCon.GetSessionExpiresAt() < model.GetMillis() {
		if webCon.GetSessionToken() == "" {
			return false
		}

		session, err := webCon.App.GetSession(webCon.GetSessionToken())
		if err != nil {
			mlog.Error("Invalid session.", mlog.Err(err))
			webCon.SetSessionToken("")
			webCon.SetSession(nil)
			webCon.SetSessionExpiresAt(0)
			return false
		}

		webCon.SetSession(session)
		webCon.SetSessionExpiresAt(session.ExpiresAt)
	}

	return true
}

func (webCon *WebConn) SendHello() {
	msg := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_HELLO, "", "", webCon.UserId, nil)
	msg.Add("server_version", fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, model.BuildNumber, webCon.App.ClientConfigHash(), webCon.App.License() != nil))
	webCon.Send <- msg
}

func (webCon *WebConn) ShouldSendEvent(msg *model.WebSocketEvent) bool {
	// IMPORTANT: Do not send event if WebConn does not have a session
	if !webCon.IsAuthenticated() {
		return false
	}

	// If the event contains sanitized data, only send to users that don't have permission to
	// see sensitive data. Prevents admin clients from receiving events with bad data
	var hasReadPrivateDataPermission *bool
	if msg.Broadcast.ContainsSanitizedData {
		hasReadPrivateDataPermission = model.NewBool(webCon.App.RolesGrantPermission(webCon.GetSession().GetUserRoles(), model.PERMISSION_MANAGE_SYSTEM.Id))

		if *hasReadPrivateDataPermission {
			return false
		}
	}

	// If the event contains sensitive data, only send to users with permission to see it
	if msg.Broadcast.ContainsSensitiveData {
		if hasReadPrivateDataPermission == nil {
			hasReadPrivateDataPermission = model.NewBool(webCon.App.RolesGrantPermission(webCon.GetSession().GetUserRoles(), model.PERMISSION_MANAGE_SYSTEM.Id))
		}

		if !*hasReadPrivateDataPermission {
			return false
		}
	}

	// If the event is destined to a specific user
	if len(msg.Broadcast.UserId) > 0 {
		if webCon.UserId == msg.Broadcast.UserId {
			return true
		}
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
		if model.GetMillis()-webCon.LastAllChannelMembersTime > WEBCONN_MEMBER_CACHE_TIME {
			webCon.AllChannelMembers = nil
			webCon.LastAllChannelMembersTime = 0
		}

		if webCon.AllChannelMembers == nil {
			result, err := webCon.App.Srv.Store.Channel().GetAllChannelMembersForUser(webCon.UserId, true, false)
			if err != nil {
				mlog.Error("webhub.shouldSendEvent.", mlog.Err(err))
				return false
			}
			webCon.AllChannelMembers = result
			webCon.LastAllChannelMembersTime = model.GetMillis()
		}

		if _, ok := webCon.AllChannelMembers[msg.Broadcast.ChannelId]; ok {
			return true
		}
		return false
	}

	// Only report events to users who are in the team for the event
	if len(msg.Broadcast.TeamId) > 0 {
		return webCon.IsMemberOfTeam(msg.Broadcast.TeamId)
	}

	if msg.Event == model.WEBSOCKET_EVENT_USER_UPDATED && webCon.GetSession().Props[model.SESSION_PROP_IS_GUEST] == "true" {
		canSee, err := webCon.App.UserCanSeeOtherUser(webCon.UserId, msg.Data["user"].(*model.User).Id)
		if err != nil {
			mlog.Error("webhub.shouldSendEvent.", mlog.Err(err))
			return false
		}
		return canSee
	}

	return true
}

func (webCon *WebConn) IsMemberOfTeam(teamId string) bool {
	currentSession := webCon.GetSession()

	if currentSession == nil || len(currentSession.Token) == 0 {
		session, err := webCon.App.GetSession(webCon.GetSessionToken())
		if err != nil {
			mlog.Error("Invalid session.", mlog.Err(err))
			return false
		}
		webCon.SetSession(session)
		currentSession = session
	}

	member := currentSession.GetTeamByTeamId(teamId)

	if member != nil {
		return true
	}
	return false
}
