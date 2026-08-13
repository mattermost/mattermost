// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) getStartOfUserDay(userID string) (time.Time, *model.AppError) {
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return time.Time{}, appErr
	}

	loc := user.GetTimezoneLocation()
	now := time.Now().In(loc)
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	return startOfDay, nil
}

func (a *App) getStartOfUserDayMillis(userID string) (int64, *model.AppError) {
	startOfDay, appErr := a.getStartOfUserDay(userID)
	if appErr != nil {
		return 0, appErr
	}

	return startOfDay.UnixMilli(), nil
}

func (a *App) AIRecapsEnabled() bool {
	return a.Config().AIRecapsEnabled()
}

func (a *App) requireAIRecapsEnabled(where string) *model.AppError {
	if !a.AIRecapsEnabled() {
		return model.NewAppError(where, "api.recap.disabled.app_error", nil, "", http.StatusNotImplemented)
	}
	return nil
}

// GetRecapLimitStatus returns the current user's limit status for UI display
func (a *App) GetRecapLimitStatus(userID string) (*model.RecapLimitStatus, *model.AppError) {
	// Get effective limits
	limits, appErr := a.GetEffectiveLimits()
	if appErr != nil {
		return nil, appErr
	}

	startOfDay, appErr := a.getStartOfUserDay(userID)
	if appErr != nil {
		return nil, appErr
	}
	now := time.Now().In(startOfDay.Location())
	startOfNextDay := startOfDay.AddDate(0, 0, 1)

	// Count daily usage (excluding skipped)
	dailyCount, err := a.Srv().Store().Recap().CountForUserSince(userID, startOfDay.UnixMilli())
	if err != nil {
		return nil, model.NewAppError("GetRecapLimitStatus", "app.recap.get_daily_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Calculate cooldown status
	var cooldown model.CooldownStatus
	if limits.CooldownMinutes > 0 {
		lastRecap, err := a.Srv().Store().Recap().GetLastCompletedManualRecap(userID)
		if err != nil {
			return nil, model.NewAppError("GetRecapLimitStatus", "app.recap.cooldown_check_failed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

// GetEffectiveLimits returns the system-wide resolved recap limits.
func (a *App) GetEffectiveLimits() (*model.EffectiveRecapLimits, *model.AppError) {
	if appErr := a.requireAIRecapsEnabled("GetEffectiveLimits"); appErr != nil {
		return nil, appErr
	}

	config := a.Config()
	settings := &config.AIRecapSettings

	// Start with system defaults
	limits := &model.EffectiveRecapLimits{
		Source:   model.LimitSourceSystem,
		SourceID: "",
	}

	// Apply system defaults from config (SetDefaults guarantees DefaultLimits is non-nil)
	limits.MaxRecapsPerDay = getValueOrDefault(settings.DefaultLimits.MaxRecapsPerDay, 10)
	limits.MaxScheduledRecaps = getValueOrDefault(settings.DefaultLimits.MaxScheduledRecaps, 5)
	limits.MaxChannelsPerRecap = getValueOrDefault(settings.DefaultLimits.MaxChannelsPerRecap, -1)
	limits.MaxPostsPerRecap = getValueOrDefault(settings.DefaultLimits.MaxPostsPerRecap, 500)
	limits.MaxTokensPerRecap = getValueOrDefault(settings.DefaultLimits.MaxTokensPerRecap, 100000)
	limits.MaxPostsPerDay = getValueOrDefault(settings.DefaultLimits.MaxPostsPerDay, 5000)
	limits.CooldownMinutes = getValueOrDefault(settings.DefaultLimits.CooldownMinutes, 60)

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
