// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"hash/fnv"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	BROADCAST_QUEUE_SIZE = 4096
	DEADLOCK_TICKER      = 15 * time.Second                  // check every 15 seconds
	DEADLOCK_WARN        = (BROADCAST_QUEUE_SIZE * 99) / 100 // number of buffered messages before printing stack trace
)

type WebConnActivityMessage struct {
	UserId       string
	SessionToken string
	ActivityAt   int64
}

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
	activity        chan *WebConnActivityMessage
	ExplicitStop    bool
	goroutineId     int
}

func (a *App) NewWebHub() *Hub {
	return &Hub{
		app:            a,
		register:       make(chan *WebConn, 1),
		unregister:     make(chan *WebConn, 1),
		broadcast:      make(chan *model.WebSocketEvent, BROADCAST_QUEUE_SIZE),
		stop:           make(chan struct{}),
		didStop:        make(chan struct{}),
		invalidateUser: make(chan string),
		activity:       make(chan *WebConnActivityMessage),
		ExplicitStop:   false,
	}
}

func (a *App) TotalWebsocketConnections() int {
	count := int64(0)
	for _, hub := range a.Srv.Hubs {
		count = count + atomic.LoadInt64(&hub.connectionCount)
	}

	return int(count)
}

func (a *App) HubStart() {
	// Total number of hubs is twice the number of CPUs.
	numberOfHubs := runtime.NumCPU() * 2
	mlog.Info("Starting websocket hubs", mlog.Int("number_of_hubs", numberOfHubs))

	a.Srv.Hubs = make([]*Hub, numberOfHubs)
	a.Srv.HubsStopCheckingForDeadlock = make(chan bool, 1)

	for i := 0; i < len(a.Srv.Hubs); i++ {
		a.Srv.Hubs[i] = a.NewWebHub()
		a.Srv.Hubs[i].connectionIndex = i
		a.Srv.Hubs[i].Start()
	}

	go func() {
		ticker := time.NewTicker(DEADLOCK_TICKER)

		defer func() {
			ticker.Stop()
		}()

		for {
			select {
			case <-ticker.C:
				for _, hub := range a.Srv.Hubs {
					if len(hub.broadcast) >= DEADLOCK_WARN {
						mlog.Error(
							"Hub processing might be deadlock with events in the buffer",
							mlog.Int("hub", hub.connectionIndex),
							mlog.Int("goroutine", hub.goroutineId),
							mlog.Int("events", len(hub.broadcast)),
						)
						buf := make([]byte, 1<<16)
						runtime.Stack(buf, true)
						output := fmt.Sprintf("%s", buf)
						splits := strings.Split(output, "goroutine ")

						for _, part := range splits {
							if strings.Contains(part, fmt.Sprintf("%v", hub.goroutineId)) {
								mlog.Error("Trace for possible deadlock goroutine", mlog.String("trace", part))
							}
						}
					}
				}

			case <-a.Srv.HubsStopCheckingForDeadlock:
				return
			}
		}
	}()
}

func (a *App) HubStop() {
	mlog.Info("stopping websocket hub connections")

	select {
	case a.Srv.HubsStopCheckingForDeadlock <- true:
	default:
		mlog.Warn("We appear to have already sent the stop checking for deadlocks command")
	}

	for _, hub := range a.Srv.Hubs {
		hub.Stop()
	}

	a.Srv.Hubs = []*Hub{}
}

func (a *App) GetHubForUserId(userId string) *Hub {
	if len(a.Srv.Hubs) == 0 {
		return nil
	}

	hash := fnv.New32a()
	hash.Write([]byte(userId))
	index := hash.Sum32() % uint32(len(a.Srv.Hubs))
	return a.Srv.Hubs[index]
}

func (a *App) HubRegister(webConn *WebConn) {
	hub := a.GetHubForUserId(webConn.UserId)
	if hub != nil {
		hub.Register(webConn)
	}
}

func (a *App) HubUnregister(webConn *WebConn) {
	hub := a.GetHubForUserId(webConn.UserId)
	if hub != nil {
		hub.Unregister(webConn)
	}
}

