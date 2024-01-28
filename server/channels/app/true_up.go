// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/services/telemetry"
)

func pluginActivated(pluginStates map[string]*model.PluginState, pluginId string) bool {
	state, ok := pluginStates[pluginId]
	if !ok {
		return false
	}
	return state.Enable
}

func (a *App) getMarketplacePlugins() ([]string, error) {
	ts := a.Srv().telemetryService
	config := a.Srv().Config()

	marketplacePlugins, err := ts.GetAllMarketplacePlugins(model.PluginSettingsDefaultMarketplaceURL)
	if err != nil {
		return nil, err
	}

	activePlugins := []string{}
	for _, p := range marketplacePlugins {
		id := p.Manifest.Id
		if pluginActivated(config.PluginSettings.PluginStates, id) {
			activePlugins = append(activePlugins, id)
		}
	}

	return activePlugins, nil
}

func (a *App) getTrueUpProfile() (*model.TrueUpReviewProfile, error) {
	license := a.Channels().License()
	if license == nil {
		return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.license_required", nil, "Could not get the total active users count", http.StatusInternalServerError)
	}

	// Customer Info & Usage Analytics

	// active registered users
	activatedUsers, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.user_count_fail", nil, "Could not get the total activated users count", http.StatusInternalServerError).Wrap(err)
	}

	// daily active users
	dau, err := a.Srv().Store().User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	if err != nil {
		return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.user_count_fail", nil, "Could not get the total daily active users count", http.StatusInternalServerError)
	}

	// monthly active users
	mau, err := a.Srv().Store().User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	if err != nil {
		return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.user_count_fail", nil, "Could not get the total monthly active users count", http.StatusInternalServerError).Wrap(err)
	}

	// Webhook, calls, boards, and playbook counts
	incomingWebhookCount, err := a.Srv().Store().Webhook().AnalyticsIncomingCount("")
	if err != nil {
		return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.webhook_in_count_fail", nil, "Could not get the total incoming webhook count", http.StatusInternalServerError)
	}
	outgoingWebhookCount, err := a.Srv().Store().Webhook().AnalyticsOutgoingCount("")
	if err != nil {
		return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.webhook_out_count_fail", nil, "Could not get the total outgoing webhook count", http.StatusInternalServerError)
	}

	// Plugin Data
	trueUpReviewPlugins := model.TrueUpReviewPlugins{
		PluginNames: []string{},
	}

	if plugins, err := a.getMarketplacePlugins(); err == nil {
		trueUpReviewPlugins.PluginNames = plugins
		trueUpReviewPlugins.TotalPlugins = len(plugins)
	}

	// Authentication Features
	config := a.Config()
	mfaUsed := config.ServiceSettings.EnforceMultifactorAuthentication
	ldapUsed := config.LdapSettings.Enable
	samlUsed := config.SamlSettings.Enable
	openIdUsed := config.OpenIdSettings.Enable
	guestAccessAllowed := config.GuestAccountsSettings.Enable

	authFeatures := map[string]*bool{
		model.TrueUpReviewAuthFeaturesMfa:        mfaUsed,
		model.TrueUpReviewAuthFeaturesADLdap:     ldapUsed,
		model.TrueUpReviewAuthFeaturesSaml:       samlUsed,
		model.TrueUpReviewAuthFeatureOpenId:      openIdUsed,
		model.TrueUpReviewAuthFeatureGuestAccess: guestAccessAllowed,
	}

	authFeatureList := []string{}
	for feature, used := range authFeatures {
		if used != nil && *used {
			authFeatureList = append(authFeatureList, feature)
		}
	}

	reviewProfile := model.TrueUpReviewProfile{
		ServerId:               a.TelemetryId(),
		ServerVersion:          model.CurrentVersion,
		ServerInstallationType: os.Getenv(telemetry.EnvVarInstallType),
		LicenseId:              license.Id,
		LicensedSeats:          *license.Features.Users,
		LicensePlan:            license.SkuName,
		CustomerName:           license.Customer.Name,
		ActivatedUsers:         activatedUsers,
		DailyActiveUsers:       dau,
		MonthlyActiveUsers:     mau,
		TotalIncomingWebhooks:  incomingWebhookCount,
		TotalOutgoingWebhooks:  outgoingWebhookCount,
		Plugins:                trueUpReviewPlugins,
		AuthenticationFeatures: authFeatureList,
	}

	return &reviewProfile, nil
}

func (a *App) GetTrueUpProfile() (map[string]any, error) {
	profile, err := a.getTrueUpProfile()

	if err != nil {
		return nil, err
	}

	profileJson, err := json.Marshal(profile)
	if err != nil {
		return nil, err
	}
	telemetryProperties := map[string]any{}

	json.Unmarshal(profileJson, &telemetryProperties)
	delete(telemetryProperties, "plugins")
	plugins := profile.Plugins.ToMap()
	for key, pluginValue := range plugins {
		telemetryProperties[key] = pluginValue
	}

	delete(telemetryProperties, "authentication_features")
	telemetryProperties["authentication_features"] = strings.Join(profile.AuthenticationFeatures, ",")

	return telemetryProperties, nil
}

func (a *App) GetOrCreateTrueUpReviewStatus() (*model.TrueUpReviewStatus, *model.AppError) {
	nextDueDate := utils.GetNextTrueUpReviewDueDate(time.Now())
	status, err := a.Srv().Store().TrueUpReview().GetTrueUpReviewStatus(nextDueDate.UnixMilli())
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			a.Log().Warn("Could not find true up review status")
		default:
			return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.get_status_error", nil, "Could not get true up status records", http.StatusInternalServerError).Wrap(err)
		}

		status, err = a.Srv().Store().TrueUpReview().CreateTrueUpReviewStatusRecord(&model.TrueUpReviewStatus{DueDate: nextDueDate.UnixMilli(), Completed: false})
		if err != nil {
			return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.create_error", nil, "Could not create true up status record", http.StatusInternalServerError)
		}
	}

	return status, nil
}
