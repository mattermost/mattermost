// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type TeamHub struct {
	connections map[*WebConn]bool
	broadcast   chan *model.Message
	register    chan *WebConn
	unregister  chan *WebConn
	stop        chan bool
	teamId      string
}

func NewTeamHub(teamId string) *TeamHub {
	return &TeamHub{
		broadcast:   make(chan *model.Message),
		register:    make(chan *WebConn),
		unregister:  make(chan *WebConn),
		connections: make(map[*WebConn]bool),
		stop:        make(chan bool),
		teamId:      teamId,
	}
}

func (h *TeamHub) Register(webConn *WebConn) {
	h.register <- webConn
}

func (h *TeamHub) Unregister(webConn *WebConn) {
	h.unregister <- webConn
}

func (h *TeamHub) Stop() {
	h.stop <- true
}

func (h *TeamHub) Start() {
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
			case msg := <-h.broadcast:
				for webCon := range h.connections {
					if ShouldSendEvent(webCon, msg) {
						select {
						case webCon.Send <- msg:
						default:
							close(webCon.Send)
							delete(h.connections, webCon)
						}
					}
				}
			case s := <-h.stop:
				if s {

					l4g.Debug(utils.T("api.web_team_hun.start.debug"), h.teamId)

					for webCon := range h.connections {
						webCon.WebSocket.Close()
					}

					return
				}
			}
		}
	}()
}

func (h *TeamHub) UpdateChannelAccessCache(userId string, channelId string) {
	for webCon := range h.connections {
		if webCon.UserId == userId {
			webCon.updateChannelAccessCache(channelId)
			break
		}
	}
}

func ShouldSendEvent(webCon *WebConn, msg *model.Message) bool {

	if webCon.UserId == msg.UserId {
		// Don't need to tell the user they are typing
		if msg.Action == model.ACTION_TYPING {
			return false
		}
	} else {
		// Don't share a user's view or preference events with other users
		if msg.Action == model.ACTION_CHANNEL_VIEWED {
			return false
		} else if msg.Action == model.ACTION_PREFERENCE_CHANGED {
			return false
		}

		// Only report events to a user who is the subject of the event, or is in the channel of the event
		if len(msg.ChannelId) > 0 {
			allowed, ok := webCon.ChannelAccessCache[msg.ChannelId]
			if !ok {
				allowed = webCon.updateChannelAccessCache(msg.ChannelId)
			}

			if !allowed {
				return false
			}
		}
	}

	return true
}
