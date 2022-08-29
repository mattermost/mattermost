// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

type AutoChannelCreator struct {
	a                  *app.App
	userID             string
	team               *model.Team
	Fuzzy              bool
	DisplayNameLen     utils.Range
	DisplayNameCharset string
	NameLen            utils.Range
	NameCharset        string
	ChannelType        model.ChannelType
}

func NewAutoChannelCreator(a *app.App, team *model.Team, userID string) *AutoChannelCreator {
	return &AutoChannelCreator{
		a:                  a,
		team:               team,
		userID:             userID,
		Fuzzy:              false,
		DisplayNameLen:     ChannelDisplayNameLen,
		DisplayNameCharset: utils.ALPHANUMERIC,
		NameLen:            ChannelNameLen,
		NameCharset:        utils.LOWERCASE,
		ChannelType:        ChannelType,
	}
}

func (cfg *AutoChannelCreator) createRandomChannel(c request.CTX) (*model.Channel, error) {
	var displayName string
	if cfg.Fuzzy {
		displayName = utils.FuzzName()
	} else {
		displayName = utils.RandomName(cfg.NameLen, cfg.NameCharset)
	}
	name := utils.RandomName(cfg.NameLen, cfg.NameCharset)

	channel := &model.Channel{
		TeamId:      cfg.team.Id,
		DisplayName: displayName,
		Name:        name,
		Type:        cfg.ChannelType,
		CreatorId:   cfg.userID,
	}

	channel, err := cfg.a.CreateChannel(c, channel, true)
	if err != nil {
		return nil, err
	}
	return channel, nil
}

func (cfg *AutoChannelCreator) CreateTestChannels(c request.CTX, num utils.Range) ([]*model.Channel, error) {
	numChannels := utils.RandIntFromRange(num)
	channels := make([]*model.Channel, numChannels)

	for i := 0; i < numChannels; i++ {
		var err error
		channels[i], err = cfg.createRandomChannel(c)
		if err != nil {
			return nil, err
		}
	}

	return channels, nil
}

func (cfg *AutoChannelCreator) CreateTestDMs(c request.CTX, num utils.Range) ([]*model.Channel, error) {
	numDMs := utils.RandIntFromRange(num)
	dms := make([]*model.Channel, numDMs)

	users, err := cfg.a.GetUsersFromProfiles(&model.UserGetOptions{Page: 0, PerPage: numDMs})
	if err != nil {
		return nil, err
	}

	for i, user := range users {
		var err *model.AppError
		dms[i], err = cfg.a.GetOrCreateDirectChannel(c, cfg.userID, user.Id)
		if err != nil {
			return nil, err
		}
	}

	return dms, nil
}
