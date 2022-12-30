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

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/telemetry"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func (a *App) getTrueUpProfile() (*model.TrueUpReviewProfile, error) {

	license := a.Channels().License()
	// Customer Info & Usage Analytics
	activeUserCount, err := a.Srv().Store().Status().GetTotalActiveUsersCount()
	if err != nil {
		return nil, model.NewAppError("requestTrueUpReview", "api.license.true_up_review.user_count_fail", nil, "Could not get the total active users count", http.StatusInternalServerError)
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
		ActivePluginNames:   []string{},
		InactivePluginNames: []string{},
	}

	if pluginResponse, err := a.GetPlugins(); err == nil {
		for _, plugin := range pluginResponse.Active {
			trueUpReviewPlugins.ActivePluginNames = append(trueUpReviewPlugins.ActivePluginNames, plugin.Name)
		}
		trueUpReviewPlugins.TotalActivePlugins = len(trueUpReviewPlugins.ActivePluginNames)

		for _, plugin := range pluginResponse.Inactive {
			trueUpReviewPlugins.InactivePluginNames = append(trueUpReviewPlugins.InactivePluginNames, plugin.Name)
		}
		trueUpReviewPlugins.TotalInactivePlugins = len(trueUpReviewPlugins.InactivePluginNames)
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
		ActiveUsers:            activeUserCount,
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
	for pluginName, pluginValue := range plugins {
		telemetryProperties["plugin_"+pluginName] = pluginValue
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

	telemetryService := a.Srv().GetTelemetryService()
	status.TelemetryEnabled = telemetryService.TelemetryEnabled()
	return status, nil
}
