// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeliveryTrackingSettingsSetDefaults(t *testing.T) {
	t.Run("defaults to disabled and all channels", func(t *testing.T) {
		settings := DeliveryTrackingSettings{}
		settings.SetDefaults()

		require.NotNil(t, settings.Enable)
		require.NotNil(t, settings.EnableForAllChannels)
		assert.False(t, *settings.Enable)
		assert.True(t, *settings.EnableForAllChannels)
	})

	t.Run("preserves existing values", func(t *testing.T) {
		settings := DeliveryTrackingSettings{
			Enable:               new(true),
			EnableForAllChannels: new(false),
		}
		settings.SetDefaults()

		assert.True(t, *settings.Enable)
		assert.False(t, *settings.EnableForAllChannels)
	})
}

func TestDeliveryTrackingSettingsIsValid(t *testing.T) {
	testCases := []struct {
		name          string
		settings      DeliveryTrackingSettings
		expectedError string
	}{
		{
			name:     "both toggles set is valid",
			settings: DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
		},
		{
			name:          "nil Enable is invalid",
			settings:      DeliveryTrackingSettings{EnableForAllChannels: new(true)},
			expectedError: "model.delivery_tracking.is_valid.missing_toggle.app_error",
		},
		{
			name:          "nil EnableForAllChannels is invalid",
			settings:      DeliveryTrackingSettings{Enable: new(true)},
			expectedError: "model.delivery_tracking.is_valid.missing_toggle.app_error",
		},
		{
			name:          "both toggles nil is invalid",
			settings:      DeliveryTrackingSettings{},
			expectedError: "model.delivery_tracking.is_valid.missing_toggle.app_error",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			appErr := tc.settings.IsValid()

			if tc.expectedError == "" {
				assert.Nil(t, appErr)
				return
			}

			require.NotNil(t, appErr)
			assert.Equal(t, tc.expectedError, appErr.Id)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		})
	}
}

func TestDeliveryTrackingConfigSetDefaults(t *testing.T) {
	t.Run("leaves nil ChannelIds nil", func(t *testing.T) {
		// nil and empty mean different things on save: nil leaves the stored list
		// untouched, empty clears it. SetDefaults must not collapse the two.
		config := DeliveryTrackingConfig{}
		config.SetDefaults()

		assert.Nil(t, config.ChannelIds)
	})

	t.Run("leaves empty ChannelIds empty", func(t *testing.T) {
		config := DeliveryTrackingConfig{ChannelIds: []string{}}
		config.SetDefaults()

		require.NotNil(t, config.ChannelIds)
		assert.Empty(t, config.ChannelIds)
	})

	t.Run("defaults the embedded toggles", func(t *testing.T) {
		config := DeliveryTrackingConfig{}
		config.SetDefaults()

		require.NotNil(t, config.Enable)
		require.NotNil(t, config.EnableForAllChannels)
		assert.False(t, *config.Enable)
		assert.True(t, *config.EnableForAllChannels)
	})
}

func TestDeliveryTrackingConfigIsValid(t *testing.T) {
	channelID := NewId()

	testCases := []struct {
		name          string
		config        DeliveryTrackingConfig
		expectedError string
	}{
		{
			name: "all channels with no ids is valid",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
			},
		},
		{
			name: "all channels with ids is valid",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
				ChannelIds:               []string{channelID},
			},
		},
		{
			name: "selected channels with ids is valid",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
				ChannelIds:               []string{channelID},
			},
		},
		{
			name: "selected channels with nil ids is invalid",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
			},
			expectedError: "model.delivery_tracking.is_valid.all_channels.app_error",
		},
		{
			name: "selected channels with empty ids is invalid",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
				ChannelIds:               []string{},
			},
			expectedError: "model.delivery_tracking.is_valid.all_channels.app_error",
		},
		{
			name: "malformed channel id is invalid",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(false)},
				ChannelIds:               []string{"not-a-valid-id"},
			},
			expectedError: "model.delivery_tracking.is_valid.channel_id.app_error",
		},
		{
			name: "malformed channel id is rejected even with all channels on",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(true), EnableForAllChannels: new(true)},
				ChannelIds:               []string{channelID, ""},
			},
			expectedError: "model.delivery_tracking.is_valid.channel_id.app_error",
		},
		{
			name: "disabled config is still validated",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(false), EnableForAllChannels: new(false)},
			},
			expectedError: "model.delivery_tracking.is_valid.all_channels.app_error",
		},
		{
			// Without the guard on the embedded settings these would dereference nil rather
			// than return an error, since IsValid can be reached without SetDefaults.
			name: "nil Enable is rejected without panicking",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{EnableForAllChannels: new(true)},
			},
			expectedError: "model.delivery_tracking.is_valid.missing_toggle.app_error",
		},
		{
			name: "nil EnableForAllChannels is rejected without panicking",
			config: DeliveryTrackingConfig{
				DeliveryTrackingSettings: DeliveryTrackingSettings{Enable: new(true)},
				ChannelIds:               []string{channelID},
			},
			expectedError: "model.delivery_tracking.is_valid.missing_toggle.app_error",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			appErr := tc.config.IsValid()

			if tc.expectedError == "" {
				assert.Nil(t, appErr)
				return
			}

			require.NotNil(t, appErr)
			assert.Equal(t, tc.expectedError, appErr.Id)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		})
	}
}

func TestConfigDeliveryTrackingSettingsDefaults(t *testing.T) {
	cfg := Config{}
	cfg.SetDefaults()

	require.NotNil(t, cfg.DeliveryTrackingSettings.Enable)
	require.NotNil(t, cfg.DeliveryTrackingSettings.EnableForAllChannels)
	assert.False(t, *cfg.DeliveryTrackingSettings.Enable)
	assert.True(t, *cfg.DeliveryTrackingSettings.EnableForAllChannels)
	assert.Nil(t, cfg.IsValid())
}
