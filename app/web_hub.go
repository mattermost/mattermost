// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	BROADCAST_QUEUE_SIZE = 4096
	DEADLOCK_TICKER      = 15 * time.Second                  // check every 15 seconds
	DEADLOCK_WARN        = (BROADCAST_QUEUE_SIZE * 99) / 100 // number of buffered messages before printing stack trace
)

type Hub struct {
	// connectionCount should be kept first.
	// See https://github.com/mattermost/mattermost-server/pull/7281
	connectionCount int64
	app             *App
	connections     []*WebConn
	connectionIndex int
	register        chan *WebConn
	unregister      chan *WebConn
	broadcast       chan *model.WebSocketEvent
	stop            chan struct{}
	didStop         chan struct{}
	invalidateUser  chan string
	ExplicitStop    bool
	goroutineId     int
}

func (a *App) NewWebHub() *Hub {
	return &Hub{
		app:            a,
		register:       make(chan *WebConn, 1),
		unregister:     make(chan *WebConn, 1),
		connections:    make([]*WebConn, 0, model.SESSION_CACHE_SIZE),
		broadcast:      make(chan *model.WebSocketEvent, BROADCAST_QUEUE_SIZE),
		stop:           make(chan struct{}),
		didStop:        make(chan struct{}),
		invalidateUser: make(chan string),
		ExplicitStop:   false,
	}
}

func (a *App) TotalWebsocketConnections() int {
	count := int64(0)
	for _, hub := range a.Hubs {
		count = count + atomic.LoadInt64(&hub.connectionCount)
	}

	return int(count)
}

func (a *App) HubStart() {
	// Total number of hubs is twice the number of CPUs.
	numberOfHubs := runtime.NumCPU() * 2
	l4g.Info(utils.T("api.web_hub.start.starting.debug"), numberOfHubs)

	a.Hubs = make([]*Hub, numberOfHubs)
	a.HubsStopCheckingForDeadlock = make(chan bool, 1)

	for i := 0; i < len(a.Hubs); i++ {
		a.Hubs[i] = a.NewWebHub()
		a.Hubs[i].connectionIndex = i
		a.Hubs[i].Start()
	}

	go func() {
		ticker := time.NewTicker(DEADLOCK_TICKER)

		defer func() {
			ticker.Stop()
		}()

		for {
			select {
			case <-ticker.C:
				for _, hub := range a.Hubs {
					if len(hub.broadcast) >= DEADLOCK_WARN {
						l4g.Error("Hub processing might be deadlock on hub %v goroutine %v with %v events in the buffer", hub.connectionIndex, hub.goroutineId, len(hub.broadcast))
						buf := make([]byte, 1<<16)
						runtime.Stack(buf, true)
						output := fmt.Sprintf("%s", buf)
						splits := strings.Split(output, "goroutine ")

						for _, part := range splits {
							if strings.Contains(part, fmt.Sprintf("%v", hub.goroutineId)) {
								l4g.Error("Trace for possible deadlock goroutine %v", part)
							}
						}
					}
				}

			case <-a.HubsStopCheckingForDeadlock:
				return
			}
		}
	}()
}

func (a *App) HubStop() {
	l4g.Info(utils.T("api.web_hub.start.stopping.debug"))

	select {
	case a.HubsStopCheckingForDeadlock <- true:
	default:
		l4g.Warn("We appear to have already sent the stop checking for deadlocks command")
	}

	for _, hub := range a.Hubs {
		hub.Stop()
	}

	a.Hubs = []*Hub{}
}

func (a *App) GetHubForUserId(userId string) *Hub {
	hash := fnv.New32a()
	hash.Write([]byte(userId))
	index := hash.Sum32() % uint32(len(a.Hubs))
	return a.Hubs[index]
}

func (a *App) HubRegister(webConn *WebConn) {
	a.GetHubForUserId(webConn.UserId).Register(webConn)
}

func (a *App) HubUnregister(webConn *WebConn) {
	a.GetHubForUserId(webConn.UserId).Unregister(webConn)
}

func (a *App) Publish(message *model.WebSocketEvent) {
	if metrics := a.Metrics; metrics != nil {
		metrics.IncrementWebsocketEvent(message.Event)
	}

	a.PublishSkipClusterSend(message)

	if a.Cluster != nil {
		cm := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_PUBLISH,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     message.ToJson(),
		}

		if message.Event == model.WEBSOCKET_EVENT_POSTED ||
			message.Event == model.WEBSOCKET_EVENT_POST_EDITED ||
			message.Event == model.WEBSOCKET_EVENT_DIRECT_ADDED ||
			message.Event == model.WEBSOCKET_EVENT_GROUP_ADDED ||
			message.Event == model.WEBSOCKET_EVENT_ADDED_TO_TEAM {
			cm.SendType = model.CLUSTER_SEND_RELIABLE
		}

		a.Cluster.SendClusterMessage(cm)
	}
}

func (a *App) PublishSkipClusterSend(message *model.WebSocketEvent) {
	for _, hub := range a.Hubs {
		hub.Broadcast(message)
	}
}

