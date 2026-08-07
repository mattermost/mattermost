// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

// DeliveryTrackingSettings controls post delivery audit logging. Only the toggles live
// here; the list of channels delivery is recorded in is stored in the
// PostDeliveryTrackingChannels table, because it can grow large and the whole config is
// broadcast on every config change.
type DeliveryTrackingSettings struct {
	Enable               *bool
	EnableForAllChannels *bool
}

func (s *DeliveryTrackingSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = new(false)
	}

	if s.EnableForAllChannels == nil {
		s.EnableForAllChannels = new(true)
	}
}

func (s *DeliveryTrackingSettings) IsValid() *AppError {
	// Neither toggle can hold an invalid value on its own. The cross-check against the
	// channel list lives on DeliveryTrackingConfig, since the ids are not part of Config.
	return nil
}

// DeliveryTrackingConfig is the request and response body for
// GET and PUT /api/v4/delivery_tracking/config. It embeds DeliveryTrackingSettings so the
// toggles marshal flat alongside ChannelIds.
type DeliveryTrackingConfig struct {
	DeliveryTrackingSettings

	// ChannelIds fully replaces the stored list. A nil value means the caller omitted the
	// field and the stored list is left untouched; an empty slice clears it.
	ChannelIds []string
}

func (c *DeliveryTrackingConfig) SetDefaults() {
	c.DeliveryTrackingSettings.SetDefaults()

	// ChannelIds is deliberately not defaulted: nil and empty mean different things, and
	// collapsing them would make a request that omits the field wipe the stored list.
}

func (c *DeliveryTrackingConfig) IsValid() *AppError {
	if appErr := c.DeliveryTrackingSettings.IsValid(); appErr != nil {
		return appErr
	}

	if !*c.EnableForAllChannels && len(c.ChannelIds) == 0 {
		return NewAppError("DeliveryTrackingConfig.IsValid", "model.delivery_tracking.is_valid.all_channels.app_error", nil, "", http.StatusBadRequest)
	}

	for _, channelID := range c.ChannelIds {
		if !IsValidId(channelID) {
			return NewAppError("DeliveryTrackingConfig.IsValid", "model.delivery_tracking.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}
