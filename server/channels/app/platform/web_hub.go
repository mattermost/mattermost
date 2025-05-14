// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"fmt"
	"hash/maphash"
	"iter"
	"maps"
	"runtime"
	"runtime/debug"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	broadcastQueueSize         = 4096
	inactiveConnReaperInterval = 5 * time.Minute
)

type SuiteIFace interface {
	GetSession(token string) (*model.Session, *model.AppError)
	RolesGrantPermission(roleNames []string, permissionId string) bool
	HasPermissionToReadChannel(c request.CTX, userID string, channel *model.Channel) bool
	UserCanSeeOtherUser(c request.CTX, userID string, otherUserId string) (bool, *model.AppError)
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

type webConnRegisterMessage struct {
	conn *WebConn
	err  chan error
}

type webConnCheckMessage struct {
	userID       string
	connectionID string
	result       chan *CheckConnResult
}

type webConnCountMessage struct {
	userID string
	result chan int
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
	register        chan *webConnRegisterMessage
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
	connCount       chan *webConnCountMessage
	broadcastHooks  map[string]BroadcastHook
}

// newWebHub creates a new Hub.
func newWebHub(ps *PlatformService) *Hub {
	return &Hub{
		platform:        ps,
		register:        make(chan *webConnRegisterMessage),
		unregister:      make(chan *WebConn),
		broadcast:       make(chan *model.WebSocketEvent, broadcastQueueSize),
		stop:            make(chan struct{}),
		didStop:         make(chan struct{}),
		invalidateUser:  make(chan string),
		activity:        make(chan *webConnActivityMessage),
		directMsg:       make(chan *webConnDirectMessage),
		checkRegistered: make(chan *webConnSessionMessage),
		checkConn:       make(chan *webConnCheckMessage),
		connCount:       make(chan *webConnCountMessage),
	}
}

// hubStart starts all the hubs.
func (ps *PlatformService) hubStart(broadcastHooks map[string]BroadcastHook) {
	// After running some tests, we found using the same number of hubs
	// as CPUs to be the ideal in terms of performance.
	// https://github.com/mattermost/mattermost/pull/25798#issuecomment-1889386454
	numberOfHubs := runtime.NumCPU()
	ps.logger.Info("Starting websocket hubs", mlog.Int("number_of_hubs", numberOfHubs))

	hubs := make([]*Hub, numberOfHubs)

	for i := 0; i < numberOfHubs; i++ {
		hubs[i] = newWebHub(ps)
		hubs[i].connectionIndex = i
		hubs[i].broadcastHooks = broadcastHooks
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
	_, err := hash.Write([]byte(userID))
	if err != nil {
		ps.logger.Error("Unable to write userID to hash", mlog.String("userID", userID), mlog.Err(err))
	}
	index := hash.Sum64() % uint64(len(ps.hubs))

	return ps.hubs[int(index)]
}

// HubRegister registers a connection to a hub.
func (ps *PlatformService) HubRegister(webConn *WebConn) error {
	hub := ps.GetHubForUserId(webConn.UserId)
	if hub != nil {
		if metrics := ps.metricsIFace; metrics != nil {
			metrics.IncrementWebSocketBroadcastUsersRegistered(strconv.Itoa(hub.connectionIndex), 1)
		}
		return hub.Register(webConn)
	}
	return nil
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
	teamID := channel.TeamId
	if teamID == "" {
		teamID = "dm"
	}

	ps.Store.Channel().InvalidateChannelByName(teamID, channel.Name)
}

func (ps *PlatformService) InvalidateCacheForChannelMembers(channelID string) {
	ps.Store.User().InvalidateProfilesInChannelCache(channelID)
	ps.Store.Channel().InvalidateMemberCount(channelID)
	ps.Store.Channel().InvalidateGuestCount(channelID)
}

func (ps *PlatformService) InvalidateCacheForChannelMembersNotifyProps(channelID string) {
	ps.Store.Channel().InvalidateCacheForChannelMembersNotifyProps(channelID)
}

func (ps *PlatformService) InvalidateCacheForChannelPosts(channelID string) {
	ps.Store.Channel().InvalidatePinnedPostCount(channelID)
	ps.Store.Post().InvalidateLastPostTimeCache(channelID)
}

func (ps *PlatformService) InvalidateCacheForUser(userID string) {
	ps.InvalidateChannelCacheForUser(userID)
	ps.Store.User().InvalidateProfileCacheForUser(userID)
}

func (ps *PlatformService) invalidateWebConnSessionCacheForUser(userID string) {
	ps.invalidateWebConnSessionCacheForUserSkipClusterSend(userID)
	if ps.clusterIFace != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateWebConnCacheForUser,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(userID),
		}
		ps.clusterIFace.SendClusterMessage(msg)
	}
}

