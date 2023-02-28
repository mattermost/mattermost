// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"hash/maphash"
	"runtime"
	"runtime/debug"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const (
	broadcastQueueSize         = 4096
	inactiveConnReaperInterval = 5 * time.Minute
)

type SuiteIFace interface {
	GetSession(token string) (*model.Session, *model.AppError)
	RolesGrantPermission(roleNames []string, permissionId string) bool
	UserCanSeeOtherUser(userID string, otherUserId string) (bool, *model.AppError)
}

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
	platform        *PlatformService
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
func newWebHub(ps *PlatformService) *Hub {
	return &Hub{
		platform:        ps,
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

// hubStart starts all the hubs.
func (ps *PlatformService) hubStart() {
	// Total number of hubs is twice the number of CPUs.
	numberOfHubs := runtime.NumCPU() * 2
	ps.logger.Info("Starting websocket hubs", mlog.Int("number_of_hubs", numberOfHubs))

	hubs := make([]*Hub, numberOfHubs)

	for i := 0; i < numberOfHubs; i++ {
		hubs[i] = newWebHub(ps)
		hubs[i].connectionIndex = i
		hubs[i].Start()
	}
	// Assigning to the hubs slice without any mutex is fine because it is only assigned once
	// during the start of the program and always read from after that.
	ps.hubs = hubs
}

func (ps *PlatformService) InvalidateCacheForWebhook(webhookID string) {
	ps.Store.Webhook().InvalidateWebhookCache(webhookID)
}

// HubStop stops all the hubs.
func (ps *PlatformService) HubStop() {
	ps.logger.Info("stopping websocket hub connections")

	for _, hub := range ps.hubs {
		hub.Stop()
	}
}

// GetHubForUserId returns the hub for a given user id.
func (ps *PlatformService) GetHubForUserId(userID string) *Hub {
	if len(ps.hubs) == 0 {
		return nil
	}

	// TODO: check if caching the userID -> hub mapping
	// is worth the memory tradeoff.
	// https://mattermost.atlassian.net/browse/MM-26629.
	var hash maphash.Hash
	hash.SetSeed(ps.hashSeed)
	hash.Write([]byte(userID))
	index := hash.Sum64() % uint64(len(ps.hubs))

	return ps.hubs[int(index)]
}

// HubRegister registers a connection to a hub.
func (ps *PlatformService) HubRegister(webConn *WebConn) {
	hub := ps.GetHubForUserId(webConn.UserId)
	if hub != nil {
		if metrics := ps.metricsIFace; metrics != nil {
			metrics.IncrementWebSocketBroadcastUsersRegistered(strconv.Itoa(hub.connectionIndex), 1)
		}
		hub.Register(webConn)
	}
}

// HubUnregister unregisters a connection from a hub.
func (ps *PlatformService) HubUnregister(webConn *WebConn) {
	hub := ps.GetHubForUserId(webConn.UserId)
	if hub != nil {
		if metrics := ps.metricsIFace; metrics != nil {
			metrics.DecrementWebSocketBroadcastUsersRegistered(strconv.Itoa(hub.connectionIndex), 1)
		}
		hub.Unregister(webConn)
	}
}

func (ps *PlatformService) InvalidateCacheForChannel(channel *model.Channel) {
	ps.Store.Channel().InvalidateChannel(channel.Id)
	ps.invalidateCacheForChannelByNameSkipClusterSend(channel.TeamId, channel.Name)

	if ps.clusterIFace != nil {
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

		ps.clusterIFace.SendClusterMessage(nameMsg)
	}
}

func (ps *PlatformService) InvalidateCacheForChannelMembers(channelID string) {
	ps.Store.User().InvalidateProfilesInChannelCache(channelID)
	ps.Store.Channel().InvalidateMemberCount(channelID)
	ps.Store.Channel().InvalidateGuestCount(channelID)
}

func (ps *PlatformService) InvalidateCacheForChannelMembersNotifyProps(channelID string) {
	ps.invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelID)

	if ps.clusterIFace != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForChannelMembersNotifyProps,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(channelID),
		}
		ps.clusterIFace.SendClusterMessage(msg)
	}
}

func (ps *PlatformService) InvalidateCacheForChannelPosts(channelID string) {
	ps.Store.Channel().InvalidatePinnedPostCount(channelID)
	ps.Store.Post().InvalidateLastPostTimeCache(channelID)
}

func (ps *PlatformService) InvalidateCacheForUser(userID string) {
	ps.InvalidateCacheForUserSkipClusterSend(userID)

	ps.Store.User().InvalidateProfilesInChannelCacheByUser(userID)
	ps.Store.User().InvalidateProfileCacheForUser(userID)

	if ps.clusterIFace != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForUser,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(userID),
		}
		ps.clusterIFace.SendClusterMessage(msg)
	}
}

func (ps *PlatformService) InvalidateCacheForUserTeams(userID string) {
	ps.invalidateWebConnSessionCacheForUser(userID)
	ps.Store.Team().InvalidateAllTeamIdsForUser(userID)

	if ps.clusterIFace != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForUserTeams,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(userID),
		}
		ps.clusterIFace.SendClusterMessage(msg)
	}
}

// UpdateWebConnUserActivity sets the LastUserActivityAt of the hub for the given session.
func (ps *PlatformService) UpdateWebConnUserActivity(session model.Session, activityAt int64) {
	hub := ps.GetHubForUserId(session.UserId)
	if hub != nil {
		hub.UpdateActivity(session.UserId, session.Token, activityAt)
	}
}

// SessionIsRegistered determines if a specific session has been registered
func (ps *PlatformService) SessionIsRegistered(session model.Session) bool {
	hub := ps.GetHubForUserId(session.UserId)
	if hub != nil {
		return hub.IsRegistered(session.UserId, session.Token)
	}

	return false
}

func (ps *PlatformService) CheckWebConn(userID, connectionID string) *CheckConnResult {
	hub := ps.GetHubForUserId(userID)
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
		if metrics := h.platform.metricsIFace; metrics != nil {
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
func (h *Hub) Start() {
	var doStart func()
	var doRecoverableStart func()
	var doRecover func()

	doStart = func() {
		mlog.Debug("Hub is starting", mlog.Int("index", h.connectionIndex))

		ticker := time.NewTicker(inactiveConnReaperInterval)
		defer ticker.Stop()

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

				if webConn.IsAuthenticated() && webConn.reuseCount == 0 {
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
					h.platform.Go(func() {
						h.platform.SetStatusOffline(webConn.UserId, false)
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

				if h.platform.isUserAway(latestActivity) {
					h.platform.Go(func() {
						h.platform.SetStatusLastActivityAt(webConn.UserId, latestActivity)
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
					mlog.Error("webhub.broadcast: cannot send, closing websocket for user", mlog.String("user_id", directMsg.conn.UserId))
					close(directMsg.conn.send)
					connIndex.Remove(directMsg.conn)
				}
			case msg := <-h.broadcast:
				if metrics := h.platform.metricsIFace; metrics != nil {
					metrics.DecrementWebSocketBroadcastBufferSize(strconv.Itoa(h.connectionIndex), 1)
				}
				msg = msg.PrecomputeJSON()
				broadcast := func(webConn *WebConn) {
					if !connIndex.Has(webConn) {
						return
					}
					if webConn.ShouldSendEvent(msg) {
						select {
						case webConn.send <- msg:
						default:
							mlog.Error("webhub.broadcast: cannot send, closing websocket for user", mlog.String("user_id", webConn.UserId))
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
					h.platform.SetStatusOffline(webConn.UserId, false)
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
	wc.Platform.ReturnSessionToPool(wc.GetSession())

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
