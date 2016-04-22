// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type Hub struct {
	connections    map[*WebConn]bool
	register       chan *WebConn
	unregister     chan *WebConn
	broadcast      chan *model.Message
	stop           chan string
	invalidateUser chan string
}

var hub = &Hub{
	register:       make(chan *WebConn),
	unregister:     make(chan *WebConn),
	connections:    make(map[*WebConn]bool),
	broadcast:      make(chan *model.Message),
	stop:           make(chan string),
	invalidateUser: make(chan string),
}

func PublishAndForget(message *model.Message) {
	go func() {
		hub.Broadcast(message)
	}()
}

func InvalidateCacheForUser(userId string) {
	hub.invalidateUser <- userId
}

func (h *Hub) Register(webConn *WebConn) {
	h.register <- webConn
}

func (h *Hub) Unregister(webConn *WebConn) {
	h.unregister <- webConn
}

func (h *Hub) Broadcast(message *model.Message) {
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
				if _, ok := h.connections[webCon]; ok {
					delete(h.connections, webCon)
					close(webCon.Send)
				}
			case userId := <-h.invalidateUser:
				for webCon := range h.connections {
					if webCon.UserId == userId {
						webCon.InvalidateCache()
					}
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

func shouldSendEvent(webCon *WebConn, msg *model.Message) bool {

	if webCon.UserId == msg.UserId {
		// Don't need to tell the user they are typing
		if msg.Action == model.ACTION_TYPING {
			return false
		}

		// We have to make sure the user is in the channel. Otherwise system messages that
		// post about users in channels they are not in trigger warnings.
		if len(msg.ChannelId) > 0 {
			allowed := webCon.HasPermissionsToChannel(msg.ChannelId)

			if !allowed {
				return false
			}
		}
	} else {
		// Don't share a user's view or preference events with other users
		if msg.Action == model.ACTION_CHANNEL_VIEWED {
			return false
		} else if msg.Action == model.ACTION_PREFERENCE_CHANGED {
			return false
		} else if msg.Action == model.ACTION_EPHEMERAL_MESSAGE {
			// For now, ephemeral messages are sent directly to individual users
			return false
		}

		// Only report events to users who are in the team for the event
		if len(msg.TeamId) > 0 {
			allowed := webCon.HasPermissionsToTeam(msg.TeamId)

			if !allowed {
				return false
			}
		}

		// Only report events to users who are in the channel for the event
		if len(msg.ChannelId) > 0 {
			allowed := webCon.HasPermissionsToChannel(msg.ChannelId)

			if !allowed {
				return false
			}
		}
	}

	return true
}
