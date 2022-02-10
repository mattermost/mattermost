// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sync"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) CompleteOnboarding(c *request.Context, request *model.CompleteOnboardingRequest) *model.AppError {
	pluginsEnvironment := a.Channels().GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("CompleteOnboarding", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	pluginContext := pluginContext(c)

	var wg sync.WaitGroup
	for _, pluginID := range request.InstallPlugins {
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

			hooks, err := pluginsEnvironment.HooksForPlugin(id)
			if err != nil {
				mlog.Warn("Getting hooks for plugin failed", mlog.String("plugin_id", id), mlog.Err(err))
				return
			}

			event := model.OnInstallEvent{
				UserId: c.Session().UserId,
			}
			if err = hooks.OnInstall(pluginContext, event); err != nil {
				mlog.Error("Plugin OnInstall hook failed", mlog.String("plugin_id", id), mlog.Err(err))
			}
		}(pluginID)
	}

	wg.Wait()

	return nil
}