func (a *App) InvalidateCacheForChannel(channel *model.Channel) {
	a.InvalidateCacheForChannelSkipClusterSend(channel.Id)
	a.InvalidateCacheForChannelByNameSkipClusterSend(channel.TeamId, channel.Name)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     channel.Id,
		}

		a.Cluster.SendClusterMessage(msg)

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

func (a *App) InvalidateCacheForChannelSkipClusterSend(channelId string) {
	a.Srv.Store.Channel().InvalidateChannel(channelId)
}

func (a *App) InvalidateCacheForChannelMembers(channelId string) {
	a.InvalidateCacheForChannelMembersSkipClusterSend(channelId)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     channelId,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) InvalidateCacheForChannelMembersSkipClusterSend(channelId string) {
	a.Srv.Store.User().InvalidateProfilesInChannelCache(channelId)
	a.Srv.Store.Channel().InvalidateMemberCount(channelId)
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
	a.InvalidateCacheForChannelPostsSkipClusterSend(channelId)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_POSTS,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     channelId,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) InvalidateCacheForChannelPostsSkipClusterSend(channelId string) {
	a.Srv.Store.Post().InvalidateLastPostTimeCache(channelId)
}

func (a *App) InvalidateCacheForUser(userId string) {
	a.InvalidateCacheForUserSkipClusterSend(userId)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     userId,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) InvalidateCacheForUserSkipClusterSend(userId string) {
	a.Srv.Store.Channel().InvalidateAllChannelMembersForUser(userId)
	a.Srv.Store.User().InvalidateProfilesInChannelCacheByUser(userId)
	a.Srv.Store.User().InvalidatProfileCacheForUser(userId)

	if len(a.Hubs) != 0 {
		a.GetHubForUserId(userId).InvalidateUser(userId)
	}
}

func (a *App) InvalidateCacheForWebhook(webhookId string) {
	a.InvalidateCacheForWebhookSkipClusterSend(webhookId)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOK,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     webhookId,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) InvalidateCacheForWebhookSkipClusterSend(webhookId string) {
	a.Srv.Store.Webhook().InvalidateWebhookCache(webhookId)
}

func (a *App) InvalidateWebConnSessionCacheForUser(userId string) {
	if len(a.Hubs) != 0 {
		a.GetHubForUserId(userId).InvalidateUser(userId)
	}
}

func (h *Hub) Register(webConn *WebConn) {
	h.register <- webConn

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
	if message != nil {
		h.broadcast <- message
	}
}

func (h *Hub) InvalidateUser(userId string) {
	h.invalidateUser <- userId
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
		l4g.Debug("Hub for index %v is starting with goroutine %v", h.connectionIndex, h.goroutineId)

		for {
			select {
			case webCon := <-h.register:
				h.connections = append(h.connections, webCon)
				atomic.StoreInt64(&h.connectionCount, int64(len(h.connections)))

			case webCon := <-h.unregister:
				userId := webCon.UserId

				found := false
				indexToDel := -1
				for i, webConCandidate := range h.connections {
					if webConCandidate == webCon {
						indexToDel = i
						continue
					}
					if userId == webConCandidate.UserId {
						found = true
						if indexToDel != -1 {
							break
						}
					}
				}

				if indexToDel != -1 {
					// Delete the webcon we are unregistering
					h.connections[indexToDel] = h.connections[len(h.connections)-1]
					h.connections = h.connections[:len(h.connections)-1]
				}

				if len(userId) == 0 {
					continue
				}

				if !found {
					h.app.Go(func() {
						h.app.SetStatusOffline(userId, false)
					})
				}

			case userId := <-h.invalidateUser:
				for _, webCon := range h.connections {
					if webCon.UserId == userId {
						webCon.InvalidateCache()
					}
				}

			case msg := <-h.broadcast:
				for _, webCon := range h.connections {
					if webCon.ShouldSendEvent(msg) {
						select {
						case webCon.Send <- msg:
						default:
							l4g.Error(fmt.Sprintf("webhub.broadcast: cannot send, closing websocket for userId=%v", webCon.UserId))
							close(webCon.Send)
							for i, webConCandidate := range h.connections {
								if webConCandidate == webCon {
									h.connections[i] = h.connections[len(h.connections)-1]
									h.connections = h.connections[:len(h.connections)-1]
									break
								}
							}
						}
					}
				}

			case <-h.stop:
				userIds := make(map[string]bool)

				for _, webCon := range h.connections {
					userIds[webCon.UserId] = true
					webCon.Close()
				}

				for userId := range userIds {
					h.app.SetStatusOffline(userId, false)
				}

				h.connections = make([]*WebConn, 0, model.SESSION_CACHE_SIZE)
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
				l4g.Error(fmt.Sprintf("Recovering from Hub panic. Panic was: %v", r))
			} else {
				l4g.Error("Webhub stopped unexpectedly. Recovering.")
			}

			l4g.Error(string(debug.Stack()))

			go doRecoverableStart()
		}
	}

	go doRecoverableStart()
}
