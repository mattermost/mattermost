// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
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
	team, err := a.Srv.Store.Team().GetByName(teamArg)

	if err != nil {
		var t *model.Team
		if t, err = a.Srv.Store.Team().Get(teamArg); err == nil {
			team = t
		}
	}
	return team
}
