// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// TODO: Add ChatHangup.
// TODO: Auto-hangup chats that are gone.

package main

import (
	"fmt"

	"github.com/mattermost/rsc/google"
	"github.com/mattermost/rsc/xmpp"
)

type chatClient struct {
	email string
	id    string
	xmpp  *xmpp.Client
}

var chatClients = map[string]*chatClient{}

func (*Server) chatClient(cid *google.ChatID) (*chatClient, error) {
	id := cid.ID
	cc := chatClients[cid.ID]
	if cc == nil {
		a := google.Cfg.AccountByEmail(cid.Email)
		if a == nil {
			return nil, fmt.Errorf("unknown account %s", cid.Email)
		}
		// New client.
		cli, err := xmpp.NewClient("talk.google.com:443", a.Email, a.Password)
		if err != nil {
			return nil, err
		}
		cc = &chatClient{email: a.Email, id: id, xmpp: cli}
		cc.xmpp.Status(cid.Status, cid.StatusMsg)
		chatClients[id] = cc
	}
	return cc, nil
}

func (srv *Server) ChatRecv(cid *google.ChatID, msg *xmpp.Chat) error {
	cc, err := srv.chatClient(cid)
	if err != nil {
		return err
	}
	chat, err := cc.xmpp.Recv()
	if err != nil {
		return err
	}
	*msg = chat
	return nil
}

func (srv *Server) ChatStatus(cid *google.ChatID, _ *Empty) error {
	cc, err := srv.chatClient(cid)
	if err != nil {
		return err
	}
	return cc.xmpp.Status(cid.Status, cid.StatusMsg)
}

func (srv *Server) ChatSend(arg *google.ChatSend, _ *Empty) error {
	cc, err := srv.chatClient(arg.ID)
	if err != nil {
		return err
	}
	return cc.xmpp.Send(arg.Msg)
}

func (srv *Server) ChatRoster(cid *google.ChatID, _ *Empty) error {
	cc, err := srv.chatClient(cid)
	if err != nil {
		return err
	}
	return cc.xmpp.Roster()
}
