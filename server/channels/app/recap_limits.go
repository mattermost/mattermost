// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// GetRecapLimitStatus returns the current user's limit status for UI display
func (a *App) GetRecapLimitStatus(userID string) (*model.RecapLimitStatus, error) {
	// Get effective limits
	limits, appErr := a.GetEffectiveLimits(userID)
	if appErr != nil {
		return nil, appErr
	}

	// Get user timezone for daily reset calculation
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return nil, appErr
	}
	loc := user.GetTimezoneLocation()
	now := time.Now().In(loc)
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	startOfNextDay := startOfDay.AddDate(0, 0, 1)

	// Count daily usage (excluding skipped)
	dailyCount, err := a.Srv().Store().Recap().CountForUserSince(userID, startOfDay.UnixMilli())
	if err != nil {
		return nil, err
	}

	// Calculate cooldown status
	var cooldown model.CooldownStatus
	if limits.CooldownMinutes > 0 {
		lastRecap, err := a.Srv().Store().Recap().GetLastCompletedManualRecap(userID)
		if err != nil {
			return nil, err
		}
		if lastRecap != nil {
			cooldownEnd := lastRecap.CreateAt + int64(limits.CooldownMinutes)*60*1000
			if cooldownEnd > now.UnixMilli() {
				cooldown.IsActive = true
				cooldown.AvailableAt = cooldownEnd
				cooldown.RetryAfterSeconds = int((cooldownEnd - now.UnixMilli()) / 1000)
			}
		}
	}

	return &model.RecapLimitStatus{
		EffectiveLimits: *limits,
		Daily: model.DailyUsageStatus{
			Used:    int(dailyCount),
			Limit:   limits.MaxRecapsPerDay,
			ResetAt: startOfNextDay.UnixMilli(),
		},
		Cooldown: cooldown,
	}, nil
}

// GetEffectiveLimits returns the resolved recap limits for a given user.
// Currently returns system defaults; Phase 8 will add group/user resolution.
func (a *App) GetEffectiveLimits(userID string) (*model.EffectiveRecapLimits, *model.AppError) {
	config := a.Config()
	settings := &config.AIRecapSettings

	// Start with system defaults
	limits := &model.EffectiveRecapLimits{
		Source:   model.LimitSourceSystem,
		SourceID: "",
	}

	// Apply system defaults from config
	if settings.DefaultLimits != nil {
		limits.MaxRecapsPerDay = getValueOrDefault(settings.DefaultLimits.MaxRecapsPerDay, 10)
		limits.MaxScheduledRecaps = getValueOrDefault(settings.DefaultLimits.MaxScheduledRecaps, 5)
		limits.MaxChannelsPerRecap = getValueOrDefault(settings.DefaultLimits.MaxChannelsPerRecap, -1)
		limits.MaxPostsPerRecap = getValueOrDefault(settings.DefaultLimits.MaxPostsPerRecap, 500)
		limits.MaxTokensPerRecap = getValueOrDefault(settings.DefaultLimits.MaxTokensPerRecap, 100000)
		limits.MaxPostsPerDay = getValueOrDefault(settings.DefaultLimits.MaxPostsPerDay, 5000)
		limits.CooldownMinutes = getValueOrDefault(settings.DefaultLimits.CooldownMinutes, 60)
	} else {
		// Hardcoded fallback if DefaultLimits somehow nil
		limits.MaxRecapsPerDay = 10
		limits.MaxScheduledRecaps = 5
		limits.MaxChannelsPerRecap = -1
		limits.MaxPostsPerRecap = 500
		limits.MaxTokensPerRecap = 100000
		limits.MaxPostsPerDay = 5000
		limits.CooldownMinutes = 60
	}

	// Apply per-limit enforcement toggles
	// When a toggle is disabled, set limit to -1 (unlimited)
	if !getBoolOrDefault(settings.EnforceRecapsPerDay, true) {
		limits.MaxRecapsPerDay = model.UnlimitedValue
	}
	if !getBoolOrDefault(settings.EnforceScheduledRecaps, true) {
		limits.MaxScheduledRecaps = model.UnlimitedValue
	}
	if !getBoolOrDefault(settings.EnforceChannelsPerRecap, true) {
		limits.MaxChannelsPerRecap = model.UnlimitedValue
	}
	if !getBoolOrDefault(settings.EnforcePostsPerRecap, true) {
		limits.MaxPostsPerRecap = model.UnlimitedValue
	}
	if !getBoolOrDefault(settings.EnforceTokensPerRecap, true) {
		limits.MaxTokensPerRecap = model.UnlimitedValue
	}
	if !getBoolOrDefault(settings.EnforcePostsPerDay, true) {
		limits.MaxPostsPerDay = model.UnlimitedValue
	}
	if !getBoolOrDefault(settings.EnforceCooldown, true) {
		limits.CooldownMinutes = model.UnlimitedValue
	}

	// TODO (Phase 8): Group-based limit resolution
	// groups, err := a.GetGroupsByUserId(userID, model.GroupSearchOpts{})
	// Apply "highest wins" logic for multi-group membership

	// TODO (Phase 8): User-specific override resolution
	// Check if user has individual limit overrides

	return limits, nil
}

// getValueOrDefault returns the dereferenced pointer value, or the default if nil
func getValueOrDefault(ptr *int, defaultVal int) int {
	if ptr == nil {
		return defaultVal
	}
	return *ptr
}

// getBoolOrDefault returns the dereferenced pointer value, or the default if nil
func getBoolOrDefault(ptr *bool, defaultVal bool) bool {
	if ptr == nil {
		return defaultVal
	}
	return *ptr
}
