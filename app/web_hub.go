// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"hash/fnv"
	"runtime"
	"runtime/debug"
	"strconv"
	"sync/atomic"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	broadcastQueueSize = 4096
)

type webConnActivityMessage struct {
	userId       string
	sessionToken string
	activityAt   int64
}

type webConnDirectMessage struct {
	conn *WebConn
	msg  model.WebSocketMessage
}

// Hub is the central place to manage all websocket connections in the server.
// It handles different websocket events and sending messages to individual
// user connections.
type Hub struct {
	// connectionCount should be kept first.
	// See https://github.com/mattermost/mattermost-server/pull/7281
	connectionCount int64
	app             *App
	connectionIndex int
	register        chan *WebConn
	unregister      chan *WebConn
	broadcast       chan *model.WebSocketEvent
	stop            chan struct{}
	didStop         chan struct{}
	invalidateUser  chan string
	activity        chan *webConnActivityMessage
	directMsg       chan *webConnDirectMessage
	explicitStop    bool
}

// NewWebHub creates a new Hub.
func (a *App) NewWebHub() *Hub {
	return &Hub{
		app:            a,
		register:       make(chan *WebConn, 1),
		unregister:     make(chan *WebConn, 1),
		broadcast:      make(chan *model.WebSocketEvent, broadcastQueueSize),
		stop:           make(chan struct{}),
		didStop:        make(chan struct{}),
		invalidateUser: make(chan string),
		activity:       make(chan *webConnActivityMessage),
		directMsg:      make(chan *webConnDirectMessage),
	}
}

func (a *App) TotalWebsocketConnections() int {
	return a.Srv().TotalWebsocketConnections()
}

// HubStart starts all the hubs.
func (a *App) HubStart() {
	// Total number of hubs is twice the number of CPUs.
	numberOfHubs := runtime.NumCPU() * 2
	mlog.Info("Starting websocket hubs", mlog.Int("number_of_hubs", numberOfHubs))

	a.Srv().SetHubs(make([]*Hub, numberOfHubs))

	for i := 0; i < len(a.Srv().GetHubs()); i++ {
		newHub := a.NewWebHub()
		newHub.connectionIndex = i
		err := a.Srv().SetHub(i, newHub)
		if err != nil {
			mlog.Warn("Error starting hub", mlog.Err(err), mlog.Int("index", i))
			continue
		}
		newHub.Start()
	}
}

func (a *App) PublishSkipClusterSend(message *model.WebSocketEvent) {
	if message.GetBroadcast().UserId != "" {
		hub := a.GetHubForUserId(message.GetBroadcast().UserId)
		if hub != nil {
			hub.Broadcast(message)
		}
	} else {
		for _, hub := range a.Srv().GetHubs() {
			hub.Broadcast(message)
		}
	}
}

func (a *App) invalidateCacheForUserSkipClusterSend(userId string) {
	a.Srv().Store.Channel().InvalidateAllChannelMembersForUser(userId)

	hub := a.GetHubForUserId(userId)
	if hub != nil {
		hub.InvalidateUser(userId)
	}
}

func (a *App) invalidateCacheForUserTeamsSkipClusterSend(userId string) {
	hub := a.GetHubForUserId(userId)
	if hub != nil {
		hub.InvalidateUser(userId)
	}
}

func (a *App) invalidateCacheForWebhook(webhookId string) {
	a.Srv().Store.Webhook().InvalidateWebhookCache(webhookId)
}

func (a *App) InvalidateWebConnSessionCacheForUser(userId string) {
	hub := a.GetHubForUserId(userId)
	if hub != nil {
		hub.InvalidateUser(userId)
	}
}

// HubStop stops all the hubs.
func (a *App) HubStop() {
	mlog.Info("stopping websocket hub connections")

	for _, hub := range a.Srv().GetHubs() {
		hub.Stop()
	}

	a.Srv().SetHubs([]*Hub{})
}

// GetHubForUserId returns the hub for a given user id.
func (a *App) GetHubForUserId(userId string) *Hub {
	if len(a.Srv().GetHubs()) == 0 {
		return nil
	}

	hash := fnv.New32a()
	hash.Write([]byte(userId))
	index := hash.Sum32() % uint32(len(a.Srv().GetHubs()))
	hub, err := a.Srv().GetHub(int(index))
	if err != nil {
		mlog.Warn("Requested hub doesn't exist", mlog.Int("hub_index", int(index)))
		return nil
	}
	return hub
}

