// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/public/utils"
)

func (a *App) GetDeliveryTrackingConfig(rctx request.CTX) (*model.DeliveryTrackingConfig, *model.AppError) {
	channelIDs, err := a.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(rctx)
	if err != nil {
		return nil, model.NewAppError("GetDeliveryTrackingConfig", "app.delivery_tracking.get_config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	settings := a.Config().DeliveryTrackingSettings

	return &model.DeliveryTrackingConfig{
		DeliveryTrackingSettings: model.DeliveryTrackingSettings{
			Enable:               settings.Enable,
			EnableForAllChannels: settings.EnableForAllChannels,
		},
		ChannelIds: channelIDs,
	}, nil
}

func (a *App) SaveDeliveryTrackingConfig(rctx request.CTX, cfg *model.DeliveryTrackingConfig) error {
	if cfg.ChannelIds != nil {
		if err := a.validateTrackedChannelIDs(cfg.ChannelIds); err != nil {
			return err
		}

		// Persist the channel list before the toggles so a store failure leaves config
		// untouched, matching SaveContentFlaggingConfig.
		if err := a.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(rctx, cfg.ChannelIds); err != nil {
			return model.NewAppError("SaveDeliveryTrackingConfig", "app.delivery_tracking.save_config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.UpdateConfig(func(c *model.Config) {
		c.DeliveryTrackingSettings.Enable = cfg.Enable
		c.DeliveryTrackingSettings.EnableForAllChannels = cfg.EnableForAllChannels
	})

	return nil
}

func (a *App) validateTrackedChannelIDs(channelIDs []string) error {
	uniqueIDs := utils.Dedup(channelIDs)
	if len(uniqueIDs) == 0 {
		return nil
	}

	channels, err := a.Srv().Store().Channel().GetChannelsByIds(uniqueIDs, true)
	if err != nil {
		return model.NewAppError("SaveDeliveryTrackingConfig", "app.delivery_tracking.save_config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(channels) != len(uniqueIDs) {
		return model.NewAppError("SaveDeliveryTrackingConfig", "app.delivery_tracking.invalid_channel.app_error", nil, "", http.StatusBadRequest)
	}

	for _, channel := range channels {
		if channel.IsGroupOrDirect() {
			return model.NewAppError("SaveDeliveryTrackingConfig", "app.delivery_tracking.dm_gm_not_allowed.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (s *Server) warnIfDeliveryAuditTargetMissing(cfg *model.Config) {
	if cfg.FeatureFlags == nil || !cfg.FeatureFlags.PostDeliveryTracking {
		return
	}

	if cfg.DeliveryTrackingSettings.Enable == nil || !*cfg.DeliveryTrackingSettings.Enable {
		return
	}

	if s.Audit.IsLevelEnabled(mlog.LvlAuditDelivery) {
		return
	}

	mlog.Warn(
		"DeliveryTrackingSettings.Enable is enabled but no active audit log target consumes the audit-delivery level; post delivery audit records will be discarded. Add a target for the level via ExperimentalAuditSettings.AdvancedLoggingJSON.",
		mlog.String("level", mlog.LvlAuditDelivery.Name),
	)
}

// deliveryAuditWarnInputsChanged reports whether anything the delivery audit target warning
// depends on has changed. Config listeners fire on every save, so without this the warning
// would re-log on every unrelated System Console change while the condition holds.
func deliveryAuditWarnInputsChanged(oldCfg, newCfg *model.Config) bool {
	oldFlag := oldCfg.FeatureFlags != nil && oldCfg.FeatureFlags.PostDeliveryTracking
	newFlag := newCfg.FeatureFlags != nil && newCfg.FeatureFlags.PostDeliveryTracking
	if oldFlag != newFlag {
		return true
	}

	return model.SafeDereference(oldCfg.DeliveryTrackingSettings.Enable) != model.SafeDereference(newCfg.DeliveryTrackingSettings.Enable)
}
