// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
)

const channelArgSeparator = ":"

func getChannelsFromChannelArgs(ctx context.Context, c client.Client, channelArgs []string) []*model.Channel {
	channels := make([]*model.Channel, 0, len(channelArgs))
	for _, channelArg := range channelArgs {
		channel := getChannelFromChannelArg(ctx, c, channelArg)
		channels = append(channels, channel)
	}
	return channels
}

func parseChannelArg(channelArg string) (string, string) {
	result := strings.SplitN(channelArg, channelArgSeparator, 2)
	if len(result) == 1 {
		return "", channelArg
	}
	return result[0], result[1]
}

func getChannelFromChannelArg(ctx context.Context, c client.Client, channelArg string) *model.Channel {
	teamArg, channelPart := parseChannelArg(channelArg)
	if teamArg == "" && channelPart == "" {
		return nil
	}

	if checkDots(channelPart) || checkSlash(channelPart) {
		return nil
	}

	var channel *model.Channel
	if teamArg != "" {
		team := getTeamFromTeamArg(ctx, c, teamArg)
		if team == nil {
			return nil
		}

		channel, _, _ = c.GetChannelByNameIncludeDeleted(ctx, channelPart, team.Id, "")
	}

	if channel == nil {
		channel, _, _ = c.GetChannel(ctx, channelPart)
	}

	return channel
}

// getChannelsFromArgs obtains channels by the `channelArgs` parameter. It can return channels and errors
// at the same time
//
//nolint:golint,unused
func getChannelsFromArgs(ctx context.Context, c client.Client, channelArgs []string) ([]*model.Channel, error) {
	var channels []*model.Channel
	var result *multierror.Error
	for _, channelArg := range channelArgs {
		channel, err := getChannelFromArg(ctx, c, channelArg)
		if err != nil {
			result = multierror.Append(result, err)
			continue
		}
		channels = append(channels, channel)
	}
	return channels, result.ErrorOrNil()
}

//nolint:golint,unused
func getChannelFromArg(ctx context.Context, c client.Client, arg string) (*model.Channel, error) {
	teamArg, channelArg := parseChannelArg(arg)
	if teamArg == "" && channelArg == "" {
		return nil, fmt.Errorf("invalid channel argument %q", arg)
	}
	if checkDots(channelArg) || checkSlash(channelArg) {
		return nil, fmt.Errorf(`invalid channel argument. Cannot contain ".." nor "/"`)
	}
	var channel *model.Channel
	var response *model.Response
	if teamArg != "" {
		team, err := getTeamFromArg(ctx, c, teamArg)
		if err != nil {
			return nil, err
		}
		channel, response, err = c.GetChannelByNameIncludeDeleted(ctx, channelArg, team.Id, "")
		if err != nil {
			err = ExtractErrorFromResponse(response, err)
			var nfErr *NotFoundError
			var badRequestErr *BadRequestError
			if !errors.As(err, &nfErr) && !errors.As(err, &badRequestErr) {
				return nil, err
			}
		}
	}
	if channel != nil {
		return channel, nil
	}
	var err error
	channel, response, err = c.GetChannel(ctx, channelArg)
	if err != nil {
		nErr := ExtractErrorFromResponse(response, err)
		var nfErr *NotFoundError
		var badRequestErr *BadRequestError
		if !errors.As(nErr, &nfErr) && !errors.As(nErr, &badRequestErr) {
			return nil, nErr
		}
	}
	if channel == nil {
		return nil, ErrEntityNotFound{Type: "channel", ID: arg}
	}
	return channel, nil
}