// HubRegister registers a connection to a hub.
func (a *App) HubRegister(webConn *WebConn) {
	hub := a.GetHubForUserId(webConn.UserId)
	if hub != nil {
		if metrics := a.Metrics(); metrics != nil {
			metrics.IncrementWebSocketBroadcastUsersRegistered(strconv.Itoa(hub.connectionIndex), 1)
		}
		hub.Register(webConn)
	}
}

// HubUnregister unregisters a connection from a hub.
func (a *App) HubUnregister(webConn *WebConn) {
	hub := a.GetHubForUserId(webConn.UserId)
	if hub != nil {
		if metrics := a.Metrics(); metrics != nil {
			metrics.DecrementWebSocketBroadcastUsersRegistered(strconv.Itoa(hub.connectionIndex), 1)
		}
		hub.Unregister(webConn)
	}
}

// UpdateWebConnUserActivity sets the LastUserActivityAt of the hub for the given session.
func (a *App) UpdateWebConnUserActivity(session model.Session, activityAt int64) {
	hub := a.GetHubForUserId(session.UserId)
	if hub != nil {
		hub.UpdateActivity(session.UserId, session.Token, activityAt)
	}
}

// Register registers a connection to the hub.
func (h *Hub) Register(webConn *WebConn) {
	select {
	case h.register <- webConn:
	case <-h.stop:
	}
}

// Unregister unregisters a connection from the hub.
func (h *Hub) Unregister(webConn *WebConn) {
	select {
	case h.unregister <- webConn:
	case <-h.stop:
	}
}

// Broadcast broadcasts the message to all connections in the hub.
func (h *Hub) Broadcast(message *model.WebSocketEvent) {
	if h != nil && h.broadcast != nil && message != nil {
		if metrics := h.app.Metrics(); metrics != nil {
			metrics.IncrementWebSocketBroadcastBufferSize(strconv.Itoa(h.connectionIndex), 1)
		}
		select {
		case h.broadcast <- message:
		case <-h.stop:
		}
	}
}

// InvalidateUser invalidates the cache for the given user.
func (h *Hub) InvalidateUser(userId string) {
	select {
	case h.invalidateUser <- userId:
	case <-h.stop:
	}
}

// UpdateActivity sets the LastUserActivityAt field for the connection
// of the user.
func (h *Hub) UpdateActivity(userId, sessionToken string, activityAt int64) {
	select {
	case h.activity <- &webConnActivityMessage{
		userId:       userId,
		sessionToken: sessionToken,
		activityAt:   activityAt,
	}:
	case <-h.stop:
	}
}

// SendMessage sends the given message to the given connection.
func (h *Hub) SendMessage(conn *WebConn, msg model.WebSocketMessage) {
	select {
	case h.directMsg <- &webConnDirectMessage{
		conn: conn,
		msg:  msg,
	}:
	case <-h.stop:
	}
}

// Stop stops the hub.
func (h *Hub) Stop() {
	close(h.stop)
	<-h.didStop
}

