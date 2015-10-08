// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
)

type Hub struct {
	teamHubs   map[string]*TeamHub
	register   chan *WebConn
	unregister chan *WebConn
	broadcast  chan *model.Message
	stop       chan string
}

var hub = &Hub{
	register:   make(chan *WebConn),
	unregister: make(chan *WebConn),
	teamHubs:   make(map[string]*TeamHub),
	broadcast:  make(chan *model.Message),
	stop:       make(chan string),
}

func PublishAndForget(message *model.Message) {
	go func() {
		hub.Broadcast(message)
	}()
}

func UpdateChannelAccessCache(teamId, userId, channelId string) {
	if nh, ok := hub.teamHubs[teamId]; ok {
		nh.UpdateChannelAccessCache(userId, channelId)
	}
}

func UpdateChannelAccessCacheAndForget(teamId, userId, channelId string) {
	go func() {
		UpdateChannelAccessCache(teamId, userId, channelId)
	}()
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

			case c := <-h.register:
				nh := h.teamHubs[c.TeamId]

				if nh == nil {
					nh = NewTeamHub(c.TeamId)
					h.teamHubs[c.TeamId] = nh
					nh.Start()
				}

				nh.Register(c)

			case c := <-h.unregister:
				if nh, ok := h.teamHubs[c.TeamId]; ok {
					nh.Unregister(c)
				}
			case msg := <-h.broadcast:
				nh := h.teamHubs[msg.TeamId]
				if nh != nil {
					nh.broadcast <- msg
				}
			case s := <-h.stop:
				l4g.Debug("stopping %v connections", s)
				for _, v := range h.teamHubs {
					v.Stop()
				}
				return
			}
		}
	}()
}
