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

func getChannelsFromChannelArgs(c client.Client, channelArgs []string) []*model.Channel {
	channels := make([]*model.Channel, 0, len(channelArgs))
	for _, channelArg := range channelArgs {
		channel := getChannelFromChannelArg(c, channelArg)
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

func getChannelFromChannelArg(c client.Client, channelArg string) *model.Channel {
	teamArg, channelPart := parseChannelArg(channelArg)
	if teamArg == "" && channelPart == "" {
		return nil
	}

	if checkDots(channelPart) || checkSlash(channelPart) {
		return nil
	}

	var channel *model.Channel
	if teamArg != "" {
		team := getTeamFromTeamArg(c, teamArg)
		if team == nil {
			return nil
		}

		if model.IsValidId(channelPart) {
			channel, _, _ = c.GetChannel(context.TODO(), strings.ToLower(channelPart))
		}

		if channel == nil {
			channel, _, _ = c.GetChannelByNameIncludeDeleted(context.TODO(), channelPart, team.Id, "")
		}

		if channel != nil || model.IsValidId(channelPart) {
			return channel
		}
	}

	if channel == nil {
		lookup := channelPart
		if model.IsValidId(channelPart) {
			lookup = strings.ToLower(channelPart)
		}
		channel, _, _ = c.GetChannel(context.TODO(), lookup)
	}

	return channel
}

// getChannelsFromArgs obtains channels by the `channelArgs` parameter. It can return channels and errors
// at the same time
//
//nolint:golint,unused
func getChannelsFromArgs(c client.Client, channelArgs []string) ([]*model.Channel, error) {
	var channels []*model.Channel
	var result *multierror.Error
	for _, channelArg := range channelArgs {
		channel, err := getChannelFromArg(c, channelArg)
		if err != nil {
			result = multierror.Append(result, err)
			continue
		}
		channels = append(channels, channel)
	}
	return channels, result.ErrorOrNil()
}

//nolint:golint,unused
func getChannelFromArg(c client.Client, arg string) (*model.Channel, error) {
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
		team, err := getTeamFromArg(c, teamArg)
		if err != nil {
			return nil, err
		}
		if model.IsValidId(channelArg) {
			channel, response, err = c.GetChannel(context.TODO(), strings.ToLower(channelArg))
			if err != nil {
				// Same as getTeamFromArg: only not-found and bad-request continue to the next lookup.
				nErr := ExtractErrorFromResponse(response, err)
				var nfErr *NotFoundError
				var badRequestErr *BadRequestError
				if !errors.As(nErr, &nfErr) && !errors.As(nErr, &badRequestErr) {
					return nil, nErr
				}
			}
		}
		if channel == nil {
			channel, response, err = c.GetChannelByNameIncludeDeleted(context.TODO(), channelArg, team.Id, "")
			if err != nil {
				err = ExtractErrorFromResponse(response, err)
				var nfErr *NotFoundError
				var badRequestErr *BadRequestError
				if !errors.As(err, &nfErr) && !errors.As(err, &badRequestErr) {
					return nil, err
				}
			}
		}
	}
	if channel != nil {
		return channel, nil
	}
	if teamArg != "" && model.IsValidId(channelArg) {
		return nil, ErrEntityNotFound{Type: "channel", ID: arg}
	}
	var err error
	lookup := channelArg
	if model.IsValidId(channelArg) {
		lookup = strings.ToLower(channelArg)
	}
	channel, response, err = c.GetChannel(context.TODO(), lookup)
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
