// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"strings"
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

	pubsub := store.RedisClient().PubSub()

	go func() {
		defer func() {
			l4g.Debug("redis reader finished for teamId=%v", h.teamId)
			hub.Stop(h.teamId)
		}()

		l4g.Debug("redis reader starting for teamId=%v", h.teamId)

		err := pubsub.Subscribe(h.teamId)
		if err != nil {
			l4g.Error("Error while subscribing to redis %v %v", h.teamId, err)
			return
		}

		for {
			if payload, err := pubsub.ReceiveTimeout(REDIS_WAIT); err != nil {
				if strings.Contains(err.Error(), "i/o timeout") {
					if len(h.connections) == 0 {
						l4g.Debug("No active connections so sending stop %v", h.teamId)
						return
					}
				} else {
					return
				}
			} else {
				msg := store.GetMessageFromPayload(payload)
				if msg != nil {
					h.broadcast <- msg
				}
			}
		}

	}()

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

					pubsub.Close()
					return
				}
			}
		}
	}()
}
