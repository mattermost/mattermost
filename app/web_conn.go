// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/vmihailenco/msgpack/v5"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	sendQueueSize          = 256
	sendSlowWarn           = (sendQueueSize * 50) / 100
	sendFullWarn           = (sendQueueSize * 95) / 100
	writeWaitTime          = 30 * time.Second
	pongWaitTime           = 100 * time.Second
	pingInterval           = (pongWaitTime * 6) / 10
	authCheckInterval      = 5 * time.Second
	webConnMemberCacheTime = 1000 * 60 * 30 // 30 minutes
	deadQueueSize          = 128            // Approximated from /proc/sys/net/core/wmem_default / 2048 (avg msg size)
)

const (
	reconnectFound    = "success"
	reconnectNotFound = "failure"
	reconnectLossless = "lossless"
)

const websocketMessagePluginPrefix = "custom_"

type pluginWSPostedHook struct {
	connectionID string
	userID       string
	req          *model.WebSocketRequest
}

type WebConnConfig struct {
	WebSocket    *websocket.Conn
	Session      model.Session
	TFunc        i18n.TranslateFunc
	Locale       string
	ConnectionID string
	Active       bool
	ReuseCount   int
	CTX          request.CTX

	// These aren't necessary to be exported to api layer.
	sequence         int
	activeQueue      chan model.WebSocketMessage
	deadQueue        []*model.WebSocketEvent
	deadQueuePointer int
}

// WebConn represents a single websocket connection to a user.
// It contains all the necessary state to manage sending/receiving data to/from
// a websocket.
type WebConn struct {
	sessionExpiresAt int64 // This should stay at the top for 64-bit alignment of 64-bit words accessed atomically
	App              *App
	WebSocket        *websocket.Conn
	T                i18n.TranslateFunc
	Locale           string
	Sequence         int64
	UserId           string

	ctx                       request.CTX
	allChannelMembers         map[string]string
	lastAllChannelMembersTime int64
	lastUserActivityAt        int64
	send                      chan model.WebSocketMessage
	// deadQueue behaves like a queue of a finite size
	// which is used to store all messages that are sent via the websocket.
	// It basically acts as the user-space socket buffer, and is used
	// to resuscitate any messages that might have got lost when the connection is broken.
	// It is implemented by using a circular buffer to keep it fast.
	deadQueue []*model.WebSocketEvent
	// Pointer which indicates the next slot to insert.
	// It is only to be incremented during writing or clearing the queue.
	deadQueuePointer int
	// active indicates whether there is an open websocket connection attached
	// to this webConn or not.
	// It is not used as an atomic, because there is no need to.
	// So do not use this outside the web hub.
	active bool
	// reuseCount indicates how many times this connection has been reused.
	// This is used to differentiate between a fresh connection and
	// a reused connection.
	// It's theoretically possible for this number to wrap around. But we
	// leave that as an edge-case.
	reuseCount   int
	sessionToken atomic.Value
	session      atomic.Value
	connectionID atomic.Value
	endWritePump chan struct{}
	pumpFinished chan struct{}
	pluginPosted chan pluginWSPostedHook
}

// CheckConnResult indicates whether a connectionID was present in the hub or not.
// And if so, contains the active and dead queue details.
type CheckConnResult struct {
	ConnectionID     string
	UserID           string
	ActiveQueue      chan model.WebSocketMessage
	DeadQueue        []*model.WebSocketEvent
	DeadQueuePointer int
	ReuseCount       int
}

