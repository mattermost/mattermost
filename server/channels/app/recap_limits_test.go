// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetEffectiveLimitsDefaults(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	// Ensure defaults are set (they should be by default)
	limits, appErr := th.App.GetEffectiveLimits("any-user-id")
	require.Nil(t, appErr)
	require.NotNil(t, limits)

	// Verify system defaults
	require.Equal(t, 10, limits.MaxRecapsPerDay, "default MaxRecapsPerDay")
	require.Equal(t, 5, limits.MaxScheduledRecaps, "default MaxScheduledRecaps")
	require.Equal(t, -1, limits.MaxChannelsPerRecap, "default MaxChannelsPerRecap (unlimited)")
	require.Equal(t, 500, limits.MaxPostsPerRecap, "default MaxPostsPerRecap")
	require.Equal(t, 100000, limits.MaxTokensPerRecap, "default MaxTokensPerRecap")
	require.Equal(t, 5000, limits.MaxPostsPerDay, "default MaxPostsPerDay")
	require.Equal(t, 60, limits.CooldownMinutes, "default CooldownMinutes")

	// Verify source tracking
	require.Equal(t, model.LimitSourceSystem, limits.Source)
	require.Equal(t, "", limits.SourceID)
}

func TestGetEffectiveLimitsWithDisabledToggle(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	// Disable the EnforceRecapsPerDay toggle
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(false)
	})

	limits, appErr := th.App.GetEffectiveLimits("any-user-id")
	require.Nil(t, appErr)
	require.NotNil(t, limits)

	// MaxRecapsPerDay should be -1 (unlimited) because toggle is disabled
	require.Equal(t, -1, limits.MaxRecapsPerDay, "MaxRecapsPerDay should be unlimited when toggle disabled")

	// Other limits should remain at defaults
	require.Equal(t, 5, limits.MaxScheduledRecaps, "MaxScheduledRecaps should remain default")
	require.Equal(t, -1, limits.MaxChannelsPerRecap, "MaxChannelsPerRecap should remain default")
	require.Equal(t, 500, limits.MaxPostsPerRecap, "MaxPostsPerRecap should remain default")
	require.Equal(t, 100000, limits.MaxTokensPerRecap, "MaxTokensPerRecap should remain default")
	require.Equal(t, 5000, limits.MaxPostsPerDay, "MaxPostsPerDay should remain default")
	require.Equal(t, 60, limits.CooldownMinutes, "CooldownMinutes should remain default")
}

func TestGetEffectiveLimitsWithCustomDefaults(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	// Set custom default limits
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.DefaultLimits.MaxRecapsPerDay = model.NewPointer(20)
		cfg.AIRecapSettings.DefaultLimits.MaxScheduledRecaps = model.NewPointer(15)
		cfg.AIRecapSettings.DefaultLimits.MaxPostsPerRecap = model.NewPointer(1000)
	})

	limits, appErr := th.App.GetEffectiveLimits("any-user-id")
	require.Nil(t, appErr)
	require.NotNil(t, limits)

	// Verify custom values are honored
	require.Equal(t, 20, limits.MaxRecapsPerDay, "custom MaxRecapsPerDay should be honored")
	require.Equal(t, 15, limits.MaxScheduledRecaps, "custom MaxScheduledRecaps should be honored")
	require.Equal(t, 1000, limits.MaxPostsPerRecap, "custom MaxPostsPerRecap should be honored")

	// Unchanged limits should remain at defaults
	require.Equal(t, -1, limits.MaxChannelsPerRecap, "MaxChannelsPerRecap should remain default")
	require.Equal(t, 100000, limits.MaxTokensPerRecap, "MaxTokensPerRecap should remain default")
	require.Equal(t, 5000, limits.MaxPostsPerDay, "MaxPostsPerDay should remain default")
	require.Equal(t, 60, limits.CooldownMinutes, "CooldownMinutes should remain default")
}

func TestGetEffectiveLimitsAllTogglesDisabled(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	// Disable all enforcement toggles
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceScheduledRecaps = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceChannelsPerRecap = model.NewPointer(false)
		cfg.AIRecapSettings.EnforcePostsPerRecap = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceTokensPerRecap = model.NewPointer(false)
		cfg.AIRecapSettings.EnforcePostsPerDay = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(false)
	})

	limits, appErr := th.App.GetEffectiveLimits("any-user-id")
	require.Nil(t, appErr)
	require.NotNil(t, limits)

	// All limits should be -1 (unlimited)
	require.Equal(t, -1, limits.MaxRecapsPerDay, "MaxRecapsPerDay should be unlimited")
	require.Equal(t, -1, limits.MaxScheduledRecaps, "MaxScheduledRecaps should be unlimited")
	require.Equal(t, -1, limits.MaxChannelsPerRecap, "MaxChannelsPerRecap should be unlimited")
	require.Equal(t, -1, limits.MaxPostsPerRecap, "MaxPostsPerRecap should be unlimited")
	require.Equal(t, -1, limits.MaxTokensPerRecap, "MaxTokensPerRecap should be unlimited")
	require.Equal(t, -1, limits.MaxPostsPerDay, "MaxPostsPerDay should be unlimited")
	require.Equal(t, -1, limits.CooldownMinutes, "CooldownMinutes should be unlimited")
}

func TestGetEffectiveLimitsUnlimitedConfigValue(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	// Set MaxRecapsPerDay to unlimited (-1) in config
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.DefaultLimits.MaxRecapsPerDay = model.NewPointer(-1)
	})

	limits, appErr := th.App.GetEffectiveLimits("any-user-id")
	require.Nil(t, appErr)
	require.NotNil(t, limits)

	// Should return -1 from config (unlimited)
	require.Equal(t, -1, limits.MaxRecapsPerDay, "unlimited config value should be honored")

	// Other limits should remain at defaults
	require.Equal(t, 5, limits.MaxScheduledRecaps)
}

func TestIsLimitEnabled(t *testing.T) {
	mainHelper.Parallel(t)

	// Test that IsLimitEnabled correctly identifies enabled vs disabled limits
	require.True(t, model.IsLimitEnabled(10), "positive value should be enabled")
	require.True(t, model.IsLimitEnabled(1), "1 should be enabled")
	require.True(t, model.IsLimitEnabled(0), "0 should be enabled (0 cooldown is valid)")
	require.False(t, model.IsLimitEnabled(-1), "-1 (UnlimitedValue) should not be enabled")
	require.True(t, model.IsLimitEnabled(-2), "-2 should be enabled (only -1 is special)")
}
