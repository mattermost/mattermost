// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
)

func getTeamsFromTeamArgs(a *app.App, teamArgs []string) []*model.Team {
	teams := make([]*model.Team, 0, len(teamArgs))
	for _, teamArg := range teamArgs {
		team := getTeamFromTeamArg(a, teamArg)
		teams = append(teams, team)
	}
	return teams
}

func getTeamFromTeamArg(a *app.App, teamArg string) *model.Team {
	var team *model.Team
	if result := <-a.Srv.Store.Team().GetByName(teamArg); result.Err == nil {
		team = result.Data.(*model.Team)
	}

	if team == nil {
		if result := <-a.Srv.Store.Team().Get(teamArg); result.Err == nil {
			team = result.Data.(*model.Team)
		}
	}

	return team
}
