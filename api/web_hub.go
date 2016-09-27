// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"

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

var hub = &Hub{
	register:       make(chan *WebConn),
	unregister:     make(chan *WebConn),
	connections:    make(map[*WebConn]bool, model.SESSION_CACHE_SIZE),
	broadcast:      make(chan *model.WebSocketEvent, 64),
	stop:           make(chan string),
	invalidateUser: make(chan string),
}

func Publish(message *model.WebSocketEvent) {
	hub.Broadcast(message)

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().Publish(message)
	}
}

func PublishSkipClusterSend(message *model.WebSocketEvent) {
	hub.Broadcast(message)
}

func InvalidateCacheForUser(userId string) {
	hub.invalidateUser <- userId

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().InvalidateCacheForUser(userId)
	}
}

func InvalidateCacheForChannel(channelId string) {
	// TODO XXX FIXME
	// remove me no longer needed
}

func (h *Hub) Register(webConn *WebConn) {
	h.register <- webConn

	msg := model.NewWebSocketEvent("", "", webConn.UserId, model.WEBSOCKET_EVENT_HELLO)
	msg.Add("server_version", fmt.Sprintf("%v.%v.%v", model.CurrentVersion, model.BuildNumber, utils.CfgHash))
	go Publish(msg)
}

func (h *Hub) Unregister(webConn *WebConn) {
	h.unregister <- webConn
}

func (h *Hub) Broadcast(message *model.WebSocketEvent) {
	if message != nil {
		h.broadcast <- message
	}
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
					webCon.Close()
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
					if webCon.Broadcast(msg) {
						delete(h.connections, webCon)
						webCon.Close()
					}
				}

			case s := <-h.stop:
				l4g.Debug(utils.T("api.web_hub.start.stopping.debug"), s)

				for webCon := range h.connections {
					webCon.CloseSocket()
				}

				return
			}
		}
	}()
}