// PopulateWebConnConfig checks if the connection id already exists in the hub,
// and if so, accordingly populates the other fields of the webconn.
func (a *App) PopulateWebConnConfig(s *model.Session, cfg *WebConnConfig, seqVal string) (*WebConnConfig, error) {
	if !model.IsValidId(cfg.ConnectionID) {
		return nil, fmt.Errorf("invalid connection id: %s", cfg.ConnectionID)
	}

	// This does not handle reconnect requests across nodes in a cluster.
	// It falls back to the non-reliable case in that scenario.
	res := a.CheckWebConn(s.UserId, cfg.ConnectionID)
	if res == nil {
		// If the connection is not present, then we assume either timeout,
		// or server restart. In that case, we set a new one.
		cfg.ConnectionID = model.NewId()
	} else {
		// Connection is present, we get the active queue, dead queue
		cfg.activeQueue = res.ActiveQueue
		cfg.deadQueue = res.DeadQueue
		cfg.deadQueuePointer = res.DeadQueuePointer
		cfg.Active = false
		cfg.ReuseCount = res.ReuseCount
		// Now we get the sequence number
		if seqVal == "" {
			// Sequence_number must be sent with connection id.
			// A client must be either non-compliant or fully compliant.
			return nil, errors.New("sequence number not present in websocket request")
		}
		var err error
		cfg.sequence, err = strconv.Atoi(seqVal)
		if err != nil || cfg.sequence < 0 {
			return nil, fmt.Errorf("invalid sequence number %s in query param: %v", seqVal, err)
		}
	}
	return cfg, nil
}

// NewWebConn returns a new WebConn instance.
func (a *App) NewWebConn(cfg *WebConnConfig) *WebConn {
	if cfg.Session.UserId != "" {
		a.Srv().Go(func() {
			a.SetStatusOnline(cfg.CTX, cfg.Session.UserId, false)
			a.UpdateLastActivityAtIfNeeded(cfg.CTX, cfg.Session)
		})
	}

	// Disable TCP_NO_DELAY for higher throughput
	var tcpConn *net.TCPConn
	switch conn := cfg.WebSocket.UnderlyingConn().(type) {
	case *net.TCPConn:
		tcpConn = conn
	case *tls.Conn:
		newConn, ok := conn.NetConn().(*net.TCPConn)
		if ok {
			tcpConn = newConn
		}
	}

	if tcpConn != nil {
		err := tcpConn.SetNoDelay(false)
		if err != nil {
			cfg.CTX.Logger().Warn("Error in setting NoDelay socket opts", mlog.Err(err))
		}
	}

	if cfg.activeQueue == nil {
		cfg.activeQueue = make(chan model.WebSocketMessage, sendQueueSize)
	}

	if cfg.deadQueue == nil {
		cfg.deadQueue = make([]*model.WebSocketEvent, deadQueueSize)
	}

	wc := &WebConn{
		App:                a,
		send:               cfg.activeQueue,
		deadQueue:          cfg.deadQueue,
		deadQueuePointer:   cfg.deadQueuePointer,
		Sequence:           int64(cfg.sequence),
		WebSocket:          cfg.WebSocket,
		lastUserActivityAt: model.GetMillis(),
		UserId:             cfg.Session.UserId,
		T:                  cfg.TFunc,
		Locale:             cfg.Locale,
		ctx:                cfg.CTX,
		active:             cfg.Active,
		reuseCount:         cfg.ReuseCount,
		endWritePump:       make(chan struct{}),
		pumpFinished:       make(chan struct{}),
		pluginPosted:       make(chan pluginWSPostedHook, 10),
	}

	wc.SetSession(&cfg.Session)
	wc.SetSessionToken(cfg.Session.Token)
	wc.SetSessionExpiresAt(cfg.Session.ExpiresAt)
	wc.SetConnectionID(cfg.ConnectionID)

	if pluginsEnvironment := wc.App.GetPluginsEnvironment(); pluginsEnvironment != nil {
		wc.App.Srv().Go(func() {
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.OnWebSocketConnect(wc.GetConnectionID(), wc.UserId)
				return true
			}, plugin.OnWebSocketConnectID)
		})
	}

	return wc
}

