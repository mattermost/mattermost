// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"hash/maphash"
	"runtime"
	"runtime/debug"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	broadcastQueueSize         = 4096
	inactiveConnReaperInterval = 5 * time.Minute
)

type webConnActivityMessage struct {
	userID       string
	sessionToken string
	activityAt   int64
}

type webConnDirectMessage struct {
	conn *WebConn
	msg  model.WebSocketMessage
}

type webConnSessionMessage struct {
	userID       string
	sessionToken string
	isRegistered chan bool
}

type webConnCheckMessage struct {
	userID       string
	connectionID string
	result       chan *CheckConnResult
}

// Hub is the central place to manage all websocket connections in the server.
// It handles different websocket events and sending messages to individual
// user connections.
type Hub struct {
	// connectionCount should be kept first.
	// See https://github.com/mattermost/mattermost-server/pull/7281
	connectionCount int64
	srv             *Server
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
	checkRegistered chan *webConnSessionMessage
	checkConn       chan *webConnCheckMessage
}

// newWebHub creates a new Hub.
func newWebHub(s *Server) *Hub {
	return &Hub{
		srv:             s,
		register:        make(chan *WebConn),
		unregister:      make(chan *WebConn),
		broadcast:       make(chan *model.WebSocketEvent, broadcastQueueSize),
		stop:            make(chan struct{}),
		didStop:         make(chan struct{}),
		invalidateUser:  make(chan string),
		activity:        make(chan *webConnActivityMessage),
		directMsg:       make(chan *webConnDirectMessage),
		checkRegistered: make(chan *webConnSessionMessage),
		checkConn:       make(chan *webConnCheckMessage),
	}
}

func (a *App) TotalWebsocketConnections() int {
	return a.Srv().TotalWebsocketConnections()
}

// HubStart starts all the hubs.
func (s *Server) HubStart(c request.CTX) {
	// Total number of hubs is twice the number of CPUs.
	numberOfHubs := runtime.NumCPU() * 2
	s.Log().Info("Starting websocket hubs", mlog.Int("number_of_hubs", numberOfHubs))

	hubs := make([]*Hub, numberOfHubs)

	for i := 0; i < numberOfHubs; i++ {
		hubs[i] = newWebHub(s)
		hubs[i].connectionIndex = i
		hubs[i].Start(c)
	}
	// Assigning to the hubs slice without any mutex is fine because it is only assigned once
	// during the start of the program and always read from after that.
	s.hubs = hubs
}

func (a *App) invalidateCacheForWebhook(webhookID string) {
	a.Srv().Store.Webhook().InvalidateWebhookCache(webhookID)
}

// HubStop stops all the hubs.
func (s *Server) HubStop(c request.CTX) {
	c.Logger().Info("stopping websocket hub connections")

	for _, hub := range s.hubs {
		hub.Stop()
	}
}

// GetHubForUserId returns the hub for a given user id.
func (s *Server) GetHubForUserId(userID string) *Hub {
	// TODO: check if caching the userID -> hub mapping
	// is worth the memory tradeoff.
	// https://mattermost.atlassian.net/browse/MM-26629.
	var hash maphash.Hash
	hash.SetSeed(s.hashSeed)
	hash.Write([]byte(userID))
	index := hash.Sum64() % uint64(len(s.hubs))

	return s.hubs[int(index)]
}

