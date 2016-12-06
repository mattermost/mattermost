// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/model"
)

func getTeamsFromTeamArgs(teamArgs []string) []*model.Team {
	teams := make([]*model.Team, 0, len(teamArgs))
	for _, teamArg := range teamArgs {
		team := getTeamFromTeamArg(teamArg)
		teams = append(teams, team)
	}
	return teams
}

func getTeamFromTeamArg(teamArg string) *model.Team {
	var team *model.Team
	if result := <-api.Srv.Store.Team().GetByName(teamArg); result.Err == nil {
		team = result.Data.(*model.Team)
	}

	if team == nil {
		if result := <-api.Srv.Store.Team().Get(teamArg); result.Err == nil {
			team = result.Data.(*model.Team)
		}
	}

	return team
}
