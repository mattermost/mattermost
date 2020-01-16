// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
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

func (wc *WebConn) GetSessionExpiresAt() int64 {
	return atomic.LoadInt64(&wc.sessionExpiresAt)
}

func (wc *WebConn) SetSessionExpiresAt(v int64) {
	atomic.StoreInt64(&wc.sessionExpiresAt, v)
}

func (wc *WebConn) GetSessionToken() string {
	return wc.sessionToken.Load().(string)
}

func (wc *WebConn) SetSessionToken(v string) {
	wc.sessionToken.Store(v)
}

func (wc *WebConn) GetSession() *model.Session {
	return wc.session.Load().(*model.Session)
}

func (wc *WebConn) SetSession(v *model.Session) {
	if v != nil {
		v = v.DeepCopy()
	}

	wc.session.Store(v)
}

func (wc *WebConn) Pump() {
	ch := make(chan struct{})
	go func() {
		wc.writePump()
		close(ch)
	}()
	wc.readPump()
	wc.closeOnce.Do(func() {
		close(wc.endWritePump)
	})
	<-ch
	wc.App.HubUnregister(wc)
	close(wc.pumpFinished)
}

func (wc *WebConn) readPump() {
	defer func() {
		wc.WebSocket.Close()
	}()
	wc.WebSocket.SetReadLimit(model.SOCKET_MAX_MESSAGE_SIZE_KB)
	wc.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
	wc.WebSocket.SetPongHandler(func(string) error {
		wc.WebSocket.SetReadDeadline(time.Now().Add(PONG_WAIT))
		if wc.IsAuthenticated() {
			wc.App.Srv.Go(func() {
				wc.App.SetStatusAwayIfNeeded(wc.UserId, false)
			})
		}
		return nil
	})

	for {
		var req model.WebSocketRequest
		if err := wc.WebSocket.ReadJSON(&req); err != nil {
			// browsers will appear as CloseNoStatusReceived
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
				mlog.Debug("websocket.read: client side closed socket", mlog.String("user_id", wc.UserId))
			} else {
				mlog.Debug("websocket.read: closing websocket", mlog.String("user_id", wc.UserId), mlog.Err(err))
			}
			return
		}
		wc.App.Srv.WebSocketRouter.ServeWebSocket(wc, &req)
	}
}

func (wc *WebConn) writePump() {
	ticker := time.NewTicker(PING_PERIOD)
	authTicker := time.NewTicker(AUTH_TIMEOUT)

	defer func() {
		ticker.Stop()
		authTicker.Stop()
		wc.WebSocket.Close()
	}()

	for {
		select {
		case msg, ok := <-wc.Send:
			if !ok {
				wc.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
				wc.WebSocket.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			evt, evtOk := msg.(*model.WebSocketEvent)

			skipSend := false
			if len(wc.Send) >= SEND_SLOW_WARN {
				// When the pump starts to get slow we'll drop non-critical messages
				if msg.EventType() == model.WEBSOCKET_EVENT_TYPING ||
					msg.EventType() == model.WEBSOCKET_EVENT_STATUS_CHANGE ||
					msg.EventType() == model.WEBSOCKET_EVENT_CHANNEL_VIEWED {
					mlog.Info(
						"websocket.slow: dropping message",
						mlog.String("user_id", wc.UserId),
						mlog.String("type", msg.EventType()),
						mlog.String("channel_id", evt.GetBroadcast().ChannelId),
					)
					skipSend = true
				}
			}

			if !skipSend {
				var msgBytes []byte
				if evtOk {
					cpyEvt := evt.SetSequence(wc.Sequence)
					msgBytes = []byte(cpyEvt.ToJson())
					wc.Sequence++
				} else {
					msgBytes = []byte(msg.ToJson())
				}

				if len(wc.Send) >= SEND_DEADLOCK_WARN {
					if evtOk {
						mlog.Warn(
							"websocket.full",
							mlog.String("user_id", wc.UserId),
							mlog.String("type", msg.EventType()),
							mlog.String("channel_id", evt.GetBroadcast().ChannelId),
							mlog.Int("size", len(msg.ToJson())),
						)
					} else {
						mlog.Warn(
							"websocket.full",
							mlog.String("user_id", wc.UserId),
							mlog.String("type", msg.EventType()),
							mlog.Int("size", len(msg.ToJson())),
						)
					}
				}

				wc.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
				if err := wc.WebSocket.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
					// browsers will appear as CloseNoStatusReceived
					if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
						mlog.Debug("websocket.send: client side closed socket", mlog.String("user_id", wc.UserId))
					} else {
						mlog.Debug("websocket.send: closing websocket", mlog.String("user_id", wc.UserId), mlog.Err(err))
					}
					return
				}

				if wc.App.Metrics != nil {
					wc.App.Srv.Go(func() {
						wc.App.Metrics.IncrementWebSocketBroadcast(msg.EventType())
					})
				}
			}

		case <-ticker.C:
			wc.WebSocket.SetWriteDeadline(time.Now().Add(WRITE_WAIT))
			if err := wc.WebSocket.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				// browsers will appear as CloseNoStatusReceived
				if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
					mlog.Debug("websocket.ticker: client side closed socket", mlog.String("user_id", wc.UserId))
				} else {
					mlog.Debug("websocket.ticker: closing websocket", mlog.String("user_id", wc.UserId), mlog.Err(err))
				}
				return
			}

		case <-wc.endWritePump:
			return

		case <-authTicker.C:
			if wc.GetSessionToken() == "" {
				mlog.Debug("websocket.authTicker: did not authenticate", mlog.Any("ip_address", wc.WebSocket.RemoteAddr()))
				return
			}
			authTicker.Stop()
		}
	}
}

