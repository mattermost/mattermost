// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/eventbus"
)

type PluginEventListener struct {
	ReceivedId    string
	EventListener eventbus.Handler
}

var pluginEventListeners map[string]*PluginEventListener

func InitializePluginHelper() {
	pluginEventListeners = make(map[string]*PluginEventListener)

	// TODO: Receive from hooks and do call the handler the good
}

func SubscribeToEvent(p *PluginAPI, topic string, handler eventbus.Handler) (string, error) {
	handlerId := model.NewId()
	receivedId, err := p.API.SubscribeToEvent(topic, handlerId)
	if err != nil {
		return "", err
	}
	pluginEventListeners[handlerId] = &PluginEventListener{
		ReceivedId:    receivedId,
		EventListener: handler,
	}
	return receivedId, err
}
