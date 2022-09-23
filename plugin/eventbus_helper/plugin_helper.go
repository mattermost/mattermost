// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus_helper

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/eventbus"
)

type PluginEventListener struct {
	ReceivedId    string
	EventListener eventbus.Handler
}

var pluginEventListeners map[string]*PluginEventListener

func HandleEvent(handlerId string, event eventbus.Event) {
	pluginEventListeners[handlerId].EventListener(event)
}

func SubscribeToEvent(p plugin.API, topic string, handler eventbus.Handler) (string, error) {
	if pluginEventListeners == nil {
		pluginEventListeners = make(map[string]*PluginEventListener)
	}

	handlerId := model.NewId()
	receivedId, err := p.SubscribeToEvent(topic, handlerId)
	if err != nil {
		return "", err
	}
	pluginEventListeners[handlerId] = &PluginEventListener{
		ReceivedId:    receivedId,
		EventListener: handler,
	}
	return receivedId, err
}