func (wc *WebConn) InvalidateCache() {
	wc.AllChannelMembers = nil
	wc.LastAllChannelMembersTime = 0
	wc.SetSession(nil)
	wc.SetSessionExpiresAt(0)
}

func (wc *WebConn) IsAuthenticated() bool {
	// Check the expiry to see if we need to check for a new session
	if wc.GetSessionExpiresAt() < model.GetMillis() {
		if wc.GetSessionToken() == "" {
			return false
		}

		session, err := wc.App.GetSession(wc.GetSessionToken())
		if err != nil {
			mlog.Error("Invalid session.", mlog.Err(err))
			wc.SetSessionToken("")
			wc.SetSession(nil)
			wc.SetSessionExpiresAt(0)
			return false
		}

		wc.SetSession(session)
		wc.SetSessionExpiresAt(session.ExpiresAt)
	}

	return true
}

func (wc *WebConn) SendHello() {
	msg := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_HELLO, "", "", wc.UserId, nil)
	msg.Add("server_version", fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, model.BuildNumber, wc.App.ClientConfigHash(), wc.App.License() != nil))
	wc.Send <- msg
}

func (wc *WebConn) shouldSendEventToGuest(msg *model.WebSocketEvent) bool {
	var userId string
	var canSee bool

	switch msg.EventType() {
	case model.WEBSOCKET_EVENT_USER_UPDATED:
		user, ok := msg.GetData()["user"].(*model.User)
		if !ok {
			mlog.Error("webhub.shouldSendEvent: user not found in message", mlog.Any("user", msg.GetData()["user"]))
			return false
		}
		userId = user.Id
	case model.WEBSOCKET_EVENT_NEW_USER:
		userId = msg.GetData()["user_id"].(string)
	default:
		return true
	}

	canSee, err := wc.App.UserCanSeeOtherUser(wc.UserId, userId)
	if err != nil {
		mlog.Error("webhub.shouldSendEvent.", mlog.Err(err))
		return false
	}

	return canSee
}

func (wc *WebConn) ShouldSendEvent(msg *model.WebSocketEvent) bool {
	// IMPORTANT: Do not send event if WebConn does not have a session
	if !wc.IsAuthenticated() {
		return false
	}

	// If the event contains sanitized data, only send to users that don't have permission to
	// see sensitive data. Prevents admin clients from receiving events with bad data
	var hasReadPrivateDataPermission *bool
	if msg.GetBroadcast().ContainsSanitizedData {
		hasReadPrivateDataPermission = model.NewBool(wc.App.RolesGrantPermission(wc.GetSession().GetUserRoles(), model.PERMISSION_MANAGE_SYSTEM.Id))

		if *hasReadPrivateDataPermission {
			return false
		}
	}

	// If the event contains sensitive data, only send to users with permission to see it
	if msg.GetBroadcast().ContainsSensitiveData {
		if hasReadPrivateDataPermission == nil {
			hasReadPrivateDataPermission = model.NewBool(wc.App.RolesGrantPermission(wc.GetSession().GetUserRoles(), model.PERMISSION_MANAGE_SYSTEM.Id))
		}

		if !*hasReadPrivateDataPermission {
			return false
		}
	}

	// If the event is destined to a specific user
	if len(msg.GetBroadcast().UserId) > 0 {
		return wc.UserId == msg.GetBroadcast().UserId
	}

	// if the user is omitted don't send the message
	if len(msg.GetBroadcast().OmitUsers) > 0 {
		if _, ok := msg.GetBroadcast().OmitUsers[wc.UserId]; ok {
			return false
		}
	}

	// Only report events to users who are in the channel for the event
	if len(msg.GetBroadcast().ChannelId) > 0 {
		if model.GetMillis()-wc.LastAllChannelMembersTime > WEBCONN_MEMBER_CACHE_TIME {
			wc.AllChannelMembers = nil
			wc.LastAllChannelMembersTime = 0
		}

		if wc.AllChannelMembers == nil {
			result, err := wc.App.Srv.Store.Channel().GetAllChannelMembersForUser(wc.UserId, true, false)
			if err != nil {
				mlog.Error("webhub.shouldSendEvent.", mlog.Err(err))
				return false
			}
			wc.AllChannelMembers = result
			wc.LastAllChannelMembersTime = model.GetMillis()
		}

		if _, ok := wc.AllChannelMembers[msg.GetBroadcast().ChannelId]; ok {
			return true
		}
		return false
	}

	// Only report events to users who are in the team for the event
	if len(msg.GetBroadcast().TeamId) > 0 {
		return wc.IsMemberOfTeam(msg.GetBroadcast().TeamId)
	}

	if wc.GetSession().Props[model.SESSION_PROP_IS_GUEST] == "true" {
		return wc.shouldSendEventToGuest(msg)
	}

	return true
}

func (wc *WebConn) IsMemberOfTeam(teamId string) bool {
	currentSession := wc.GetSession()

	if currentSession == nil || len(currentSession.Token) == 0 {
		session, err := wc.App.GetSession(wc.GetSessionToken())
		if err != nil {
			mlog.Error("Invalid session.", mlog.Err(err))
			return false
		}
		wc.SetSession(session)
		currentSession = session
	}

	return currentSession.GetTeamByTeamId(teamId) != nil
}