func (wc *WebConn) pluginPostedConsumer(wg *sync.WaitGroup) {
	defer wg.Done()

	for msg := range wc.pluginPosted {
		if pluginsEnvironment := wc.App.GetPluginsEnvironment(); pluginsEnvironment != nil {
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.WebSocketMessageHasBeenPosted(msg.connectionID, msg.userID, msg.req)
				return true
			}, plugin.WebSocketMessageHasBeenPostedID)
		}
	}
}

// Close closes the WebConn.
func (wc *WebConn) Close() {
	wc.WebSocket.Close()
	<-wc.pumpFinished
}

// GetSessionExpiresAt returns the time at which the session expires.
func (wc *WebConn) GetSessionExpiresAt() int64 {
	return atomic.LoadInt64(&wc.sessionExpiresAt)
}

// SetSessionExpiresAt sets the time at which the session expires.
func (wc *WebConn) SetSessionExpiresAt(v int64) {
	atomic.StoreInt64(&wc.sessionExpiresAt, v)
}

// GetSessionToken returns the session token of the connection.
func (wc *WebConn) GetSessionToken() string {
	return wc.sessionToken.Load().(string)
}

// SetSessionToken sets the session token of the connection.
func (wc *WebConn) SetSessionToken(v string) {
	wc.sessionToken.Store(v)
}

// SetConnectionID sets the connection id of the connection.
func (wc *WebConn) SetConnectionID(id string) {
	wc.connectionID.Store(id)
}

// GetConnectionID returns the connection id of the connection.
func (wc *WebConn) GetConnectionID() string {
	return wc.connectionID.Load().(string)
}

// areAllInactive returns whether all of the connections
// are inactive or not.
func areAllInactive(conns []*WebConn) bool {
	for _, conn := range conns {
		if conn.active {
			return false
		}
	}
	return true
}

// GetSession returns the session of the connection.
func (wc *WebConn) GetSession() *model.Session {
	return wc.session.Load().(*model.Session)
}

// SetSession sets the session of the connection.
func (wc *WebConn) SetSession(v *model.Session) {
	if v != nil {
		v = v.DeepCopy()
	}

	wc.session.Store(v)
}

// Pump starts the WebConn instance. After this, the websocket
// is ready to send/receive messages.
func (wc *WebConn) Pump() {
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		wc.writePump()
	}()

	wg.Add(1)
	go wc.pluginPostedConsumer(&wg)

	wc.readPump()
	close(wc.endWritePump)
	close(wc.pluginPosted)
	wg.Wait()
	wc.App.HubUnregister(wc)
	close(wc.pumpFinished)

	if pluginsEnvironment := wc.App.GetPluginsEnvironment(); pluginsEnvironment != nil {
		wc.App.Srv().Go(func() {
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.OnWebSocketDisconnect(wc.GetConnectionID(), wc.UserId)
				return true
			}, plugin.OnWebSocketDisconnectID)
		})
	}
}

func (wc *WebConn) readPump() {
	defer func() {
		wc.WebSocket.Close()
	}()
	wc.WebSocket.SetReadLimit(model.SocketMaxMessageSizeKb)
	wc.WebSocket.SetReadDeadline(time.Now().Add(pongWaitTime))
	wc.WebSocket.SetPongHandler(func(string) error {
		if err := wc.WebSocket.SetReadDeadline(time.Now().Add(pongWaitTime)); err != nil {
			return err
		}
		if wc.IsAuthenticated(wc.ctx) {
			wc.App.Srv().Go(func() {
				wc.App.SetStatusAwayIfNeeded(wc.ctx, wc.UserId, false)
			})
		}
		return nil
	})

	for {
		msgType, rd, err := wc.WebSocket.NextReader()
		if err != nil {
			wc.logSocketErr("websocket.NextReader", err)
			return
		}

		var decoder interface {
			Decode(v any) error
		}
		if msgType == websocket.TextMessage {
			decoder = json.NewDecoder(rd)
		} else {
			decoder = msgpack.NewDecoder(rd)
		}
		var req model.WebSocketRequest
		if err = decoder.Decode(&req); err != nil {
			wc.logSocketErr("websocket.Decode", err)
			return
		}

		// Messages which actions are prefixed with the plugin prefix
		// should only be dispatched to the plugins
		if !strings.HasPrefix(req.Action, websocketMessagePluginPrefix) {
			wc.App.Srv().WebSocketRouter.ServeWebSocket(wc.ctx, wc, &req)
		}

		clonedReq, err := req.Clone()
		if err != nil {
			wc.logSocketErr("websocket.cloneRequest", err)
			continue
		}

		wc.pluginPosted <- pluginWSPostedHook{wc.GetConnectionID(), wc.UserId, clonedReq}
	}
}

