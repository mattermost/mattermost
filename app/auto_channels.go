// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type AutoChannelCreator struct {
	client             *model.Client4
	team               *model.Team
	Fuzzy              bool
	DisplayNameLen     utils.Range
	DisplayNameCharset string
	NameLen            utils.Range
	NameCharset        string
	ChannelType        string
}

func NewAutoChannelCreator(client *model.Client4, team *model.Team) *AutoChannelCreator {
	return &AutoChannelCreator{
		client:             client,
		team:               team,
		Fuzzy:              false,
		DisplayNameLen:     CHANNEL_DISPLAY_NAME_LEN,
		DisplayNameCharset: utils.ALPHANUMERIC,
		NameLen:            CHANNEL_NAME_LEN,
		NameCharset:        utils.LOWERCASE,
		ChannelType:        CHANNEL_TYPE,
	}
}

func (cfg *AutoChannelCreator) createRandomChannel() (*model.Channel, error) {
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
		Type:        cfg.ChannelType}

	println(cfg.client.GetTeamRoute(cfg.team.Id))
	channel, resp := cfg.client.CreateChannel(channel)
	if resp.Error != nil {
		return nil, resp.Error
	}
	return channel, nil
}

func (cfg *AutoChannelCreator) CreateTestChannels(num utils.Range) ([]*model.Channel, error) {
	numChannels := utils.RandIntFromRange(num)
	channels := make([]*model.Channel, numChannels)

	for i := 0; i < numChannels; i++ {
		var err error
		channels[i], err = cfg.createRandomChannel()
		if err != nil {
			return nil, err
		}
	}

	return channels, nil
}
