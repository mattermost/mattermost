// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
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
					if !(webCon.UserId == msg.UserId && msg.Action == model.ACTION_TYPING) {
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

					l4g.Debug("team hub stopping for teamId=%v", h.teamId)

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
