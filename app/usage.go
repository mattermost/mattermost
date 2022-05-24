// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

// GetPostsUsage returns "rounded off" total posts count like returns 900 instead of 987
func (a *App) GetPostsUsage() (int64, *model.AppError) {
	count, err := a.Srv().Store.Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeDeleted: true})
	if err != nil {
		return 0, model.NewAppError("GetPostsUsage", "app.post.analytics_posts_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return utils.RoundOffToZeroes(float64(count)), nil
}

func (a *App) GetTeamsUsage() (int64, *model.AppError) {
	includeDeleted := false
	teamCount, err := a.Srv().Store.Team().AnalyticsTeamCount(&model.TeamSearch{IncludeDeleted: &(includeDeleted)})
	if err != nil {
		return 0, model.NewAppError("GetTeamsUsage", "app.post.analytics_teams_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return teamCount, nil
}
