// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) GetTeamsUsage() (*model.TeamsUsage, *model.AppError) {
	usage := &model.TeamsUsage{}
	includeDeleted := false
	teamCount, err := a.Srv().Store().Team().AnalyticsTeamCount(&model.TeamSearch{IncludeDeleted: &includeDeleted})
	if err != nil {
		return nil, model.NewAppError("GetTeamsUsage", "app.post.analytics_teams_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	usage.Active = teamCount

	allTeams, appErr := a.GetAllTeams()
	if appErr != nil {
		return nil, appErr
	}

	cloudArchivedTeamCount := 0

	for _, team := range allTeams {
		if team.DeleteAt > 0 && team.CloudLimitsArchived {
			cloudArchivedTeamCount += 1
		}
	}

	usage.CloudArchived = int64(cloudArchivedTeamCount)
	return usage, nil
}
