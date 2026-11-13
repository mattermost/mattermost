// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) markAdminOnboardingComplete(rctx request.CTX) *model.AppError {
	firstAdminCompleteSetupObj := model.System{
		Name:  model.SystemFirstAdminSetupComplete,
		Value: "true",
	}

	if err := a.Srv().Store().System().SaveOrUpdate(&firstAdminCompleteSetupObj); err != nil {
		return model.NewAppError("setFirstAdminCompleteSetup", "api.error_set_first_admin_complete_setup", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// saveOnboardingSiteURL saves the Site URL sent by the onboarding wizard, unless an admin or an
// environment variable has already set one. Only an invalid URL is an error: a failed save is
// logged, so that onboarding still completes.
func (a *App) saveOnboardingSiteURL(rctx request.CTX, siteURL string) *model.AppError {
	if siteURL == "" {
		return nil
	}

	// Accept only an origin: the server can't switch to a subpath without a restart, and a query,
	// fragment, or user info would break every link built from the Site URL.
	siteURL = strings.TrimSuffix(siteURL, "/")
	u, err := url.ParseRequestURI(siteURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || siteURL != u.Scheme+"://"+u.Host {
		return model.NewAppError("CompleteOnboarding", "api.error_invalid_site_url_provided_for_onboarding", nil, "", http.StatusBadRequest).Wrap(err)
	}

	// The config store re-applies environment overrides on save, so saving would be a no-op.
	if serviceOverrides, ok := a.GetEnvironmentConfig(nil)["ServiceSettings"].(map[string]any); ok {
		if _, overridden := serviceOverrides["SiteURL"]; overridden {
			rctx.Logger().Debug("Site URL is set by an environment variable, ignoring the onboarding value")
			return nil
		}
	}

	cfg := a.Config().Clone()
	// The Site URL is write-restricted, so a restricted system admin can't set it in the System Console either.
	if *cfg.ExperimentalSettings.RestrictSystemAdmin {
		rctx.Logger().Debug("System admins are restricted, ignoring the onboarding Site URL")
		return nil
	}
	if current := *cfg.ServiceSettings.SiteURL; current != "" && current != model.ServiceSettingsDefaultSiteURL {
		rctx.Logger().Debug("Site URL is already set, ignoring the onboarding value", mlog.String("site_url", current))
		return nil
	}

	cfg.ServiceSettings.SiteURL = &siteURL
	if _, _, appErr := a.SaveConfig(cfg, true); appErr != nil {
		rctx.Logger().Warn("Failed to save the Site URL during onboarding", mlog.Err(appErr))
	}

	return nil
}

func (a *App) CompleteOnboarding(rctx request.CTX, request *model.CompleteOnboardingRequest) *model.AppError {
	isCloud := a.Srv().License() != nil && *a.Srv().License().Features.Cloud

	if !isCloud && request.Organization == "" {
		rctx.Logger().Error("No organization name provided for self hosted onboarding")
		return model.NewAppError("CompleteOnboarding", "api.error_no_organization_name_provided_for_self_hosted_onboarding", nil, "", http.StatusBadRequest)
	}

	if appErr := a.saveOnboardingSiteURL(rctx, request.SiteURL); appErr != nil {
		return appErr
	}

	if request.Organization != "" {
		err := a.Srv().Store().System().SaveOrUpdate(&model.System{
			Name:  model.SystemOrganizationName,
			Value: request.Organization,
		})
		if err != nil {
			rctx.Logger().Error("failed to save organization name", mlog.Err(err))
		}
	}

	pluginsEnvironment := a.Channels().GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return a.markAdminOnboardingComplete(rctx)
	}

	pluginContext := pluginContext(rctx)

	for _, pluginID := range request.InstallPlugins {
		go func(id string) {
			installRequest := &model.InstallMarketplacePluginRequest{
				Id: id,
			}
			_, appErr := a.Channels().InstallMarketplacePlugin(installRequest)
			if appErr != nil {
				rctx.Logger().Error("Failed to install plugin for onboarding", mlog.String("id", id), mlog.Err(appErr))
				return
			}

			appErr = a.EnablePlugin(id)
			if appErr != nil {
				rctx.Logger().Error("Failed to enable plugin for onboarding", mlog.String("id", id), mlog.Err(appErr))
				return
			}

			hooks, err := a.ch.HooksForPlugin(id)
			if err != nil {
				rctx.Logger().Warn("Getting hooks for plugin failed", mlog.String("plugin_id", id), mlog.Err(err))
				return
			}

			event := model.OnInstallEvent{
				UserId: rctx.Session().UserId,
			}
			if err = hooks.OnInstall(pluginContext, event); err != nil {
				rctx.Logger().Error("Plugin OnInstall hook failed", mlog.String("plugin_id", id), mlog.Err(err))
			}
		}(pluginID)
	}

	return a.markAdminOnboardingComplete(rctx)
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
