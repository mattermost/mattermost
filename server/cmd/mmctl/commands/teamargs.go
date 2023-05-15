// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"errors"
	"fmt"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost-server/server/public/model"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
)

func getTeamsFromTeamArgs(c client.Client, teamArgs []string) []*model.Team {
	teams := make([]*model.Team, 0, len(teamArgs))
	for _, teamArg := range teamArgs {
		team := getTeamFromTeamArg(c, teamArg)
		teams = append(teams, team)
	}
	return teams
}

func getTeamFromTeamArg(c client.Client, teamArg string) *model.Team {
	if checkDots(teamArg) || checkSlash(teamArg) {
		return nil
	}

	var team *model.Team
	team, _, _ = c.GetTeam(teamArg, "")

	if team == nil {
		team, _, _ = c.GetTeamByName(teamArg, "")
	}
	return team
}

// getTeamsFromArgs obtains teams given `teamArgs` parameter. It can return
// teams and errors at the same time
//
//nolint:golint,unused
func getTeamsFromArgs(c client.Client, teamArgs []string) ([]*model.Team, error) {
	var teams []*model.Team
	var result *multierror.Error
	for _, arg := range teamArgs {
		team, err := getTeamFromArg(c, arg)
		if err != nil {
			result = multierror.Append(result, err)
			continue
		}
		teams = append(teams, team)
	}
	return teams, result.ErrorOrNil()
}

//nolint:golint,unused
func getTeamFromArg(c client.Client, teamArg string) (*model.Team, error) {
	if checkDots(teamArg) || checkSlash(teamArg) {
		return nil, fmt.Errorf("invalid argument %q", teamArg)
	}
	var team *model.Team
	var response *model.Response
	var err error
	team, response, err = c.GetTeam(teamArg, "")
	if err != nil {
		nErr := ExtractErrorFromResponse(response, err)
		var nfErr *NotFoundError
		var badRequestErr *BadRequestError
		if !errors.As(nErr, &nfErr) && !errors.As(nErr, &badRequestErr) {
			return nil, nErr
		}
	}
	if team != nil {
		return team, nil
	}
	team, response, err = c.GetTeamByName(teamArg, "")
	if err != nil {
		nErr := ExtractErrorFromResponse(response, err)
		var nfErr *NotFoundError
		var badRequestErr *BadRequestError
		if !errors.As(nErr, &nfErr) && !errors.As(nErr, &badRequestErr) {
			return nil, nErr
		}
	}
	if team == nil {
		return nil, ErrEntityNotFound{Type: "team", ID: teamArg}
	}
	return team, nil
}
