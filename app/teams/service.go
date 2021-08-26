// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type TeamService struct {
	store        store.TeamStore
	groupStore   store.GroupStore
	channelStore store.ChannelStore // TODO: replace this with ChannelService in the future
	users        Users
	config       func() *model.Config
	license      func() *model.License
}

// ServiceConfig is used to initialize the TeamService.
type ServiceConfig struct {
	// Mandatory fields
	TeamStore    store.TeamStore
	GroupStore   store.GroupStore
	ChannelStore store.ChannelStore
	Users        Users
	ConfigFn     func() *model.Config
	LicenseFn    func() *model.License
}

// Users is a subset of UserService interface
type Users interface {
	GetUser(userID string) (*model.User, error)
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
	}, nil
}

func (c *ServiceConfig) validate() error {
	if c.ConfigFn == nil || c.TeamStore == nil || c.LicenseFn == nil || c.Users == nil || c.ChannelStore == nil || c.GroupStore == nil {
		return errors.New("required parameters are not provided")
	}

	return nil
}
