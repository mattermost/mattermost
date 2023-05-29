// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package api4

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func TestNotifyAdmin(t *testing.T) {
	t.Run("error when plan is unknown when notifying on upgrade", func(t *testing.T) {
		th := Setup(t).InitBasic().InitLogin()
		defer th.TearDown()

		statusCode, err := th.Client.NotifyAdmin(&model.NotifyAdminToUpgradeRequest{
			RequiredPlan:    "Unknown plan",
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
		})

		require.Error(t, err)
		require.Equal(t, ": Unable to save notify data.", err.Error())
		require.Equal(t, http.StatusInternalServerError, statusCode)

	})

	t.Run("error when plan is unknown when notifying to trial", func(t *testing.T) {
		th := Setup(t).InitBasic().InitLogin()
		defer th.TearDown()

		statusCode, err := th.Client.NotifyAdmin(&model.NotifyAdminToUpgradeRequest{
			RequiredPlan:      "Unknown plan",
			RequiredFeature:   model.PaidFeatureAllProfessionalfeatures,
			TrialNotification: true,
		})

		require.Error(t, err)
		require.Equal(t, ": Unable to save notify data.", err.Error())
		require.Equal(t, http.StatusInternalServerError, statusCode)

	})

	t.Run("error when feature is unknown when notifying on upgrade", func(t *testing.T) {
		th := Setup(t).InitBasic().InitLogin()
		defer th.TearDown()

		statusCode, err := th.Client.NotifyAdmin(&model.NotifyAdminToUpgradeRequest{
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: "Unknown feature",
		})

		require.Error(t, err)
		require.Equal(t, ": Unable to save notify data.", err.Error())
		require.Equal(t, http.StatusInternalServerError, statusCode)
	})

	t.Run("error when feature is unknown when notifying to trial", func(t *testing.T) {
		th := Setup(t).InitBasic().InitLogin()
		defer th.TearDown()

		statusCode, err := th.Client.NotifyAdmin(&model.NotifyAdminToUpgradeRequest{
			RequiredPlan:      model.LicenseShortSkuProfessional,
			RequiredFeature:   "Unknown feature",
			TrialNotification: true,
		})

		require.Error(t, err)
		require.Equal(t, ": Unable to save notify data.", err.Error())
		require.Equal(t, http.StatusInternalServerError, statusCode)
	})

	t.Run("error when user tries to notify again on same feature within the cool off period", func(t *testing.T) {
		th := Setup(t).InitBasic().InitLogin()
		defer th.TearDown()

		statusCode, err := th.Client.NotifyAdmin(&model.NotifyAdminToUpgradeRequest{
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, statusCode)

		// second attempt to notify for all professional features
		statusCode, err = th.Client.NotifyAdmin(&model.NotifyAdminToUpgradeRequest{
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
		})
		require.Error(t, err)

		require.Equal(t, ": Already notified admin", err.Error())
		require.Equal(t, http.StatusForbidden, statusCode)
	})

	t.Run("successfully save upgrade notification", func(t *testing.T) {
		th := Setup(t).InitBasic().InitLogin()
		defer th.TearDown()

		statusCode, err := th.Client.NotifyAdmin(&model.NotifyAdminToUpgradeRequest{
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
		})

		require.NoError(t, err)
		require.Equal(t, http.StatusOK, statusCode)
	})
}

func TestTriggerNotifyAdmin(t *testing.T) {
	t.Run("error when EnableAPITriggerAdminNotifications is not true", func(t *testing.T) {
		th := Setup(t).InitBasic().InitLogin()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPITriggerAdminNotifications = false })

		statusCode, err := th.SystemAdminClient.TriggerNotifyAdmin(&model.NotifyAdminToUpgradeRequest{})

		require.Error(t, err)
		require.Equal(t, ": Internal error during cloud api request.", err.Error())
		require.Equal(t, http.StatusForbidden, statusCode)

	})

	t.Run("error when non admins try to trigger notifications", func(t *testing.T) {
		th := Setup(t).InitBasic().InitLogin()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPITriggerAdminNotifications = true })

		statusCode, err := th.Client.TriggerNotifyAdmin(&model.NotifyAdminToUpgradeRequest{})

		require.Error(t, err)
		require.Equal(t, ": You do not have the appropriate permissions.", err.Error())
		require.Equal(t, http.StatusForbidden, statusCode)
	})

	t.Run("happy path", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPITriggerAdminNotifications = true })

		statusCode, err := th.Client.NotifyAdmin(&model.NotifyAdminToUpgradeRequest{
			RequiredPlan:    model.LicenseShortSkuProfessional,
			RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, statusCode)

		statusCode, err = th.SystemAdminClient.TriggerNotifyAdmin(&model.NotifyAdminToUpgradeRequest{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, statusCode)
	})
}
