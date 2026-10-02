// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetDeliveryTrackingConfig(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("returns config toggles and stored channel ids", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.DeliveryTrackingSettings.Enable = new(true)
			cfg.DeliveryTrackingSettings.EnableForAllChannels = new(false)
		})
		require.NoError(t, th.App.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(th.Context, []string{channel.Id}))

		config, appErr := th.App.GetDeliveryTrackingConfig(th.Context)
		require.Nil(t, appErr)

		assert.True(t, *config.Enable)
		assert.False(t, *config.EnableForAllChannels)
		assert.Equal(t, []string{channel.Id}, config.ChannelIds)
	})

	t.Run("returns an empty slice when nothing is tracked", func(t *testing.T) {
		require.NoError(t, th.App.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(th.Context, []string{}))

		config, appErr := th.App.GetDeliveryTrackingConfig(th.Context)
		require.Nil(t, appErr)

		require.NotNil(t, config.ChannelIds)
		assert.Empty(t, config.ChannelIds)
	})
}

func TestSaveDeliveryTrackingConfig(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("persists toggles and channel ids", func(t *testing.T) {
		publicChannel := th.CreateChannel(t, th.BasicTeam)
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)

		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{publicChannel.Id, privateChannel.Id},
		})
		require.Nil(t, appErr)

		assert.True(t, *th.App.Config().DeliveryTrackingSettings.Enable)
		assert.False(t, *th.App.Config().DeliveryTrackingSettings.EnableForAllChannels)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{publicChannel.Id, privateChannel.Id}, stored)
	})

	t.Run("nil ChannelIds leaves the stored list untouched", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		require.NoError(t, th.App.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(th.Context, []string{channel.Id}))

		// Turning the feature off must not discard the admin's channel selection.
		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(false), EnableForAllChannels: new(true)},
		})
		require.Nil(t, appErr)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Equal(t, []string{channel.Id}, stored)
		assert.False(t, *th.App.Config().DeliveryTrackingSettings.Enable)
	})

	t.Run("empty ChannelIds clears the stored list", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		require.NoError(t, th.App.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(th.Context, []string{channel.Id}))

		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
			ChannelIds:               []string{},
		})
		require.Nil(t, appErr)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Empty(t, stored)
	})

	t.Run("archived channels are accepted", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		require.Nil(t, th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id))

		// Rows for archived channels are kept, so re-saving an unchanged list containing
		// one must not lock the admin out of saving.
		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{channel.Id},
		})
		require.Nil(t, appErr)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Equal(t, []string{channel.Id}, stored)
	})

	t.Run("rejects direct message channels", func(t *testing.T) {
		user := th.CreateUser(t)
		dmChannel := th.CreateDmChannel(t, user)

		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{dmChannel.Id},
		})

		require.NotNil(t, appErr)
		assert.Equal(t, "app.delivery_tracking.dm_gm_not_allowed.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("rejects group message channels", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		gmChannel := th.CreateGroupChannel(t, user1, user2)

		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{gmChannel.Id},
		})

		require.NotNil(t, appErr)
		assert.Equal(t, "app.delivery_tracking.dm_gm_not_allowed.app_error", appErr.Id)
	})

	t.Run("rejects nonexistent channels", func(t *testing.T) {
		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{model.NewId()},
		})

		require.NotNil(t, appErr)
		assert.Equal(t, "app.delivery_tracking.invalid_channel.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("rejection writes nothing", func(t *testing.T) {
		existing := th.CreateChannel(t, th.BasicTeam)
		require.NoError(t, th.App.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(th.Context, []string{existing.Id}))

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.DeliveryTrackingSettings.Enable = new(false)
		})

		valid := th.CreateChannel(t, th.BasicTeam)
		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{valid.Id, model.NewId()},
		})
		require.NotNil(t, appErr)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Equal(t, []string{existing.Id}, stored, "channel list should be unchanged")
		assert.False(t, *th.App.Config().DeliveryTrackingSettings.Enable, "config should be unchanged")
	})

	t.Run("duplicate ids are accepted and stored once", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)

		appErr := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{channel.Id, channel.Id},
		})
		require.Nil(t, appErr)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Equal(t, []string{channel.Id}, stored)
	})
}