func (wc *WebConn) writePump() {
	ticker := time.NewTicker(pingInterval)
	authTicker := time.NewTicker(authCheckInterval)

	defer func() {
		ticker.Stop()
		authTicker.Stop()
		wc.WebSocket.Close()
	}()

	if wc.Sequence != 0 {
		if ok, index := wc.isInDeadQueue(wc.Sequence); ok {
			if err := wc.drainDeadQueue(wc.ctx, index); err != nil {
				wc.logSocketErr("websocket.drainDeadQueue", err)
				return
			}
			if m := wc.App.Metrics(); m != nil {
				m.IncrementWebsocketReconnectEvent(reconnectFound)
			}
		} else if wc.hasMsgLoss() {
			// If the seq number is not in dead queue, but it was supposed to be,
			// then generate a different connection ID,
			// and set sequence to 0, and clear dead queue.
			wc.clearDeadQueue()
			wc.SetConnectionID(model.NewId())
			wc.Sequence = 0

			// Send hello message
			msg := wc.createHelloMessage()
			wc.addToDeadQueue(msg)
			if err := wc.writeMessage(wc.ctx, msg); err != nil {
				wc.logSocketErr("websocket.sendHello", err)
				return
			}
			if m := wc.App.Metrics(); m != nil {
				m.IncrementWebsocketReconnectEvent(reconnectNotFound)
			}
		} else {
			if m := wc.App.Metrics(); m != nil {
				m.IncrementWebsocketReconnectEvent(reconnectLossless)
			}
		}
	}

	var buf bytes.Buffer
	// 2k is seen to be a good heuristic under which 98.5% of message sizes remain.
	buf.Grow(1024 * 2)
	enc := json.NewEncoder(&buf)

	for {
		select {
		case msg, ok := <-wc.send:
			if !ok {
				wc.writeMessageBuf(websocket.CloseMessage, []byte{})
				return
			}

			evt, evtOk := msg.(*model.WebSocketEvent)

			buf.Reset()
			var err error
			if evtOk {
				evt = evt.SetSequence(wc.Sequence)
				err = evt.Encode(enc)
				wc.Sequence++
			} else {
				err = enc.Encode(msg)
			}
			if err != nil {
				wc.ctx.Logger().Warn("Error in encoding websocket message", mlog.Err(err))
				continue
			}

			if len(wc.send) >= sendFullWarn {
				logData := []mlog.Field{
					mlog.String("user_id", wc.UserId),
					mlog.String("type", msg.EventType()),
					mlog.Int("size", buf.Len()),
				}
				if evtOk {
					logData = append(logData, mlog.String("channel_id", evt.GetBroadcast().ChannelId))
				}

				wc.ctx.Logger().Warn("websocket.full", logData...)
			}

			if evtOk {
				wc.addToDeadQueue(evt)
			}

			if err := wc.writeMessageBuf(websocket.TextMessage, buf.Bytes()); err != nil {
				wc.logSocketErr("websocket.send", err)
				return
			}

			if wc.App.Metrics() != nil {
				wc.App.Metrics().IncrementWebSocketBroadcast(msg.EventType())
			}
		case <-ticker.C:
			if err := wc.writeMessageBuf(websocket.PingMessage, []byte{}); err != nil {
				wc.logSocketErr("websocket.ticker", err)
				return
			}

		case <-wc.endWritePump:
			return

		case <-authTicker.C:
			if wc.GetSessionToken() == "" {
				wc.ctx.Logger().Debug("websocket.authTicker: did not authenticate", mlog.Any("ip_address", wc.WebSocket.RemoteAddr()))
				return
			}
			authTicker.Stop()
		}
	}
}