// Start starts the hub.
func (h *Hub) Start() {
	var doStart func()
	var doRecoverableStart func()
	var doRecover func()

	doStart = func() {
		mlog.Debug("Hub is starting", mlog.Int("index", h.connectionIndex))

		connections := newHubConnectionIndex()

		for {
			select {
			case webConn := <-h.register:
				connections.Add(webConn)
				atomic.StoreInt64(&h.connectionCount, int64(len(connections.All())))
				if webConn.IsAuthenticated() {
					webConn.send <- webConn.createHelloMessage()
				}
			case webConn := <-h.unregister:
				connections.Remove(webConn)
				atomic.StoreInt64(&h.connectionCount, int64(len(connections.All())))

				if len(webConn.UserId) == 0 {
					continue
				}

				conns := connections.ForUser(webConn.UserId)
				if len(conns) == 0 {
					h.app.Srv().Go(func() {
						h.app.SetStatusOffline(webConn.UserId, false)
					})
				} else {
					var latestActivity int64 = 0
					for _, conn := range conns {
						if conn.lastUserActivityAt > latestActivity {
							latestActivity = conn.lastUserActivityAt
						}
					}
					if h.app.IsUserAway(latestActivity) {
						h.app.Srv().Go(func() {
							h.app.SetStatusLastActivityAt(webConn.UserId, latestActivity)
						})
					}
				}
			case userId := <-h.invalidateUser:
				for _, webConn := range connections.ForUser(userId) {
					webConn.InvalidateCache()
				}
			case activity := <-h.activity:
				for _, webConn := range connections.ForUser(activity.userId) {
					if webConn.GetSessionToken() == activity.sessionToken {
						webConn.lastUserActivityAt = activity.activityAt
					}
				}
			case directMsg := <-h.directMsg:
				if !connections.Has(directMsg.conn) {
					continue
				}
				select {
				case directMsg.conn.send <- directMsg.msg:
				default:
					mlog.Error("webhub.broadcast: cannot send, closing websocket for user", mlog.String("user_id", directMsg.conn.UserId))
					close(directMsg.conn.send)
					connections.Remove(directMsg.conn)
				}
			case msg := <-h.broadcast:
				if metrics := h.app.Metrics(); metrics != nil {
					metrics.DecrementWebSocketBroadcastBufferSize(strconv.Itoa(h.connectionIndex), 1)
				}
				candidates := connections.All()
				if msg.GetBroadcast().UserId != "" {
					candidates = connections.ForUser(msg.GetBroadcast().UserId)
				}
				msg = msg.PrecomputeJSON()
				for _, webConn := range candidates {
					if webConn.ShouldSendEvent(msg) {
						select {
						case webConn.send <- msg:
						default:
							mlog.Error("webhub.broadcast: cannot send, closing websocket for user", mlog.String("user_id", webConn.UserId))
							close(webConn.send)
							connections.Remove(webConn)
						}
					}
				}
			case <-h.stop:
				userIds := make(map[string]bool)

				for _, webConn := range connections.All() {
					userIds[webConn.UserId] = true
					webConn.Close()
				}

				for userId := range userIds {
					h.app.SetStatusOffline(userId, false)
				}

				h.explicitStop = true
				close(h.didStop)

				return
			}
		}
	}

	doRecoverableStart = func() {
		defer doRecover()
		doStart()
	}

	doRecover = func() {
		if !h.explicitStop {
			if r := recover(); r != nil {
				mlog.Error("Recovering from Hub panic.", mlog.Any("panic", r))
			} else {
				mlog.Error("Webhub stopped unexpectedly. Recovering.")
			}

			mlog.Error(string(debug.Stack()))

			go doRecoverableStart()
		}
	}

	go doRecoverableStart()
}

type hubConnectionIndexIndexes struct {
	connections         int
	connectionsByUserId int
}

// hubConnectionIndex provides fast addition, removal, and iteration of web connections.
type hubConnectionIndex struct {
	connections         []*WebConn
	connectionsByUserId map[string][]*WebConn
	connectionIndexes   map[*WebConn]*hubConnectionIndexIndexes
}

func newHubConnectionIndex() *hubConnectionIndex {
	return &hubConnectionIndex{
		connections:         make([]*WebConn, 0, model.SESSION_CACHE_SIZE),
		connectionsByUserId: make(map[string][]*WebConn),
		connectionIndexes:   make(map[*WebConn]*hubConnectionIndexIndexes),
	}
}

func (i *hubConnectionIndex) Add(wc *WebConn) {
	i.connections = append(i.connections, wc)
	i.connectionsByUserId[wc.UserId] = append(i.connectionsByUserId[wc.UserId], wc)
	i.connectionIndexes[wc] = &hubConnectionIndexIndexes{
		connections:         len(i.connections) - 1,
		connectionsByUserId: len(i.connectionsByUserId[wc.UserId]) - 1,
	}
}

func (i *hubConnectionIndex) Remove(wc *WebConn) {
	indexes, ok := i.connectionIndexes[wc]
	if !ok {
		return
	}

	last := i.connections[len(i.connections)-1]
	i.connections[indexes.connections] = last
	i.connections = i.connections[:len(i.connections)-1]
	i.connectionIndexes[last].connections = indexes.connections

	userConnections := i.connectionsByUserId[wc.UserId]
	last = userConnections[len(userConnections)-1]
	userConnections[indexes.connectionsByUserId] = last
	i.connectionsByUserId[wc.UserId] = userConnections[:len(userConnections)-1]
	i.connectionIndexes[last].connectionsByUserId = indexes.connectionsByUserId

	delete(i.connectionIndexes, wc)
}

func (i *hubConnectionIndex) Has(wc *WebConn) bool {
	_, ok := i.connectionIndexes[wc]
	return ok
}

func (i *hubConnectionIndex) ForUser(id string) []*WebConn {
	return i.connectionsByUserId[id]
}

func (i *hubConnectionIndex) All() []*WebConn {
	return i.connections
}
