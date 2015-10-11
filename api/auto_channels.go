// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type AutoChannelCreator struct {
	client             *model.Client
	teamID             string
	Fuzzy              bool
	DisplayNameLen     utils.Range
	DisplayNameCharset string
	NameLen            utils.Range
	NameCharset        string
	ChannelType        string
}

func NewAutoChannelCreator(client *model.Client, teamID string) *AutoChannelCreator {
	return &AutoChannelCreator{
		client:             client,
		teamID:             teamID,
		Fuzzy:              false,
		DisplayNameLen:     CHANNEL_DISPLAY_NAME_LEN,
		DisplayNameCharset: utils.ALPHANUMERIC,
		NameLen:            CHANNEL_NAME_LEN,
		NameCharset:        utils.LOWERCASE,
		ChannelType:        CHANNEL_TYPE,
	}
}

func (cfg *AutoChannelCreator) createRandomChannel() (*model.Channel, bool) {
	var displayName string
	if cfg.Fuzzy {
		displayName = utils.FuzzName()
	} else {
		displayName = utils.RandomName(cfg.NameLen, cfg.NameCharset)
	}
	name := utils.RandomName(cfg.NameLen, cfg.NameCharset)

	channel := &model.Channel{
		TeamId:      cfg.teamID,
		DisplayName: displayName,
		Name:        name,
		Type:        cfg.ChannelType}

	result, err := cfg.client.CreateChannel(channel)
	if err != nil {
		return nil, false
	}
	return result.Data.(*model.Channel), true
}

func (cfg *AutoChannelCreator) CreateTestChannels(num utils.Range) ([]*model.Channel, bool) {
	numChannels := utils.RandIntFromRange(num)
	channels := make([]*model.Channel, numChannels)

	for i := 0; i < numChannels; i++ {
		var err bool
		channels[i], err = cfg.createRandomChannel()
		if err != true {
			return channels, false
		}
	}

	return channels, true
}