// writeMessageBuf is a helper utility that wraps the write to the socket
// along with setting the write deadline.
func (wc *WebConn) writeMessageBuf(msgType int, data []byte) error {
	wc.WebSocket.SetWriteDeadline(time.Now().Add(writeWaitTime))
	return wc.WebSocket.WriteMessage(msgType, data)
}

func (wc *WebConn) writeMessage(c request.CTX, msg *model.WebSocketEvent) error {
	// We don't use the encoder from the write pump because it's unwieldy to pass encoders
	// around, and this is only called during initialization of the webConn.
	var buf bytes.Buffer
	err := msg.Encode(json.NewEncoder(&buf))
	if err != nil {
		c.Logger().Warn("Error in encoding websocket message", mlog.Err(err))
		return nil
	}
	wc.Sequence++

	return wc.writeMessageBuf(websocket.TextMessage, buf.Bytes())
}

// addToDeadQueue appends a message to the dead queue.
func (wc *WebConn) addToDeadQueue(msg *model.WebSocketEvent) {
	wc.deadQueue[wc.deadQueuePointer] = msg
	wc.deadQueuePointer = (wc.deadQueuePointer + 1) % deadQueueSize
}

// hasMsgLoss indicates whether the next wanted sequence is right after
// the latest element in the dead queue, which would mean there is no message loss.
func (wc *WebConn) hasMsgLoss() bool {
	var index int
	// deadQueuePointer = 0 means either no msg written or the pointer
	// has rolled over to its starting position.
	if wc.deadQueuePointer == 0 {
		// If last entry is nil, it means no msg is written.
		if wc.deadQueue[deadQueueSize-1] == nil {
			return false
		}
		// If it's not nil, that means it has rolled over to start, and we
		// check the last position.
		index = deadQueueSize - 1
	} else { // deadQueuePointer != 0 means it's somewhere in the middle.
		index = wc.deadQueuePointer - 1
	}

	if wc.deadQueue[index].GetSequence() == wc.Sequence-1 {
		return false
	}
	return true
}

// isInDeadQueue checks whether a given sequence number is in the dead queue or not.
// And if it is, it returns that index.
func (wc *WebConn) isInDeadQueue(seq int64) (bool, int) {
	// Can be optimized to traverse backwards from deadQueuePointer
	// Hopefully, traversing 128 elements is not too much overhead.
	for i := 0; i < deadQueueSize; i++ {
		elem := wc.deadQueue[i]
		if elem == nil {
			return false, 0
		}

		if elem.GetSequence() == seq {
			return true, i
		}
	}
	return false, 0
}

func (wc *WebConn) clearDeadQueue() {
	for i := 0; i < deadQueueSize; i++ {
		if wc.deadQueue[i] == nil {
			break
		}
		wc.deadQueue[i] = nil
	}
	wc.deadQueuePointer = 0
}

// drainDeadQueue will write all messages from a given index to the socket.
// It is called with the assumption that the item with wc.Sequence is present
// in it, because otherwise it would have been cleared from WebConn.
func (wc *WebConn) drainDeadQueue(c request.CTX, index int) error {
	if wc.deadQueue[0] == nil {
		// Empty queue
		return nil
	}

	// This means pointer hasn't rolled over.
	if wc.deadQueue[wc.deadQueuePointer] == nil {
		// Clear till the end of queue.
		for i := index; i < wc.deadQueuePointer; i++ {
			if err := wc.writeMessage(c, wc.deadQueue[i]); err != nil {
				return err
			}
		}
		return nil
	}

	// We go on until next sequence number is smaller than previous one.
	// Which means it has rolled over.
	currPtr := index
	for {
		if err := wc.writeMessage(c, wc.deadQueue[currPtr]); err != nil {
			return err
		}
		oldSeq := wc.deadQueue[currPtr].GetSequence() // TODO: possibly move this
		currPtr = (currPtr + 1) % deadQueueSize       // to for loop condition
		newSeq := wc.deadQueue[currPtr].GetSequence()
		if oldSeq > newSeq {
			break
		}
	}
	return nil
}