func (a *App) Publish(message *model.WebSocketEvent) {
	if metrics := a.Metrics; metrics != nil {
		metrics.IncrementWebsocketEvent(message.EventType())
	}

	a.PublishSkipClusterSend(message)

	if a.Cluster != nil {
		cm := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_PUBLISH,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     message.ToJson(),
		}

		if message.EventType() == model.WEBSOCKET_EVENT_POSTED ||
			message.EventType() == model.WEBSOCKET_EVENT_POST_EDITED ||
			message.EventType() == model.WEBSOCKET_EVENT_DIRECT_ADDED ||
			message.EventType() == model.WEBSOCKET_EVENT_GROUP_ADDED ||
			message.EventType() == model.WEBSOCKET_EVENT_ADDED_TO_TEAM {
			cm.SendType = model.CLUSTER_SEND_RELIABLE
		}

		a.Cluster.SendClusterMessage(cm)
	}
}

func (a *App) PublishSkipClusterSend(message *model.WebSocketEvent) {
	if message.GetBroadcast().UserId != "" {
		hub := a.GetHubForUserId(message.GetBroadcast().UserId)
		if hub != nil {
			hub.Broadcast(message)
		}
	} else {
		for _, hub := range a.Srv.Hubs {
			hub.Broadcast(message)
		}
	}
}

func (a *App) InvalidateCacheForChannel(channel *model.Channel) {
	a.Srv.Store.Channel().InvalidateChannel(channel.Id)
	a.InvalidateCacheForChannelByNameSkipClusterSend(channel.TeamId, channel.Name)

	if a.Cluster != nil {
		nameMsg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_BY_NAME,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Props:    make(map[string]string),
		}

		nameMsg.Props["name"] = channel.Name
		if channel.TeamId == "" {
			nameMsg.Props["id"] = "dm"
		} else {
			nameMsg.Props["id"] = channel.TeamId
		}

		a.Cluster.SendClusterMessage(nameMsg)
	}
}

func (a *App) InvalidateCacheForChannelMembers(channelId string) {
	a.Srv.Store.User().InvalidateProfilesInChannelCache(channelId)
	a.Srv.Store.Channel().InvalidateMemberCount(channelId)
	a.Srv.Store.Channel().InvalidateGuestCount(channelId)
}

func (a *App) InvalidateCacheForChannelMembersNotifyProps(channelId string) {
	a.InvalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelId)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_NOTIFY_PROPS,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     channelId,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) InvalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelId string) {
	a.Srv.Store.Channel().InvalidateCacheForChannelMembersNotifyProps(channelId)
}

func (a *App) InvalidateCacheForChannelByNameSkipClusterSend(teamId, name string) {
	if teamId == "" {
		teamId = "dm"
	}

	a.Srv.Store.Channel().InvalidateChannelByName(teamId, name)
}

func (a *App) InvalidateCacheForChannelPosts(channelId string) {
	a.Srv.Store.Channel().InvalidatePinnedPostCount(channelId)
	a.Srv.Store.Post().InvalidateLastPostTimeCache(channelId)
}

func (a *App) InvalidateCacheForUser(userId string) {
	a.InvalidateCacheForUserSkipClusterSend(userId)

	a.Srv.Store.User().InvalidateProfilesInChannelCacheByUser(userId)
	a.Srv.Store.User().InvalidateProfileCacheForUser(userId)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     userId,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) InvalidateCacheForUserTeams(userId string) {
	a.InvalidateCacheForUserTeamsSkipClusterSend(userId)
	a.Srv.Store.Team().InvalidateAllTeamIdsForUser(userId)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER_TEAMS,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     userId,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) InvalidateCacheForUserSkipClusterSend(userId string) {
	a.Srv.Store.Channel().InvalidateAllChannelMembersForUser(userId)

	hub := a.GetHubForUserId(userId)
	if hub != nil {
		hub.InvalidateUser(userId)
	}
}

func (a *App) InvalidateCacheForUserTeamsSkipClusterSend(userId string) {
	hub := a.GetHubForUserId(userId)
	if hub != nil {
		hub.InvalidateUser(userId)
	}
}

func (a *App) InvalidateCacheForWebhook(webhookId string) {
	a.Srv.Store.Webhook().InvalidateWebhookCache(webhookId)
}

func (a *App) InvalidateWebConnSessionCacheForUser(userId string) {
	hub := a.GetHubForUserId(userId)
	if hub != nil {
		hub.InvalidateUser(userId)
	}
}

func (a *App) UpdateWebConnUserActivity(session model.Session, activityAt int64) {
	hub := a.GetHubForUserId(session.UserId)
	if hub != nil {
		hub.UpdateActivity(session.UserId, session.Token, activityAt)
	}
}

