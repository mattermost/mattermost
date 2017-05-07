// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"fmt"
	"strings"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
)

const CHANNEL_ARG_SEPARATOR = ":"

func getChannelsFromChannelArgs(channelArgs []string) []*model.Channel {
	channels := make([]*model.Channel, 0, len(channelArgs))
	for _, channelArg := range channelArgs {
		channel := getChannelFromChannelArg(channelArg)
		channels = append(channels, channel)
	}
	return channels
}

func parseChannelArg(channelArg string) (string, string) {
	result := strings.SplitN(channelArg, CHANNEL_ARG_SEPARATOR, 2)
	if len(result) == 1 {
		return "", channelArg
	}
	return result[0], result[1]
}

func getChannelFromChannelArg(channelArg string) *model.Channel {
	teamArg, channelPart := parseChannelArg(channelArg)
	if teamArg == "" && channelPart == "" {
		return nil
	}

	var channel *model.Channel
	if teamArg != "" {
		team := getTeamFromTeamArg(teamArg)
		if team == nil {
			return nil
		}

		if result := <-app.Srv.Store.Channel().GetByNameIncludeDeleted(team.Id, channelPart, true); result.Err == nil {
			channel = result.Data.(*model.Channel)
		} else {
			fmt.Println(result.Err.Error())
		}
	}

	if channel == nil {
		if result := <-app.Srv.Store.Channel().Get(channelPart, true); result.Err == nil {
			channel = result.Data.(*model.Channel)
		}
	}

	return channel
}
