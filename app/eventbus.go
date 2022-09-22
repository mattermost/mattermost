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