func (h *Hub) Register(webConn *WebConn) {
	select {
	case h.register <- webConn:
	case <-h.didStop:
	}

	if webConn.IsAuthenticated() {
		webConn.SendHello()
	}
}

func (h *Hub) Unregister(webConn *WebConn) {
	select {
	case h.unregister <- webConn:
	case <-h.stop:
	}
}

func (h *Hub) Broadcast(message *model.WebSocketEvent) {
	if h != nil && h.broadcast != nil && message != nil {
		select {
		case h.broadcast <- message:
		case <-h.didStop:
		}
	}
}

func (h *Hub) InvalidateUser(userId string) {
	select {
	case h.invalidateUser <- userId:
	case <-h.didStop:
	}
}

func (h *Hub) UpdateActivity(userId, sessionToken string, activityAt int64) {
	select {
	case h.activity <- &WebConnActivityMessage{UserId: userId, SessionToken: sessionToken, ActivityAt: activityAt}:
	case <-h.didStop:
	}
}

func getGoroutineId() int {
	var buf [64]byte
	n := runtime.Stack(buf[:], false)
	idField := strings.Fields(strings.TrimPrefix(string(buf[:n]), "goroutine "))[0]
	id, err := strconv.Atoi(idField)
	if err != nil {
		id = -1
	}
	return id
}

func (h *Hub) Stop() {
	close(h.stop)
	<-h.didStop
}

func (h *Hub) Start() {
	var doStart func()
	var doRecoverableStart func()
	var doRecover func()

	doStart = func() {
		h.goroutineId = getGoroutineId()
		mlog.Debug("Hub for index is starting with goroutine", mlog.Int("index", h.connectionIndex), mlog.Int("goroutine", h.goroutineId))

		connections := newHubConnectionIndex()

		for {
			select {
			case webCon := <-h.register:
				connections.Add(webCon)
				atomic.StoreInt64(&h.connectionCount, int64(len(connections.All())))
			case webCon := <-h.unregister:
				connections.Remove(webCon)
				atomic.StoreInt64(&h.connectionCount, int64(len(connections.All())))

				if len(webCon.UserId) == 0 {
					continue
				}

				conns := connections.ForUser(webCon.UserId)
				if len(conns) == 0 {
					h.app.Srv.Go(func() {
						h.app.SetStatusOffline(webCon.UserId, false)
					})
				} else {
					var latestActivity int64 = 0
					for _, conn := range conns {
						if conn.LastUserActivityAt > latestActivity {
							latestActivity = conn.LastUserActivityAt
						}
					}
					if h.app.IsUserAway(latestActivity) {
						h.app.Srv.Go(func() {
							h.app.SetStatusLastActivityAt(webCon.UserId, latestActivity)
						})
					}
				}
			case userId := <-h.invalidateUser:
				for _, webCon := range connections.ForUser(userId) {
					webCon.InvalidateCache()
				}
			case activity := <-h.activity:
				for _, webCon := range connections.ForUser(activity.UserId) {
					if webCon.GetSessionToken() == activity.SessionToken {
						webCon.LastUserActivityAt = activity.ActivityAt
					}
				}
			case msg := <-h.broadcast:
				candidates := connections.All()
				if msg.GetBroadcast().UserId != "" {
					candidates = connections.ForUser(msg.GetBroadcast().UserId)
				}
				msg = msg.PrecomputeJSON()
				for _, webCon := range candidates {
					if webCon.ShouldSendEvent(msg) {
						select {
						case webCon.Send <- msg:
						default:
							mlog.Error("webhub.broadcast: cannot send, closing websocket for user", mlog.String("user_id", webCon.UserId))
							close(webCon.Send)
							connections.Remove(webCon)
						}
					}
				}
			case <-h.stop:
				userIds := make(map[string]bool)

				for _, webCon := range connections.All() {
					userIds[webCon.UserId] = true
					webCon.Close()
				}

				for userId := range userIds {
					h.app.SetStatusOffline(userId, false)
				}

				h.ExplicitStop = true
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
		if !h.ExplicitStop {
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

func (i *hubConnectionIndex) ForUser(id string) []*WebConn {
	return i.connectionsByUserId[id]
}

func (i *hubConnectionIndex) All() []*WebConn {
	return i.connections
}
