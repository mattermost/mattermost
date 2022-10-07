// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"errors"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type TeamService struct {
	store        store.TeamStore
	groupStore   store.GroupStore
	channelStore store.ChannelStore // TODO: replace this with ChannelService in the future
	users        Users
	wh           WebHub
	config       func() *model.Config
	license      func(request.CTX) *model.License
	ctx          request.CTX
}

// ServiceConfig is used to initialize the TeamService.
type ServiceConfig struct {
	// Mandatory fields
	TeamStore    store.TeamStore
	GroupStore   store.GroupStore
	ChannelStore store.ChannelStore
	Users        Users
	WebHub       WebHub
	ConfigFn     func() *model.Config
	LicenseFn    func(request.CTX) *model.License
	Context      request.CTX
}

// Users is a subset of UserService interface
type Users interface {
	GetUser(userID string) (*model.User, error)
}

// WebHub is used to publish events, the name should be given appropriately
// while developing the websocket or clustering service
type WebHub interface {
	Publish(c request.CTX, message *model.WebSocketEvent)
}

func New(c ServiceConfig) (*TeamService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	return &TeamService{
		store:        c.TeamStore,
		groupStore:   c.GroupStore,
		channelStore: c.ChannelStore,
		users:        c.Users,
		config:       c.ConfigFn,
		license:      c.LicenseFn,
		wh:           c.WebHub,
		ctx:          c.Context,
	}, nil
}

func (c *ServiceConfig) validate() error {
	if c.ConfigFn == nil || c.TeamStore == nil || c.LicenseFn == nil || c.Users == nil || c.ChannelStore == nil || c.GroupStore == nil || c.WebHub == nil {
		return errors.New("required parameters are not provided")
	}

	return nil
}
