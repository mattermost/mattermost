// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

// GetIntegrationsUsage returns usage information on enabled integrations
func (a *App) GetIntegrationsUsage() (*model.IntegrationsUsage, *model.AppError) {
	return a.ch.getIntegrationsUsage()
}

func (ch *Channels) getIntegrationsUsage() (*model.IntegrationsUsage, *model.AppError) {
	installed, appErr := ch.getInstalledIntegrations()
	if appErr != nil {
		return nil, appErr
	}

	var count = 0
	for _, i := range installed {
		if i.Enabled {
			count++
		}
	}

	return &model.IntegrationsUsage{Enabled: count}, nil
}

// GetPostsUsage returns the total posts count rounded down to the most
// significant digit
func (a *App) GetPostsUsage() (int64, *model.AppError) {
	count, err := a.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeDeleted: true, UsersPostsOnly: true, AllowFromCache: true})
	if err != nil {
		return 0, model.NewAppError("GetPostsUsage", "app.post.analytics_posts_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return utils.RoundOffToZeroesResolution(float64(count), 3), nil
}

// GetStorageUsage returns the sum of files' sizes stored on this instance
func (a *App) GetStorageUsage() (int64, *model.AppError) {
	usage, err := a.Srv().Store().FileInfo().GetStorageUsage(true, false)
	if err != nil {
		return 0, model.NewAppError("GetStorageUsage", "app.usage.get_storage_usage.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return usage, nil
}

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
