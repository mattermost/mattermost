// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// deliveryTrackingFlagOn turns the PostDeliveryTracking feature flag on. It must be passed
// to SetupConfig rather than applied later: InitDeliveryTracking only registers the routes
// when the flag is already on at boot.
func deliveryTrackingFlagOn(cfg *model.Config) {
	cfg.FeatureFlags.PostDeliveryTracking = true
}

// licenseDeliveryTracking adds the Enterprise Advanced license the endpoints require.
func licenseDeliveryTracking(t *testing.T, th *TestHelper) {
	t.Helper()
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
}

func TestDeliveryTrackingRoutesNotRegisteredWhenFlagOff(t *testing.T) {
	// The flag defaults to false, so a plain Setup boots with the routes unregistered.
	th := Setup(t).InitBasic(t)
	licenseDeliveryTracking(t, th)
	defer th.RemoveLicense(t)

	_, resp, err := th.SystemAdminClient.GetDeliveryTrackingConfig(context.Background())
	require.Error(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)

	resp, err = th.SystemAdminClient.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
		DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
	})
	require.Error(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestGetDeliveryTrackingConfig(t *testing.T) {
	th := SetupConfig(t, deliveryTrackingFlagOn).InitBasic(t)

	t.Run("returns 501 without an Enterprise Advanced license", func(t *testing.T) {
		th.RemoveLicense(t)

		_, resp, err := th.SystemAdminClient.GetDeliveryTrackingConfig(context.Background())
		require.Error(t, err)
		CheckErrorID(t, err, "api.delivery_tracking.error.license")
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("returns 501 when the feature flag is turned off at runtime", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		// Routes stay registered until the next restart, so the handler must reject.
		updateTestFeatureFlags(t, th, func(cfg *model.Config) {
			cfg.FeatureFlags.PostDeliveryTracking = false
		})
		defer updateTestFeatureFlags(t, th, deliveryTrackingFlagOn)

		_, resp, err := th.SystemAdminClient.GetDeliveryTrackingConfig(context.Background())
		require.Error(t, err)
		CheckErrorID(t, err, "api.delivery_tracking.error.feature_flag")
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("returns 403 for a non-admin", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		_, resp, err := th.Client.GetDeliveryTrackingConfig(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("returns the configuration for an admin", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		config, _, err := th.SystemAdminClient.GetDeliveryTrackingConfig(context.Background())
		require.NoError(t, err)
		require.NotNil(t, config)

		require.NotNil(t, config.Enable)
		require.NotNil(t, config.EnableForAllChannels)
		require.NotNil(t, config.ChannelIds)
	})
}

func TestUpdateDeliveryTrackingConfig(t *testing.T) {
	th := SetupConfig(t, deliveryTrackingFlagOn).InitBasic(t)

	t.Run("returns 501 without an Enterprise Advanced license", func(t *testing.T) {
		th.RemoveLicense(t)

		resp, err := th.SystemAdminClient.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
		})
		require.Error(t, err)
		CheckErrorID(t, err, "api.delivery_tracking.error.license")
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("returns 501 when the feature flag is turned off at runtime", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		updateTestFeatureFlags(t, th, func(cfg *model.Config) {
			cfg.FeatureFlags.PostDeliveryTracking = false
		})
		defer updateTestFeatureFlags(t, th, deliveryTrackingFlagOn)

		resp, err := th.SystemAdminClient.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
		})
		require.Error(t, err)
		CheckErrorID(t, err, "api.delivery_tracking.error.feature_flag")
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("returns 403 for a non-admin", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		resp, err := th.Client.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("round trips a save and a read", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		channel := th.CreatePublicChannel(t)

		_, err := th.SystemAdminClient.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{channel.Id},
		})
		require.NoError(t, err)

		config, _, err := th.SystemAdminClient.GetDeliveryTrackingConfig(context.Background())
		require.NoError(t, err)
		assert.True(t, *config.Enable)
		assert.False(t, *config.EnableForAllChannels)
		assert.Equal(t, []string{channel.Id}, config.ChannelIds)
	})

	t.Run("rejects selected channels with an empty list", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		resp, err := th.SystemAdminClient.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{},
		})
		require.Error(t, err)
		CheckErrorID(t, err, "model.delivery_tracking.is_valid.all_channels.app_error")
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects a DM channel", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		dmChannel, _, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
		require.NoError(t, err)

		resp, err := th.SystemAdminClient.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{dmChannel.Id},
		})
		require.Error(t, err)
		CheckErrorID(t, err, "app.delivery_tracking.dm_gm_not_allowed.app_error")
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects a malformed channel id", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		resp, err := th.SystemAdminClient.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{"not-a-valid-id"},
		})
		require.Error(t, err)
		CheckErrorID(t, err, "model.delivery_tracking.is_valid.channel_id.app_error")
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("works with content flagging disabled", func(t *testing.T) {
		licenseDeliveryTracking(t, th)
		defer th.RemoveLicense(t)

		// Post delivery audit logging is governed only by its own toggle and channel list,
		// so it must not depend on the content flagging master switch.
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.EnableContentFlagging = new(false)
		})

		_, err := th.SystemAdminClient.UpdateDeliveryTrackingConfig(context.Background(), &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
		})
		require.NoError(t, err)

		config, _, err := th.SystemAdminClient.GetDeliveryTrackingConfig(context.Background())
		require.NoError(t, err)
		assert.True(t, *config.Enable)
	})
}
