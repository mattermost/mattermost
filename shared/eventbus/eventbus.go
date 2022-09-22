// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus

import (
	"github.com/mattermost/mattermost-server/v6/app/request"
)

type Event struct {
	Context request.CTX // request information
	Topic   string      // topic name
	Message any         // actual event data
}

type Handler func(ev Event) error

type EventType struct {
	Topic       string `json:"topic"`
	Description string `json:"description"`
	Schema      string `json:"schema,omitempty"`
}

type BrokerService struct {
	QueueLimit     int
	GoroutineLimit int
}

func NewBroker(queueLimit, goroutineLimit int) *BrokerService {
	return &BrokerService{
		QueueLimit:     queueLimit,
		GoroutineLimit: goroutineLimit,
	}
}

func (b *BrokerService) Register(topic, description string, typ any) error {
	return nil
}
func (b *BrokerService) EventTypes() ([]EventType, error) {
	return nil, nil
}

func (b *BrokerService) Publish(topic string, ctx request.CTX, data any) error {
	return nil
}
func (b *BrokerService) Subscribe(topic string, handler Handler) (string, error) {
	return "", nil
}
func (b *BrokerService) Unsubscribe(topic, id string) error {
	return nil
}
func (b *BrokerService) Start() error {
	return nil
}
