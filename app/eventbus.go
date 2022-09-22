// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/shared/eventbus"
)

type Broker interface {
	Publisher
	Subscriber
	Register
	Start()
}

type Register interface {
	Register(topic, description string, typ any) error
	EventTypes() []eventbus.EventType
}

type Publisher interface {
	Publish(topic string, ctx request.CTX, data any) error
}

type Subscriber interface {
	Subscribe(topic string, handler eventbus.Handler) (string, error)
	Unsubscribe(topic, id string) error
}

func (a *App) EventBroker() Broker {
	return a.Srv().bus
}

func (a *App) PublishEvent(topic string, ctx request.CTX, data interface{}) error {
	return a.Srv().bus.Publish(topic, ctx, data)
}

func (a *App) SubscribeTopic(topic string, handler eventbus.Handler) (string, error) {
	return a.Srv().bus.Subscribe(topic, handler)
}

func (a *App) UnsubscribeTopic(topic, id string) error {
	return a.Srv().bus.Unsubscribe(topic, id)
}
