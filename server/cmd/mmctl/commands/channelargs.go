// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"net/http"
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

// channelInOtherTeam reports whether channel belongs to a team other than teamID. A channel with no team
// (for example a DM or GM) is not in another team, so it is not rejected for a team prefix.
func channelInOtherTeam(channel *model.Channel, teamID string) bool {
	return channel.TeamId != "" && channel.TeamId != teamID
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
			channel, _, _ = getChannelByIDArg(c, channelPart)
			if channel != nil && channelInOtherTeam(channel, team.Id) {
				channel = nil
			}
		}

		if channel == nil {
			channel, _, _ = c.GetChannelByNameIncludeDeleted(context.TODO(), channelPart, team.Id, "")
		}

		if channel != nil || model.IsValidId(channelPart) {
			return channel
		}
	}

	if channel == nil {
		if model.IsValidId(channelPart) {
			channel, _, _ = getChannelByIDArg(c, channelPart)
		} else {
			channel, _, _ = c.GetChannel(context.TODO(), channelPart)
		}
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
	var team *model.Team
	var crossTeamID bool
	var forbiddenErr error
	if teamArg != "" {
		var err error
		team, err = getTeamFromArg(c, teamArg)
		if err != nil {
			return nil, err
		}
		if model.IsValidId(channelArg) {
			channel, response, err = getChannelByIDArg(c, channelArg)
			if err != nil {
				// A forbidden ID may still be a visible channel name in the team, so keep the error for the fallback below.
				if response == nil || response.StatusCode != http.StatusForbidden {
					return nil, err
				}
				forbiddenErr = err
			}
			if channel != nil && channelInOtherTeam(channel, team.Id) {
				crossTeamID = true
				channel = nil
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
			if channel == nil && crossTeamID {
				return nil, fmt.Errorf("channel does not belong to team %q", teamArg)
			}
			if channel == nil && forbiddenErr != nil {
				return nil, forbiddenErr
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
	if model.IsValidId(channelArg) {
		channel, response, err = getChannelByIDArg(c, channelArg)
	} else {
		channel, response, err = c.GetChannel(context.TODO(), channelArg)
	}
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

// getChannelByIDArg tries to fetch a channel by ID, first with the exact case,
// then with the lowercase form if different. This mirrors getUserByIDArg's behavior.
func getChannelByIDArg(c client.Client, channelArg string) (*model.Channel, *model.Response, error) {
	candidates := []string{channelArg}
	if lower := strings.ToLower(channelArg); lower != channelArg {
		candidates = append(candidates, lower)
	}

	var response *model.Response
	for _, id := range candidates {
		var channel *model.Channel
		var err error
		channel, response, err = c.GetChannel(context.TODO(), id)
		if err == nil && channel != nil {
			return channel, response, nil
		}
		if err != nil {
			nErr := ExtractErrorFromResponse(response, err)
			var nfErr *NotFoundError
			var badRequestErr *BadRequestError
			if !errors.As(nErr, &nfErr) && !errors.As(nErr, &badRequestErr) {
				return nil, response, nErr
			}
		}
	}
	return nil, response, nil
}
