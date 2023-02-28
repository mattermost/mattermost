// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func (a *App) markAdminOnboardingComplete(c *request.Context) *model.AppError {
	firstAdminCompleteSetupObj := model.System{
		Name:  model.SystemFirstAdminSetupComplete,
		Value: "true",
	}

	if err := a.Srv().Store().System().SaveOrUpdate(&firstAdminCompleteSetupObj); err != nil {
		return model.NewAppError("setFirstAdminCompleteSetup", "api.error_set_first_admin_complete_setup", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) CompleteOnboarding(c *request.Context, request *model.CompleteOnboardingRequest) *model.AppError {
	pluginsEnvironment := a.Channels().GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return a.markAdminOnboardingComplete(c)
	}

	pluginContext := pluginContext(c)

	for _, pluginID := range request.InstallPlugins {

		go func(id string) {
			installRequest := &model.InstallMarketplacePluginRequest{
				Id: id,
			}
			_, appErr := a.Channels().InstallMarketplacePlugin(installRequest)
			if appErr != nil {
				mlog.Error("Failed to install plugin for onboarding", mlog.String("id", id), mlog.Err(appErr))
				return
			}

			appErr = a.EnablePlugin(id)
			if appErr != nil {
				mlog.Error("Failed to enable plugin for onboarding", mlog.String("id", id), mlog.Err(appErr))
				return
			}

			hooks, err := a.ch.HooksForPluginOrProduct(id)
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

	return a.markAdminOnboardingComplete(c)
}

func (a *App) GetOnboarding() (*model.System, *model.AppError) {
	firstAdminCompleteSetupObj, err := a.Srv().Store().System().GetByName(model.SystemFirstAdminSetupComplete)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return &model.System{
				Name:  model.SystemFirstAdminSetupComplete,
				Value: "false",
			}, nil
		default:
			return nil, model.NewAppError("getFirstAdminCompleteSetup", "api.error_get_first_admin_complete_setup", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return firstAdminCompleteSetupObj, nil
}