func (a *App) GetHubForUserId(userID string) *Hub {
	return a.Srv().GetHubForUserId(userID)
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

func (s *Server) Publish(c request.CTX, message *model.WebSocketEvent) {
	if s.GetMetrics() != nil {
		s.GetMetrics().IncrementWebsocketEvent(message.EventType())
	}

	s.PublishSkipClusterSend(c, message)

	if s.Cluster != nil {
		data, err := message.ToJSON()
		if err != nil {
			c.Logger().Warn("Failed to encode message to JSON", mlog.Err(err))
		}
		cm := &model.ClusterMessage{
			Event:    model.ClusterEventPublish,
			SendType: model.ClusterSendBestEffort,
			Data:     data,
		}

		if message.EventType() == model.WebsocketEventPosted ||
			message.EventType() == model.WebsocketEventPostEdited ||
			message.EventType() == model.WebsocketEventDirectAdded ||
			message.EventType() == model.WebsocketEventGroupAdded ||
			message.EventType() == model.WebsocketEventAddedToTeam ||
			message.GetBroadcast().ReliableClusterSend {
			cm.SendType = model.ClusterSendReliable
		}

		s.Cluster.SendClusterMessage(cm)
	}
}

func (a *App) Publish(c request.CTX, message *model.WebSocketEvent) {
	a.Srv().Publish(c, message)
}

func (ch *Channels) Publish(c request.CTX, message *model.WebSocketEvent) {
	ch.srv.Publish(c, message)
}

func (s *Server) PublishSkipClusterSend(c request.CTX, event *model.WebSocketEvent) {
	if event.GetBroadcast().UserId != "" {
		hub := s.GetHubForUserId(event.GetBroadcast().UserId)
		if hub != nil {
			hub.Broadcast(event)
		}
	} else {
		for _, hub := range s.hubs {
			hub.Broadcast(event)
		}
	}

	// Notify shared channel sync service
	s.SharedChannelSyncHandler(c, event)
}

func (a *App) invalidateCacheForChannel(channel *model.Channel) {
	a.Srv().Store.Channel().InvalidateChannel(channel.Id)
	a.Srv().invalidateCacheForChannelByNameSkipClusterSend(channel.TeamId, channel.Name)

	if a.Cluster() != nil {
		nameMsg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForChannelByName,
			SendType: model.ClusterSendBestEffort,
			Props:    make(map[string]string),
		}

		nameMsg.Props["name"] = channel.Name
		if channel.TeamId == "" {
			nameMsg.Props["id"] = "dm"
		} else {
			nameMsg.Props["id"] = channel.TeamId
		}

		a.Cluster().SendClusterMessage(nameMsg)
	}
}

func (a *App) invalidateCacheForChannelMembers(channelID string) {
	a.Srv().Store.User().InvalidateProfilesInChannelCache(channelID)
	a.Srv().Store.Channel().InvalidateMemberCount(channelID)
	a.Srv().Store.Channel().InvalidateGuestCount(channelID)
}

func (a *App) invalidateCacheForChannelMembersNotifyProps(channelID string) {
	a.Srv().invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelID)

	if a.Cluster() != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForChannelMembersNotifyProps,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(channelID),
		}
		a.Cluster().SendClusterMessage(msg)
	}
}

func (a *App) invalidateCacheForChannelPosts(channelID string) {
	a.Srv().Store.Channel().InvalidatePinnedPostCount(channelID)
	a.Srv().Store.Post().InvalidateLastPostTimeCache(channelID)
}

func (a *App) InvalidateCacheForUser(userID string) {
	a.Srv().invalidateCacheForUserSkipClusterSend(userID)

	a.ch.srv.userService.InvalidateCacheForUser(userID)
}

func (a *App) invalidateCacheForUserTeams(userID string) {
	a.Srv().invalidateWebConnSessionCacheForUser(userID)
	a.Srv().Store.Team().InvalidateAllTeamIdsForUser(userID)

	if a.Cluster() != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForUserTeams,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(userID),
		}
		a.Cluster().SendClusterMessage(msg)
	}
}

// UpdateWebConnUserActivity sets the LastUserActivityAt of the hub for the given session.
func (a *App) UpdateWebConnUserActivity(session model.Session, activityAt int64) {
	hub := a.GetHubForUserId(session.UserId)
	if hub != nil {
		hub.UpdateActivity(session.UserId, session.Token, activityAt)
	}
}

