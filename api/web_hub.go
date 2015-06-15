// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
)

type Hub struct {
	teamHubs   map[string]*TeamHub
	register   chan *WebConn
	unregister chan *WebConn
	stop       chan string
}

var hub = &Hub{
	register:   make(chan *WebConn),
	unregister: make(chan *WebConn),
	teamHubs:   make(map[string]*TeamHub),
	stop:       make(chan string),
}

func (h *Hub) Register(webConn *WebConn) {
	h.register <- webConn
}

func (h *Hub) Unregister(webConn *WebConn) {
	h.unregister <- webConn
}

func (h *Hub) Stop(teamId string) {
	h.stop <- teamId
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

			case s := <-h.stop:
				if len(s) == 0 {
					l4g.Debug("stopping all connections")
					for _, v := range h.teamHubs {
						v.Stop()
					}
					return
				} else if nh, ok := h.teamHubs[s]; ok {
					delete(h.teamHubs, s)
					nh.Stop()
				}
			}
		}
	}()
}
