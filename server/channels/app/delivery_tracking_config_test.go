// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
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

		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{publicChannel.Id, privateChannel.Id},
		})
		require.NoError(t, err)

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
		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(false), EnableForAllChannels: new(true)},
		})
		require.NoError(t, err)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Equal(t, []string{channel.Id}, stored)
		assert.False(t, *th.App.Config().DeliveryTrackingSettings.Enable)
	})

	t.Run("empty ChannelIds clears the stored list", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		require.NoError(t, th.App.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(th.Context, []string{channel.Id}))

		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
			ChannelIds:               []string{},
		})
		require.NoError(t, err)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Empty(t, stored)
	})

	t.Run("archived channels are accepted", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		require.Nil(t, th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id))

		// Rows for archived channels are kept, so re-saving an unchanged list containing
		// one must not lock the admin out of saving.
		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{channel.Id},
		})
		require.NoError(t, err)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Equal(t, []string{channel.Id}, stored)
	})

	t.Run("rejects direct message channels", func(t *testing.T) {
		user := th.CreateUser(t)
		dmChannel := th.CreateDmChannel(t, user)

		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{dmChannel.Id},
		})

		require.Error(t, err)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.delivery_tracking.dm_gm_not_allowed.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("rejects group message channels", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		gmChannel := th.CreateGroupChannel(t, user1, user2)

		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{gmChannel.Id},
		})

		require.Error(t, err)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.delivery_tracking.dm_gm_not_allowed.app_error", appErr.Id)
	})

	t.Run("rejects nonexistent channels", func(t *testing.T) {
		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{model.NewId()},
		})

		require.Error(t, err)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
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
		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{valid.Id, model.NewId()},
		})
		require.Error(t, err)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Equal(t, []string{existing.Id}, stored, "channel list should be unchanged")
		assert.False(t, *th.App.Config().DeliveryTrackingSettings.Enable, "config should be unchanged")
	})

	t.Run("duplicate ids are accepted and stored once", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)

		err := th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
			DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			ChannelIds:               []string{channel.Id, channel.Id},
		})
		require.NoError(t, err)

		stored, err := th.App.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(th.Context)
		require.NoError(t, err)
		assert.Equal(t, []string{channel.Id}, stored)
	})
}

func TestWarnIfDeliveryAuditTargetMissing(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	configureAudit := func(t *testing.T, level mlog.Level) {
		require.NoError(t, th.Server.Audit.Configure(mlog.LoggerConfiguration{
			"audit": mlog.TargetCfg{
				Type:    "file",
				Format:  "json",
				Levels:  []mlog.Level{level},
				Options: json.RawMessage(fmt.Sprintf(`{"filename": %q}`, filepath.Join(t.TempDir(), "audit.log"))),
			},
		}))
	}
	warn := func(t *testing.T, enable bool) io.Reader {
		cfg := th.App.Config().Clone()
		cfg.FeatureFlags.PostDeliveryTracking = true
		cfg.DeliveryTrackingSettings.Enable = model.NewPointer(enable)

		require.NoError(t, th.TestLogger.Flush())
		_, err := io.Copy(io.Discard, th.LogBuffer)
		require.NoError(t, err)

		th.Server.warnIfDeliveryAuditTargetMissing(cfg)
		require.NoError(t, th.TestLogger.Flush())
		return th.LogBuffer
	}

	t.Run("warns when no live audit target consumes audit-delivery", func(t *testing.T) {
		configureAudit(t, mlog.LvlAuditAPI)
		testlib.AssertLog(t, warn(t, true), mlog.LvlWarn.Name, deliveryAuditTargetMissingWarning)
	})

	t.Run("stays quiet when a live audit target consumes audit-delivery, whatever config says", func(t *testing.T) {
		configureAudit(t, mlog.LvlAuditDelivery)
		testlib.AssertNoLog(t, warn(t, true), mlog.LvlWarn.Name, deliveryAuditTargetMissingWarning)
	})

	t.Run("stays quiet when delivery tracking is disabled", func(t *testing.T) {
		configureAudit(t, mlog.LvlAuditAPI)
		testlib.AssertNoLog(t, warn(t, false), mlog.LvlWarn.Name, deliveryAuditTargetMissingWarning)
	})
}

func TestDeliveryAuditWarnInputsChanged(t *testing.T) {
	mainHelper.Parallel(t)

	newConfig := func(flag, enable bool) *model.Config {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.FeatureFlags.PostDeliveryTracking = flag
		cfg.DeliveryTrackingSettings.Enable = model.NewPointer(enable)
		return cfg
	}

	t.Run("unchanged", func(t *testing.T) {
		require.False(t, deliveryAuditWarnInputsChanged(newConfig(true, true), newConfig(true, true)))
	})

	t.Run("feature flag changed", func(t *testing.T) {
		require.True(t, deliveryAuditWarnInputsChanged(newConfig(false, true), newConfig(true, true)))
	})

	t.Run("enable changed", func(t *testing.T) {
		require.True(t, deliveryAuditWarnInputsChanged(newConfig(true, false), newConfig(true, true)))
	})

	// The audit logger only applies audit settings at startup, so editing them cannot change the warning.
	t.Run("audit settings changed", func(t *testing.T) {
		newCfg := newConfig(true, true)
		newCfg.ExperimentalAuditSettings.FileEnabled = model.NewPointer(true)
		newCfg.ExperimentalAuditSettings.AdvancedLoggingJSON = json.RawMessage(`{"delivery":{"type":"file","levels":[{"id":104,"name":"audit-delivery"}],"options":{"filename":"delivery.log"}}}`)
		require.False(t, deliveryAuditWarnInputsChanged(newConfig(true, true), newCfg))
	})
}
