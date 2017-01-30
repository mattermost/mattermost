// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package google

import "github.com/mattermost/rsc/xmpp"

type ChatID struct {
	ID        string
	Email     string
	Status    xmpp.Status
	StatusMsg string
}

type ChatSend struct {
	ID  *ChatID
	Msg xmpp.Chat
}

func (g *Client) ChatRecv(cid *ChatID) (*xmpp.Chat, error) {
	var msg xmpp.Chat
	if err := g.client.Call("goog.ChatRecv", cid, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

func (g *Client) ChatStatus(cid *ChatID) error {
	return g.client.Call("goog.ChatRecv", cid, &Empty{})
}

func (g *Client) ChatSend(cid *ChatID, msg *xmpp.Chat) error {
	return g.client.Call("goog.ChatSend", &ChatSend{cid, *msg}, &Empty{})
}

func (g *Client) ChatRoster(cid *ChatID) error {
	return g.client.Call("goog.ChatRoster", cid, &Empty{})
}
