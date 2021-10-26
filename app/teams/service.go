// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"encoding/json"
	"errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

type TeamService struct {
	store        store.TeamStore
	groupStore   store.GroupStore
	channelStore store.ChannelStore // TODO: replace this with ChannelService in the future
	schemeStore  store.SchemeStore
	roleStore    store.RoleStore
	users        Users
	wh           WebHub
	config       func() *model.Config
	license      func() *model.License
}

// ServiceConfig is used to initialize the TeamService.
type ServiceConfig struct {
	// Mandatory fields
	TeamStore    store.TeamStore
	GroupStore   store.GroupStore
	ChannelStore store.ChannelStore
	SchemeStore  store.SchemeStore
	RoleStore    store.RoleStore
	Users        Users
	WebHub       WebHub
	ConfigFn     func() *model.Config
	LicenseFn    func() *model.License
}

// Users is a subset of UserService interface
type Users interface {
	GetUser(userID string) (*model.User, error)
}

// WebHub is used to publish events, the name should be given appropriately
// while developing the websocket or clustering service
type WebHub interface {
	Publish(message *model.WebSocketEvent)
}

func New(c ServiceConfig) (*TeamService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	return &TeamService{
		store:        c.TeamStore,
		groupStore:   c.GroupStore,
		channelStore: c.ChannelStore,
		schemeStore:  c.SchemeStore,
		roleStore:    c.RoleStore,
		users:        c.Users,
		config:       c.ConfigFn,
		license:      c.LicenseFn,
		wh:           c.WebHub,
	}, nil
}

func (c *ServiceConfig) validate() error {
	if c.ConfigFn == nil || c.TeamStore == nil || c.SchemeStore == nil || c.RoleStore == nil || c.LicenseFn == nil || c.Users == nil || c.ChannelStore == nil || c.GroupStore == nil || c.WebHub == nil {
		return errors.New("required parameters are not provided")
	}

	return nil
}

func (s *TeamService) sendEvent(team *model.Team, event string) {
	sanitizedTeam := &model.Team{}
	*sanitizedTeam = *team
	sanitizedTeam.Sanitize()

	teamID := "" // no filtering by teamID by default
	if event == model.WebsocketEventUpdateTeam {
		// in case of update_team event - we send the message only to members of that team
		teamID = team.Id
	}
	message := model.NewWebSocketEvent(event, teamID, "", "", nil)
	teamJSON, jsonErr := json.Marshal(team)
	if jsonErr != nil {
		mlog.Warn("Failed to encode team to JSON", mlog.Err(jsonErr))
	}
	message.Add("team", string(teamJSON))
	s.wh.Publish(message)
}
