// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

// CheckFreemiumLimitsForConfigSave returns an error if the configuration being saved violates the Cloud Freemium limits
func (a *App) CheckFreemiumLimitsForConfigSave(oldConfig, newConfig *model.Config) *model.AppError {
	if !a.Config().FeatureFlags.CloudFree {
		return nil
	}

	appErr := a.checkIntegrationLimitsForConfigSave(oldConfig, newConfig)
	if appErr != nil {
		return appErr
	}

	return nil
}

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

// GetPostsUsage returns "rounded off" total posts count like returns 900 instead of 987
func (a *App) GetPostsUsage() (int64, *model.AppError) {
	count, err := a.Srv().Store.Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeDeleted: true})
	if err != nil {
		return 0, model.NewAppError("GetPostsUsage", "app.post.analytics_posts_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return utils.RoundOffToZeroes(float64(count)), nil
}
