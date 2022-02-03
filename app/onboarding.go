// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sync"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) CompleteOnboarding(request *model.CompleteOnboardingRequest) *model.AppError {
	var wg sync.WaitGroup

	if !*a.Config().PluginSettings.Enable {
		return model.NewAppError("completeOnboarding", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	for _, id := range request.InstallPlugins {
		wg.Add(1)

		go func(id string) {
			defer wg.Done()
			installRequest := &model.InstallMarketplacePluginRequest{
				Id: id,
			}
			_, appErr := a.Channels().InstallMarketplacePlugin(installRequest)
			if appErr != nil {
				mlog.Error("Failed to install plugin for onboarding", mlog.String("id", id), mlog.Err(appErr))
				return
			}

			appErr = a.Channels().enablePlugin(id)
			if appErr != nil {
				mlog.Error("Failed to enable plugin for onboarding", mlog.String("id", id), mlog.Err(appErr))
				return
			}
		}(id)
	}

	wg.Wait()

	return nil
}