func (ps *PlatformService) InvalidateChannelCacheForUser(userID string) {
	ps.Store.Channel().InvalidateAllChannelMembersForUser(userID)
	ps.invalidateWebConnSessionCacheForUser(userID)
	ps.Store.User().InvalidateProfilesInChannelCacheByUser(userID)
}

func (ps *PlatformService) InvalidateCacheForUserTeams(userID string) {
	ps.invalidateWebConnSessionCacheForUser(userID)
	// This method has its own cluster broadcast hidden inside localcachelayer.
	ps.Store.Team().InvalidateAllTeamIdsForUser(userID)
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

func (ps *PlatformService) CheckWebConn(userID, connectionID string, seqNum int64) *CheckConnResult {
	if ps.Cluster() == nil || seqNum == 0 {
		hub := ps.GetHubForUserId(userID)
		if hub != nil {
			return hub.CheckConn(userID, connectionID)
		}
		return nil
	}

	// We need some extra care for HA
	// Check other nodes
	// If any nodes return with an aq and/or dq, use that.
	// If all nodes return empty, proceed with local case.
	// We have to do this because a client might reconnect with an older seq num to a node
	// which it had connected before. So checking its local queue will lead the server to believe
	// that there is no msg loss, whereas there is actually loss.
	queueMap, err := ps.Cluster().GetWSQueues(userID, connectionID, seqNum)
	if err != nil {
		// If there is an error we do not have enough data to say anything reliably.
		// Fall back to unreliable case.
		ps.Log().Error("Error while getting websocket queues",
			mlog.String("connection_id", connectionID),
			mlog.String("user_id", userID),
			mlog.Int("sequence_number", seqNum),
			mlog.Err(err))
		return nil
	}

	connRes := &CheckConnResult{
		ConnectionID: connectionID,
		UserID:       userID,
	}
	for _, queues := range queueMap {
		if queues == nil || queues.ActiveQ == nil {
			continue
		}
		// parse the activeq
		aq := make(chan model.WebSocketMessage, sendQueueSize)
		for _, aqItem := range queues.ActiveQ {
			item, err := ps.UnmarshalAQItem(aqItem)
			if err != nil {
				ps.Log().Error("Error while unmarshalling websocket message from active queue",
					mlog.String("connection_id", connectionID),
					mlog.String("user_id", userID),
					mlog.Err(err))
				return nil
			}
			// This cannot block because all send queues are of sendQueueSize at max.
			// TODO: There could be a case where there's severe message loss, and to
			// reliably get the messages, we need to get send queues from multiple nodes.
			// We leave that case for Redis.
			aq <- item
		}

		connRes.ActiveQueue = aq
		connRes.ReuseCount = queues.ReuseCount

		// parse the deadq
		if queues.DeadQ != nil {
			dq, dqPtr, err := ps.UnmarshalDQ(queues.DeadQ)
			if err != nil {
				ps.Log().Error("Error while unmarshalling websocket message from dead queue",
					mlog.String("connection_id", connectionID),
					mlog.String("user_id", userID),
					mlog.Err(err))
				return nil
			}

			// We check if atleast one item has been written.
			// Length of dq is always guaranteed to be deadQueueSize.
			if dq[0] != nil {
				connRes.DeadQueue = dq
				connRes.DeadQueuePointer = dqPtr
			}
		}

		return connRes
	}

	// Now we check local queue
	hub := ps.GetHubForUserId(userID)
	if hub != nil {
		return hub.CheckConn(userID, connectionID)
	}
	return nil
}

// WebConnCountForUser returns the number of active websocket connections
// for a given userID.
func (ps *PlatformService) WebConnCountForUser(userID string) int {
	hub := ps.GetHubForUserId(userID)
	if hub != nil {
		return hub.WebConnCountForUser(userID)
	}
	return 0
}

// Register registers a connection to the hub.
func (h *Hub) Register(webConn *WebConn) error {
	wr := &webConnRegisterMessage{
		conn: webConn,
		err:  make(chan error),
	}
	select {
	case h.register <- wr:
		return <-wr.err
	case <-h.stop:
	}
	return nil
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

func (h *Hub) WebConnCountForUser(userID string) int {
	req := &webConnCountMessage{
		userID: userID,
		result: make(chan int),
	}
	select {
	case h.connCount <- req:
		return <-req.result
	case <-h.stop:
	}
	return 0
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

		connIndex := newHubConnectionIndex(inactiveConnReaperInterval,
			h.platform.Store,
			h.platform.logger,
			*h.platform.Config().ServiceSettings.EnableWebHubChannelIteration,
		)

		for {
			select {
			case webSessionMessage := <-h.checkRegistered:
				var isRegistered bool
				for conn := range connIndex.ForUser(webSessionMessage.userID) {
					if !conn.Active.Load() {
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
			case req := <-h.connCount:
				req.result <- connIndex.ForUserActiveCount(req.userID)
			case <-ticker.C:
				connIndex.RemoveInactiveConnections()
			case webConnReg := <-h.register:
				// Mark the current one as active.
				// There is no need to check if it was inactive or not,
				// we will anyways need to make it active.
				webConnReg.conn.Active.Store(true)

				err := connIndex.Add(webConnReg.conn)
				if err != nil {
					webConnReg.err <- err
					continue
				}
				atomic.StoreInt64(&h.connectionCount, int64(connIndex.AllActive()))

				if webConnReg.conn.IsAuthenticated() && webConnReg.conn.reuseCount == 0 {
					// The hello message should only be sent when the reuseCount is 0.
					// i.e in server restart, or long timeout, or fresh connection case.
					// In case of seq number not found in dead queue, it is handled by
					// the webconn write pump.
					webConnReg.conn.send <- webConnReg.conn.createHelloMessage()
				}
				webConnReg.err <- nil
			case webConn := <-h.unregister:
				// If already removed (via queue full), then removing again becomes a noop.
				// But if not removed, mark inactive.
				webConn.Active.Store(false)

				atomic.StoreInt64(&h.connectionCount, int64(connIndex.AllActive()))

				if webConn.UserId == "" {
					continue
				}

				conns := connIndex.ForUser(webConn.UserId)
				// areAllInactive also returns true if there are no connections,
				// which is intentional.
				if areAllInactive(conns) {
					userID := webConn.UserId
					h.platform.Go(func() {
						// If this is an HA setup, get count for this user
						// from other nodes.
						var clusterCnt int
						var appErr *model.AppError
						if h.platform.Cluster() != nil {
							clusterCnt, appErr = h.platform.Cluster().WebConnCountForUser(userID)
						}
						if appErr != nil {
							mlog.Error("Error in trying to get the webconn count from cluster", mlog.Err(appErr))
							// We take a conservative approach
							// and do not set status to offline in case
							// there's an error, rather than potentially
							// incorrectly setting status to offline.
							return
						}
						// Only set to offline if there are no
						// active connections in other nodes as well.
						if clusterCnt == 0 {
							h.platform.SetStatusOffline(userID, false)
						}
					})
					continue
				}
				var latestActivity int64
				for conn := range conns {
					if !conn.Active.Load() {
						continue
					}
					if conn.lastUserActivityAt > latestActivity {
						latestActivity = conn.lastUserActivityAt
					}
				}

				if h.platform.isUserAway(latestActivity) {
					userID := webConn.UserId
					h.platform.Go(func() {
						h.platform.SetStatusLastActivityAt(userID, latestActivity)
					})
				}
			case userID := <-h.invalidateUser:
				for webConn := range connIndex.ForUser(userID) {
					webConn.InvalidateCache()
				}

				if !*h.platform.Config().ServiceSettings.EnableWebHubChannelIteration {
					continue
				}

				err := connIndex.InvalidateCMCacheForUser(userID)
				if err != nil {
					h.platform.Log().Error("Error while invalidating channel member cache", mlog.String("user_id", userID), mlog.Err(err))
					for webConn := range connIndex.ForUser(userID) {
						closeAndRemoveConn(connIndex, webConn)
					}
				}
			case activity := <-h.activity:
				for webConn := range connIndex.ForUser(activity.userID) {
					if !webConn.Active.Load() {
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
					// Don't log the warning if it's an inactive connection.
					if directMsg.conn.Active.Load() {
						mlog.Error("webhub.broadcast: cannot send, closing websocket for user",
							mlog.String("user_id", directMsg.conn.UserId),
							mlog.String("conn_id", directMsg.conn.GetConnectionID()))
					}
					closeAndRemoveConn(connIndex, directMsg.conn)
				}
			case msg := <-h.broadcast:
				if metrics := h.platform.metricsIFace; metrics != nil {
					metrics.DecrementWebSocketBroadcastBufferSize(strconv.Itoa(h.connectionIndex), 1)
				}

				// Remove the broadcast hook information before precomputing the JSON so that those aren't included in it
				msg, broadcastHooks, broadcastHookArgs := msg.WithoutBroadcastHooks()

				msg = msg.PrecomputeJSON()

				broadcast := func(webConn *WebConn) {
					if !connIndex.Has(webConn) {
						return
					}
					if webConn.ShouldSendEvent(msg) {
						select {
						case webConn.send <- h.runBroadcastHooks(msg, webConn, broadcastHooks, broadcastHookArgs):
						default:
							// Don't log the warning if it's an inactive connection.
							if webConn.Active.Load() {
								mlog.Error("webhub.broadcast: cannot send, closing websocket for user",
									mlog.String("user_id", webConn.UserId),
									mlog.String("conn_id", webConn.GetConnectionID()))
							}
							closeAndRemoveConn(connIndex, webConn)
						}
					}
				}

				// Quick return for a single connection.
				if webConn := connIndex.ForConnection(msg.GetBroadcast().ConnectionId); webConn != nil {
					broadcast(webConn)
					continue
				}

				fastIteration := *h.platform.Config().ServiceSettings.EnableWebHubChannelIteration
				var targetConns iter.Seq[*WebConn]
				if userID := msg.GetBroadcast().UserId; userID != "" {
					targetConns = connIndex.ForUser(userID)
				} else if channelID := msg.GetBroadcast().ChannelId; channelID != "" && fastIteration {
					targetConns = connIndex.ForChannel(channelID)
				}
				if targetConns != nil {
					for webConn := range targetConns {
						broadcast(webConn)
					}
					continue
				}

				// There are multiple hubs in a system. So while supporting both channel based iteration and the old
				// method, there would be events scoped to a channel being sent to multiple hubs. And only one hub would
				// have the targetConns. Therefore, we need to stop here if channel based iteration is enabled, and it's a
				// channel-scoped event.
				if channelID := msg.GetBroadcast().ChannelId; channelID != "" && fastIteration {
					continue
				}

				for webConn := range connIndex.All() {
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

// areAllInactive returns whether all of the connections
// are inactive or not. It also returns true if there are
// no connections which is also intentional.
func areAllInactive(conns iter.Seq[*WebConn]) bool {
	for conn := range conns {
		if conn.Active.Load() {
			return false
		}
	}
	return true
}

// closeAndRemoveConn closes the send channel which will close the
// websocket connection, and then it removes the webConn from the conn index.
func closeAndRemoveConn(connIndex *hubConnectionIndex, conn *WebConn) {
	close(conn.send)
	connIndex.Remove(conn)
}

// hubConnectionIndex provides fast addition, removal, and iteration of web connections.
// It requires 4 functionalities which need to be very fast:
// - check if a connection exists or not.
// - get all connections for a given userID.
// - get all connections for a given channelID.
// - get all connections.
type hubConnectionIndex struct {
	// byUserId stores the set of connections for a given userID
	byUserId map[string]map[*WebConn]struct{}
	// byChannelID stores the set of connections for a given channelID
	byChannelID map[string]map[*WebConn]struct{}
	// byConnection serves the dual purpose of storing the channelIDs
	// and also to get all connections
	byConnection   map[*WebConn][]string
	byConnectionId map[string]*WebConn
	// staleThreshold is the limit beyond which inactive connections
	// will be deleted.
	staleThreshold time.Duration

	fastIteration bool
	store         store.Store
	logger        mlog.LoggerIFace
}

func newHubConnectionIndex(interval time.Duration,
	store store.Store,
	logger mlog.LoggerIFace,
	fastIteration bool,
) *hubConnectionIndex {
	return &hubConnectionIndex{
		byUserId:       make(map[string]map[*WebConn]struct{}),
		byChannelID:    make(map[string]map[*WebConn]struct{}),
		byConnection:   make(map[*WebConn][]string),
		byConnectionId: make(map[string]*WebConn),
		staleThreshold: interval,
		store:          store,
		logger:         logger,
		fastIteration:  fastIteration,
	}
}

func (i *hubConnectionIndex) Add(wc *WebConn) error {
	var channelIDs []string
	if i.fastIteration {
		cm, err := i.store.Channel().GetAllChannelMembersForUser(request.EmptyContext(i.logger), wc.UserId, false, false)
		if err != nil {
			return fmt.Errorf("error getChannelMembersForUser: %v", err)
		}

		// Store channel IDs and add to byChannelID
		channelIDs = make([]string, 0, len(cm))
		for chID := range cm {
			channelIDs = append(channelIDs, chID)

			// Initialize the channel's map if it doesn't exist
			if _, ok := i.byChannelID[chID]; !ok {
				i.byChannelID[chID] = make(map[*WebConn]struct{})
			}
			i.byChannelID[chID][wc] = struct{}{}
		}
	}

	// Initialize the user's map if it doesn't exist
	if _, ok := i.byUserId[wc.UserId]; !ok {
		i.byUserId[wc.UserId] = make(map[*WebConn]struct{})
	}
	i.byUserId[wc.UserId][wc] = struct{}{}
	i.byConnection[wc] = channelIDs
	i.byConnectionId[wc.GetConnectionID()] = wc
	return nil
}

func (i *hubConnectionIndex) Remove(wc *WebConn) {
	channelIDs, ok := i.byConnection[wc]
	if !ok {
		return
	}

	// Remove from byUserId
	if userConns, ok := i.byUserId[wc.UserId]; ok {
		delete(userConns, wc)
	}

	if i.fastIteration {
		// Remove from byChannelID for each channel
		for _, chID := range channelIDs {
			if channelConns, ok := i.byChannelID[chID]; ok {
				delete(channelConns, wc)
			}
		}
	}

	delete(i.byConnection, wc)
	delete(i.byConnectionId, wc.GetConnectionID())
}

func (i *hubConnectionIndex) InvalidateCMCacheForUser(userID string) error {
	// We make this query first to fail fast in case of an error.
	cm, err := i.store.Channel().GetAllChannelMembersForUser(request.EmptyContext(i.logger), userID, false, false)
	if err != nil {
		return err
	}

	// Get all connections for this user
	conns := i.ForUser(userID)

	// Remove all user connections from existing channels
	for conn := range conns {
		if channelIDs, ok := i.byConnection[conn]; ok {
			// Remove from old channels
			for _, chID := range channelIDs {
				if channelConns, ok := i.byChannelID[chID]; ok {
					delete(channelConns, conn)
				}
			}
		}
	}

	// Add connections to new channels
	for conn := range conns {
		newChannelIDs := make([]string, 0, len(cm))
		for chID := range cm {
			newChannelIDs = append(newChannelIDs, chID)
			// Initialize channel map if needed
			if _, ok := i.byChannelID[chID]; !ok {
				i.byChannelID[chID] = make(map[*WebConn]struct{})
			}
			i.byChannelID[chID][conn] = struct{}{}
		}

		// Update connection metadata
		if _, ok := i.byConnection[conn]; ok {
			i.byConnection[conn] = newChannelIDs
		}
	}

	return nil
}

func (i *hubConnectionIndex) Has(wc *WebConn) bool {
	_, ok := i.byConnection[wc]
	return ok
}

// ForUser returns all connections for a user ID.
func (i *hubConnectionIndex) ForUser(id string) iter.Seq[*WebConn] {
	return maps.Keys(i.byUserId[id])
}

// ForChannel returns all connections for a channelID.
func (i *hubConnectionIndex) ForChannel(channelID string) iter.Seq[*WebConn] {
	return maps.Keys(i.byChannelID[channelID])
}

// ForUserActiveCount returns the number of active connections for a userID
func (i *hubConnectionIndex) ForUserActiveCount(id string) int {
	cnt := 0
	for conn := range i.ForUser(id) {
		if conn.Active.Load() {
			cnt++
		}
	}
	return cnt
}

// ForConnection returns the connection from its ID.
func (i *hubConnectionIndex) ForConnection(id string) *WebConn {
	return i.byConnectionId[id]
}

// All returns the full webConn index.
func (i *hubConnectionIndex) All() map[*WebConn][]string {
	return i.byConnection
}

// RemoveInactiveByConnectionID removes an inactive connection for the given
// userID and connectionID.
func (i *hubConnectionIndex) RemoveInactiveByConnectionID(userID, connectionID string) *WebConn {
	// To handle empty sessions.
	if userID == "" {
		return nil
	}
	for conn := range i.ForUser(userID) {
		if conn.GetConnectionID() == connectionID && !conn.Active.Load() {
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
		if !conn.Active.Load() && now-conn.lastUserActivityAt > i.staleThreshold.Milliseconds() {
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
		if conn.Active.Load() {
			cnt++
		}
	}
	return cnt
}