// InvalidateCache resets all internal data of the WebConn.
func (wc *WebConn) InvalidateCache() {
	wc.allChannelMembers = nil
	wc.lastAllChannelMembersTime = 0
	wc.SetSession(nil)
	wc.SetSessionExpiresAt(0)
}

// IsAuthenticated returns whether the given WebConn is authenticated or not.
func (wc *WebConn) IsAuthenticated(c request.CTX) bool {
	// Check the expiry to see if we need to check for a new session
	if wc.GetSessionExpiresAt() < model.GetMillis() {
		if wc.GetSessionToken() == "" {
			return false
		}

		session, err := wc.App.GetSession(c, wc.GetSessionToken())
		if err != nil {
			if err.StatusCode >= http.StatusBadRequest && err.StatusCode < http.StatusInternalServerError {
				c.Logger().Debug("Invalid session.", mlog.Err(err))
			} else {
				c.Logger().Error("Could not get session", mlog.String("session_token", wc.GetSessionToken()), mlog.Err(err))
			}

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

func (wc *WebConn) createHelloMessage() *model.WebSocketEvent {
	msg := model.NewWebSocketEvent(model.WebsocketEventHello, "", "", wc.UserId, nil, "")
	msg.Add("server_version", fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion,
		model.BuildNumber,
		wc.App.ClientConfigHash(),
		wc.App.Channels().License() != nil))
	msg.Add("connection_id", wc.connectionID.Load())
	return msg
}

func (wc *WebConn) shouldSendEventToGuest(c request.CTX, msg *model.WebSocketEvent) bool {
	var userID string
	var canSee bool

	switch msg.EventType() {
	case model.WebsocketEventUserUpdated:
		user, ok := msg.GetData()["user"].(*model.User)
		if !ok {
			c.Logger().Debug("webhub.shouldSendEvent: user not found in message", mlog.Any("user", msg.GetData()["user"]))
			return false
		}
		userID = user.Id
	case model.WebsocketEventNewUser:
		userID = msg.GetData()["user_id"].(string)
	default:
		return true
	}

	canSee, err := wc.App.UserCanSeeOtherUser(c, wc.UserId, userID)
	if err != nil {
		c.Logger().Error("webhub.shouldSendEvent.", mlog.Err(err))
		return false
	}

	return canSee
}

// shouldSendEvent returns whether the message should be sent or not.
func (wc *WebConn) shouldSendEvent(c request.CTX, msg *model.WebSocketEvent) bool {
	// IMPORTANT: Do not send event if WebConn does not have a session
	if !wc.IsAuthenticated(c) {
		return false
	}

	// When the pump starts to get slow we'll drop non-critical
	// messages. We should skip those frames before they are
	// queued to wc.send buffered channel.
	if len(wc.send) >= sendSlowWarn {
		switch msg.EventType() {
		case model.WebsocketEventTyping,
			model.WebsocketEventStatusChange,
			model.WebsocketEventChannelViewed:
			c.Logger().Warn(
				"websocket.slow: dropping message",
				mlog.String("user_id", wc.UserId),
				mlog.String("type", msg.EventType()),
			)
			return false
		}
	}

	// If the event contains sanitized data, only send to users that don't have permission to
	// see sensitive data. Prevents admin clients from receiving events with bad data
	var hasReadPrivateDataPermission *bool
	if msg.GetBroadcast().ContainsSanitizedData {
		hasReadPrivateDataPermission = model.NewBool(wc.App.RolesGrantPermission(c, wc.GetSession().GetUserRoles(), model.PermissionManageSystem.Id))

		if *hasReadPrivateDataPermission {
			return false
		}
	}

	// If the event contains sensitive data, only send to users with permission to see it
	if msg.GetBroadcast().ContainsSensitiveData {
		if hasReadPrivateDataPermission == nil {
			hasReadPrivateDataPermission = model.NewBool(wc.App.RolesGrantPermission(c, wc.GetSession().GetUserRoles(), model.PermissionManageSystem.Id))
		}

		if !*hasReadPrivateDataPermission {
			return false
		}
	}

	// If the event is destined to a specific connection
	if msg.GetBroadcast().ConnectionId != "" {
		return wc.GetConnectionID() == msg.GetBroadcast().ConnectionId
	}

	// if the connection is omitted don't send the message
	if wc.GetConnectionID() == msg.GetBroadcast().OmitConnectionId {
		return false
	}

	// If the event is destined to a specific user
	if msg.GetBroadcast().UserId != "" {
		return wc.UserId == msg.GetBroadcast().UserId
	}

	// if the user is omitted don't send the message
	if len(msg.GetBroadcast().OmitUsers) > 0 {
		if _, ok := msg.GetBroadcast().OmitUsers[wc.UserId]; ok {
			return false
		}
	}

	// Only report events to users who are in the channel for the event
	if msg.GetBroadcast().ChannelId != "" {
		if model.GetMillis()-wc.lastAllChannelMembersTime > webConnMemberCacheTime {
			wc.allChannelMembers = nil
			wc.lastAllChannelMembersTime = 0
		}

		if wc.allChannelMembers == nil {
			result, err := wc.App.Srv().Store.Channel().GetAllChannelMembersForUser(wc.UserId, false, false)
			if err != nil {
				c.Logger().Error("webhub.shouldSendEvent.", mlog.Err(err))
				return false
			}
			wc.allChannelMembers = result
			wc.lastAllChannelMembersTime = model.GetMillis()
		}

		if _, ok := wc.allChannelMembers[msg.GetBroadcast().ChannelId]; ok {
			return true
		}
		return false
	}

	// Only report events to users who are in the team for the event
	if msg.GetBroadcast().TeamId != "" {
		return wc.isMemberOfTeam(c, msg.GetBroadcast().TeamId)
	}

	if wc.GetSession().Props[model.SessionPropIsGuest] == "true" {
		return wc.shouldSendEventToGuest(c, msg)
	}

	return true
}

// IsMemberOfTeam returns whether the user of the WebConn
// is a member of the given teamID or not.
func (wc *WebConn) isMemberOfTeam(c request.CTX, teamID string) bool {
	currentSession := wc.GetSession()

	if currentSession == nil || currentSession.Token == "" {
		session, err := wc.App.GetSession(c, wc.GetSessionToken())
		if err != nil {
			if err.StatusCode >= http.StatusBadRequest && err.StatusCode < http.StatusInternalServerError {
				c.Logger().Debug("Invalid session.", mlog.Err(err))
			} else {
				c.Logger().Error("Could not get session", mlog.String("session_token", wc.GetSessionToken()), mlog.Err(err))
			}
			return false
		}
		wc.SetSession(session)
		currentSession = session
	}

	return currentSession.GetTeamByTeamId(teamID) != nil
}

func (wc *WebConn) logSocketErr(source string, err error) {
	// browsers will appear as CloseNoStatusReceived
	if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
		wc.ctx.Logger().Debug(source+": client side closed socket", mlog.String("user_id", wc.UserId))
	} else {
		wc.ctx.Logger().Debug(source+": closing websocket", mlog.String("user_id", wc.UserId), mlog.Err(err))
	}
}
