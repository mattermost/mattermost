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
	connections       map[*WebConn]bool
	register          chan *WebConn
	unregister        chan *WebConn
	broadcast         chan *model.WebSocketEvent
	stop              chan string
	invalidateUser    chan string
	invalidateChannel chan string
}

var hub = &Hub{
	register:          make(chan *WebConn),
	unregister:        make(chan *WebConn),
	connections:       make(map[*WebConn]bool),
	broadcast:         make(chan *model.WebSocketEvent),
	stop:              make(chan string),
	invalidateUser:    make(chan string),
	invalidateChannel: make(chan string),
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
	hub.invalidateChannel <- channelId

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().InvalidateCacheForChannel(channelId)
	}
}

func (h *Hub) Register(webConn *WebConn) {
	h.register <- webConn

	msg := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_HELLO, "", "", webConn.UserId, nil)
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
					close(webCon.Send)
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

			case channelId := <-h.invalidateChannel:
				for webCon := range h.connections {
					webCon.InvalidateCacheForChannel(channelId)
				}

			case msg := <-h.broadcast:
				for webCon := range h.connections {
					if shouldSendEvent(webCon, msg) {
						select {
						case webCon.Send <- msg:
						default:
							close(webCon.Send)
							delete(h.connections, webCon)
						}
					}
				}

			case s := <-h.stop:
				l4g.Debug(utils.T("api.web_hub.start.stopping.debug"), s)

				for webCon := range h.connections {
					webCon.WebSocket.Close()
				}

				return
			}
		}
	}()
}

func shouldSendEvent(webCon *WebConn, msg *model.WebSocketEvent) bool {
	// If the event is destined to a specific user
	if len(msg.Broadcast.UserId) > 0 && webCon.UserId != msg.Broadcast.UserId {
		return false
	}

	// if the user is omitted don't send the message
	if _, ok := msg.Broadcast.OmitUsers[webCon.UserId]; ok {
		return false
	}

	// Only report events to users who are in the channel for the event
	if len(msg.Broadcast.ChannelId) > 0 {
		return webCon.IsMemberOfChannel(msg.Broadcast.ChannelId)
	}

	// Only report events to users who are in the team for the event
	if len(msg.Broadcast.TeamId) > 0 {
		return webCon.IsMemberOfTeam(msg.Broadcast.TeamId)

	}

	return true
}
