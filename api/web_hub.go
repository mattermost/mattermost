// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"hash/fnv"
	"runtime"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type Hub struct {
	connections    map[*WebConn]bool
	register       chan *WebConn
	unregister     chan *WebConn
	broadcast      chan *model.WebSocketEvent
	stop           chan string
	invalidateUser chan string
}

var hubs []*Hub = make([]*Hub, 0)

func NewWebHub() *Hub {
	return &Hub{
		register:       make(chan *WebConn),
		unregister:     make(chan *WebConn),
		connections:    make(map[*WebConn]bool, model.SESSION_CACHE_SIZE),
		broadcast:      make(chan *model.WebSocketEvent, 4096),
		stop:           make(chan string),
		invalidateUser: make(chan string),
	}
}

func TotalWebsocketConnections() int {
	// XXX TODO FIXME, this is racy and needs to be fixed
	count := 0
	for _, hub := range hubs {
		count = count + len(hub.connections)
	}

	return count
}

func HubStart() {
	l4g.Info(utils.T("api.web_hub.start.starting.debug"), runtime.NumCPU()*2)

	// Total number of hubs is twice the number of CPUs.
	hubs = make([]*Hub, runtime.NumCPU()*2)

	for i := 0; i < len(hubs); i++ {
		hubs[i] = NewWebHub()
		hubs[i].Start()
	}
}

func HubStop() {
	l4g.Info(utils.T("api.web_hub.start.stopping.debug"))

	for _, hub := range hubs {
		hub.Stop()
	}

	hubs = make([]*Hub, 0)
}

func GetHubForUserId(userId string) *Hub {
	hash := fnv.New32a()
	hash.Write([]byte(userId))
	index := hash.Sum32() % uint32(len(hubs))
	return hubs[index]
}

func HubRegister(webConn *WebConn) {
	GetHubForUserId(webConn.UserId).Register(webConn)
}

func HubUnregister(webConn *WebConn) {
	GetHubForUserId(webConn.UserId).Unregister(webConn)
}

func Publish(message *model.WebSocketEvent) {
	message.DoPreComputeJson()
	for _, hub := range hubs {
		hub.Broadcast(message)
	}

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().Publish(message)
	}
}

func PublishSkipClusterSend(message *model.WebSocketEvent) {
	message.DoPreComputeJson()
	for _, hub := range hubs {
		hub.Broadcast(message)
	}
}

func InvalidateCacheForUser(userId string) {
	InvalidateCacheForUserSkipClusterSend(userId)

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().InvalidateCacheForUser(userId)
	}
}

func InvalidateCacheForUserSkipClusterSend(userId string) {
	Srv.Store.Channel().InvalidateAllChannelMembersForUser(userId)
	Srv.Store.User().InvalidateProfilesInChannelCacheByUser(userId)

	GetHubForUserId(userId).InvalidateUser(userId)
}

func (h *Hub) Register(webConn *WebConn) {
	h.register <- webConn

	if webConn.isAuthenticated() {
		webConn.SendHello()
	}
}

func (h *Hub) Unregister(webConn *WebConn) {
	h.unregister <- webConn
}

func (h *Hub) Broadcast(message *model.WebSocketEvent) {
	if message != nil {
		h.broadcast <- message
	}
}

func (h *Hub) InvalidateUser(userId string) {
	h.invalidateUser <- userId
}

func (h *Hub) Stop() {
	h.stop <- "all"
}

func (h *Hub) Start() {
	go func() {
		for {
			select {
			case webCon := <-h.register:
				h.connections[webCon] = true

			case webCon := <-h.unregister:
				userId := webCon.UserId
				if _, ok := h.connections[webCon]; ok {
					delete(h.connections, webCon)
					close(webCon.Send)
				}

				if len(userId) == 0 {
					continue
				}

				found := false
				for webCon := range h.connections {
					if userId == webCon.UserId {
						found = true
						break
					}
				}

				if !found {
					go SetStatusOffline(userId, false)
				}

			case userId := <-h.invalidateUser:
				for webCon := range h.connections {
					if webCon.UserId == userId {
						webCon.InvalidateCache()
					}
				}

			case msg := <-h.broadcast:
				for webCon := range h.connections {
					if webCon.ShouldSendEvent(msg) {
						select {
						case webCon.Send <- msg:
						default:
							l4g.Error(fmt.Sprintf("webhub.broadcast: cannot send, closing websocket for userId=%v", webCon.UserId))
							close(webCon.Send)
							delete(h.connections, webCon)
						}
					}
				}

			case <-h.stop:
				for webCon := range h.connections {
					webCon.WebSocket.Close()
				}

				return
			}
		}
	}()
}