// SessionIsRegistered determines if a specific session has been registered
func (a *App) SessionIsRegistered(session model.Session) bool {
	hub := a.GetHubForUserId(session.UserId)
	if hub != nil {
		return hub.IsRegistered(session.UserId, session.Token)
	}
	return false
}

func (a *App) CheckWebConn(userID, connectionID string) *CheckConnResult {
	hub := a.GetHubForUserId(userID)
	if hub != nil {
		return hub.CheckConn(userID, connectionID)
	}
	return nil
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

// Determines if a user's session is registered a connection from the hub.
func (h *Hub) IsRegistered(userID, sessionToken string) bool {
	ws := &webConnSessionMessage{
		userID:       userID,
		sessionToken: sessionToken,
		isRegistered: make(chan bool),
	}
	select {
	case h.checkRegistered <- ws:
		return <-ws.isRegistered
	case <-h.stop:
	}
	return false
}

func (h *Hub) CheckConn(userID, connectionID string) *CheckConnResult {
	req := &webConnCheckMessage{
		userID:       userID,
		connectionID: connectionID,
		result:       make(chan *CheckConnResult),
	}
	select {
	case h.checkConn <- req:
		return <-req.result
	case <-h.stop:
	}
	return nil
}

// Broadcast broadcasts the message to all connections in the hub.
func (h *Hub) Broadcast(message *model.WebSocketEvent) {
	// XXX: The hub nil check is because of the way we setup our tests. We call
	// `app.NewServer()` which returns a server, but only after that, we call
	// `wsapi.Init()` to initialize the hub.  But in the `NewServer` call
	// itself proceeds to broadcast some messages happily.  This needs to be
	// fixed once the wsapi cyclic dependency with server/app goes away.
	// And possibly, we can look into doing the hub initialization inside
	// NewServer itself.
	if h != nil && message != nil {
		if metrics := h.srv.GetMetrics(); metrics != nil {
			metrics.IncrementWebSocketBroadcastBufferSize(strconv.Itoa(h.connectionIndex), 1)
		}
		select {
		case h.broadcast <- message:
		case <-h.stop:
		}
	}
}

// InvalidateUser invalidates the cache for the given user.
func (h *Hub) InvalidateUser(userID string) {
	select {
	case h.invalidateUser <- userID:
	case <-h.stop:
	}
}

// UpdateActivity sets the LastUserActivityAt field for the connection
// of the user.
func (h *Hub) UpdateActivity(userID, sessionToken string, activityAt int64) {
	select {
	case h.activity <- &webConnActivityMessage{
		userID:       userID,
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
func (h *Hub) Start(c request.CTX) {
	var doStart func()
	var doRecoverableStart func()
	var doRecover func()

	doStart = func() {
		c.Logger().Debug("Hub is starting", mlog.Int("index", h.connectionIndex))

		ticker := time.NewTicker(inactiveConnReaperInterval)
		defer ticker.Stop()

		appInstance := New(ServerConnector(h.srv.Channels()))

		connIndex := newHubConnectionIndex(inactiveConnReaperInterval)

		for {
			select {
			case webSessionMessage := <-h.checkRegistered:
				conns := connIndex.ForUser(webSessionMessage.userID)
				var isRegistered bool
				for _, conn := range conns {
					if !conn.active {
						continue
					}
					if conn.GetSessionToken() == webSessionMessage.sessionToken {
						isRegistered = true
					}
				}
				webSessionMessage.isRegistered <- isRegistered
			case req := <-h.checkConn:
				var res *CheckConnResult
				conn := connIndex.RemoveInactiveByConnectionID(req.userID, req.connectionID)
				if conn != nil {
					res = &CheckConnResult{
						ConnectionID:     req.connectionID,
						UserID:           req.userID,
						ActiveQueue:      conn.send,
						DeadQueue:        conn.deadQueue,
						DeadQueuePointer: conn.deadQueuePointer,
						ReuseCount:       conn.reuseCount + 1,
					}
				}
				req.result <- res
			case <-ticker.C:
				connIndex.RemoveInactiveConnections()
			case webConn := <-h.register:
				// Mark the current one as active.
				// There is no need to check if it was inactive or not,
				// we will anyways need to make it active.
				webConn.active = true

				connIndex.Add(webConn)
				atomic.StoreInt64(&h.connectionCount, int64(connIndex.AllActive()))

				if webConn.IsAuthenticated(c) && webConn.reuseCount == 0 {
					// The hello message should only be sent when the reuseCount is 0.
					// i.e in server restart, or long timeout, or fresh connection case.
					// In case of seq number not found in dead queue, it is handled by
					// the webconn write pump.
					webConn.send <- webConn.createHelloMessage()
				}
			case webConn := <-h.unregister:
				// If already removed (via queue full), then removing again becomes a noop.
				// But if not removed, mark inactive.
				webConn.active = false

				atomic.StoreInt64(&h.connectionCount, int64(connIndex.AllActive()))

				if webConn.UserId == "" {
					continue
				}

				conns := connIndex.ForUser(webConn.UserId)
				if len(conns) == 0 || areAllInactive(conns) {
					h.srv.Go(func() {
						appInstance.SetStatusOffline(c, webConn.UserId, false)
					})
					continue
				}
				var latestActivity int64 = 0
				for _, conn := range conns {
					if !conn.active {
						continue
					}
					if conn.lastUserActivityAt > latestActivity {
						latestActivity = conn.lastUserActivityAt
					}
				}

				if appInstance.IsUserAway(latestActivity) {
					h.srv.Go(func() {
						appInstance.SetStatusLastActivityAt(c, webConn.UserId, latestActivity)
					})
				}
			case userID := <-h.invalidateUser:
				for _, webConn := range connIndex.ForUser(userID) {
					webConn.InvalidateCache()
				}
			case activity := <-h.activity:
				for _, webConn := range connIndex.ForUser(activity.userID) {
					if !webConn.active {
						continue
					}
					if webConn.GetSessionToken() == activity.sessionToken {
						webConn.lastUserActivityAt = activity.activityAt
					}
				}
			case directMsg := <-h.directMsg:
				if !connIndex.Has(directMsg.conn) {
					continue
				}
				select {
				case directMsg.conn.send <- directMsg.msg:
				default:
					c.Logger().Error("webhub.broadcast: cannot send, closing websocket for user", mlog.String("user_id", directMsg.conn.UserId))
					close(directMsg.conn.send)
					connIndex.Remove(directMsg.conn)
				}
			case msg := <-h.broadcast:
				if metrics := h.srv.GetMetrics(); metrics != nil {
					metrics.DecrementWebSocketBroadcastBufferSize(strconv.Itoa(h.connectionIndex), 1)
				}
				msg = msg.PrecomputeJSON()
				broadcast := func(webConn *WebConn) {
					if !connIndex.Has(webConn) {
						return
					}
					if webConn.shouldSendEvent(c, msg) {
						select {
						case webConn.send <- msg:
						default:
							c.Logger().Error("webhub.broadcast: cannot send, closing websocket for user", mlog.String("user_id", webConn.UserId))
							close(webConn.send)
							connIndex.Remove(webConn)
						}
					}
				}

				if connID := msg.GetBroadcast().ConnectionId; connID != "" {
					if webConn := connIndex.byConnectionId[connID]; webConn != nil {
						broadcast(webConn)
						continue
					}
				} else if msg.GetBroadcast().UserId != "" {
					candidates := connIndex.ForUser(msg.GetBroadcast().UserId)
					for _, webConn := range candidates {
						broadcast(webConn)
					}
					continue
				}

				candidates := connIndex.All()
				for webConn := range candidates {
					broadcast(webConn)
				}
			case <-h.stop:
				for webConn := range connIndex.All() {
					webConn.Close()
					appInstance.SetStatusOffline(c, webConn.UserId, false)
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
				c.Logger().Error("Recovering from Hub panic.", mlog.Any("panic", r))
			} else {
				c.Logger().Error("Webhub stopped unexpectedly. Recovering.")
			}

			c.Logger().Error(string(debug.Stack()))

			go doRecoverableStart()
		}
	}

	go doRecoverableStart()
}

// hubConnectionIndex provides fast addition, removal, and iteration of web connections.
// It requires 3 functionalities which need to be very fast:
// - check if a connection exists or not.
// - get all connections for a given userID.
// - get all connections.
type hubConnectionIndex struct {
	// byUserId stores the list of connections for a given userID
	byUserId map[string][]*WebConn
	// byConnection serves the dual purpose of storing the index of the webconn
	// in the value of byUserId map, and also to get all connections.
	byConnection   map[*WebConn]int
	byConnectionId map[string]*WebConn
	// staleThreshold is the limit beyond which inactive connections
	// will be deleted.
	staleThreshold time.Duration
}

func newHubConnectionIndex(interval time.Duration) *hubConnectionIndex {
	return &hubConnectionIndex{
		byUserId:       make(map[string][]*WebConn),
		byConnection:   make(map[*WebConn]int),
		byConnectionId: make(map[string]*WebConn),
		staleThreshold: interval,
	}
}

func (i *hubConnectionIndex) Add(wc *WebConn) {
	i.byUserId[wc.UserId] = append(i.byUserId[wc.UserId], wc)
	i.byConnection[wc] = len(i.byUserId[wc.UserId]) - 1
	i.byConnectionId[wc.GetConnectionID()] = wc
}

func (i *hubConnectionIndex) Remove(wc *WebConn) {
	wc.App.Srv().userService.ReturnSessionToPool(wc.GetSession())

	userConnIndex, ok := i.byConnection[wc]
	if !ok {
		return
	}

	// get the conn slice.
	userConnections := i.byUserId[wc.UserId]
	// get the last connection.
	last := userConnections[len(userConnections)-1]
	// set the slot that we are trying to remove to be the last connection.
	userConnections[userConnIndex] = last
	// remove the last connection from the slice.
	i.byUserId[wc.UserId] = userConnections[:len(userConnections)-1]
	// set the index of the connection that was moved to the new index.
	i.byConnection[last] = userConnIndex

	delete(i.byConnection, wc)
	delete(i.byConnectionId, wc.GetConnectionID())
}

func (i *hubConnectionIndex) Has(wc *WebConn) bool {
	_, ok := i.byConnection[wc]
	return ok
}

// ForUser returns all connections for a user ID.
func (i *hubConnectionIndex) ForUser(id string) []*WebConn {
	return i.byUserId[id]
}

// All returns the full webConn index.
func (i *hubConnectionIndex) All() map[*WebConn]int {
	return i.byConnection
}

// RemoveInactiveByConnectionID removes an inactive connection for the given
// userID and connectionID.
func (i *hubConnectionIndex) RemoveInactiveByConnectionID(userID, connectionID string) *WebConn {
	// To handle empty sessions.
	if userID == "" {
		return nil
	}
	for _, conn := range i.ForUser(userID) {
		if conn.GetConnectionID() == connectionID && !conn.active {
			i.Remove(conn)
			return conn
		}
	}
	return nil
}

// RemoveInactiveConnections removes all inactive connections whose lastUserActivityAt
// exceeded staleThreshold.
func (i *hubConnectionIndex) RemoveInactiveConnections() {
	now := model.GetMillis()
	for conn := range i.byConnection {
		if !conn.active && now-conn.lastUserActivityAt > i.staleThreshold.Milliseconds() {
			i.Remove(conn)
		}
	}
}

// AllActive returns the number of active connections.
// This is only called during register/unregister so we can take
// a bit of perf hit here.
func (i *hubConnectionIndex) AllActive() int {
	cnt := 0
	for conn := range i.byConnection {
		if conn.active {
			cnt++
		}
	}
	return cnt
}
