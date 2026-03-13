// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

// RecapLimitSettings configures the limits for AI Recaps
type RecapLimitSettings struct {
	MaxRecapsPerDay     *int // Default: 10, -1 = unlimited
	MaxScheduledRecaps  *int // Default: 5, -1 = unlimited
	MaxChannelsPerRecap *int // Default: -1 (unlimited)
	MaxPostsPerRecap    *int // Default: 500, -1 = unlimited
	MaxTokensPerRecap   *int // Default: 100000, -1 = unlimited
	MaxPostsPerDay      *int // Default: 5000, -1 = unlimited
	CooldownMinutes     *int // Default: 60, 0 = no cooldown
}

// SetDefaults sets the default values for RecapLimitSettings
func (s *RecapLimitSettings) SetDefaults() {
	if s.MaxRecapsPerDay == nil {
		s.MaxRecapsPerDay = NewPointer(10)
	}
	if s.MaxScheduledRecaps == nil {
		s.MaxScheduledRecaps = NewPointer(5)
	}
	if s.MaxChannelsPerRecap == nil {
		s.MaxChannelsPerRecap = NewPointer(-1) // unlimited by default
	}
	if s.MaxPostsPerRecap == nil {
		s.MaxPostsPerRecap = NewPointer(500)
	}
	if s.MaxTokensPerRecap == nil {
		s.MaxTokensPerRecap = NewPointer(100000)
	}
	if s.MaxPostsPerDay == nil {
		s.MaxPostsPerDay = NewPointer(5000)
	}
	if s.CooldownMinutes == nil {
		s.CooldownMinutes = NewPointer(60)
	}
}

// isValid validates the RecapLimitSettings
func (s *RecapLimitSettings) isValid() *AppError {
	// MaxRecapsPerDay: must be >= 1 OR == -1 (unlimited)
	if s.MaxRecapsPerDay != nil && *s.MaxRecapsPerDay != -1 && *s.MaxRecapsPerDay < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_recaps_per_day.app_error", nil, "", http.StatusBadRequest)
	}

	// MaxScheduledRecaps: must be >= 1 OR == -1 (unlimited)
	if s.MaxScheduledRecaps != nil && *s.MaxScheduledRecaps != -1 && *s.MaxScheduledRecaps < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_scheduled_recaps.app_error", nil, "", http.StatusBadRequest)
	}

	// MaxChannelsPerRecap: must be >= 1 OR == -1 (unlimited)
	if s.MaxChannelsPerRecap != nil && *s.MaxChannelsPerRecap != -1 && *s.MaxChannelsPerRecap < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_channels_per_recap.app_error", nil, "", http.StatusBadRequest)
	}

	// MaxPostsPerRecap: must be >= 1 OR == -1 (unlimited)
	if s.MaxPostsPerRecap != nil && *s.MaxPostsPerRecap != -1 && *s.MaxPostsPerRecap < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_posts_per_recap.app_error", nil, "", http.StatusBadRequest)
	}

	// MaxTokensPerRecap: must be >= 1 OR == -1 (unlimited)
	if s.MaxTokensPerRecap != nil && *s.MaxTokensPerRecap != -1 && *s.MaxTokensPerRecap < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_tokens_per_recap.app_error", nil, "", http.StatusBadRequest)
	}

	// MaxPostsPerDay: must be >= 1 OR == -1 (unlimited)
	if s.MaxPostsPerDay != nil && *s.MaxPostsPerDay != -1 && *s.MaxPostsPerDay < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_posts_per_day.app_error", nil, "", http.StatusBadRequest)
	}

	// CooldownMinutes: must be >= 0 (0 = no cooldown)
	if s.CooldownMinutes != nil && *s.CooldownMinutes < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.cooldown_minutes.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// AIRecapSettings configures the AI Recap feature limits
type AIRecapSettings struct {
	Enable *bool `access:"ai_recaps"` // Master toggle, default: true

	// System-wide default limits
	DefaultLimits *RecapLimitSettings

	// Per-limit enforcement toggles (all default to true)
	EnforceRecapsPerDay     *bool `access:"ai_recaps"`
	EnforceScheduledRecaps  *bool `access:"ai_recaps"`
	EnforceChannelsPerRecap *bool `access:"ai_recaps"`
	EnforcePostsPerRecap    *bool `access:"ai_recaps"`
	EnforceTokensPerRecap   *bool `access:"ai_recaps"`
	EnforcePostsPerDay      *bool `access:"ai_recaps"`
	EnforceCooldown         *bool `access:"ai_recaps"`
}

// SetDefaults sets the default values for AIRecapSettings
func (s *AIRecapSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(true)
	}

	if s.DefaultLimits == nil {
		s.DefaultLimits = &RecapLimitSettings{}
	}
	s.DefaultLimits.SetDefaults()

	if s.EnforceRecapsPerDay == nil {
		s.EnforceRecapsPerDay = NewPointer(true)
	}
	if s.EnforceScheduledRecaps == nil {
		s.EnforceScheduledRecaps = NewPointer(true)
	}
	if s.EnforceChannelsPerRecap == nil {
		s.EnforceChannelsPerRecap = NewPointer(true)
	}
	if s.EnforcePostsPerRecap == nil {
		s.EnforcePostsPerRecap = NewPointer(true)
	}
	if s.EnforceTokensPerRecap == nil {
		s.EnforceTokensPerRecap = NewPointer(true)
	}
	if s.EnforcePostsPerDay == nil {
		s.EnforcePostsPerDay = NewPointer(true)
	}
	if s.EnforceCooldown == nil {
		s.EnforceCooldown = NewPointer(true)
	}
}

// IsValid validates the AIRecapSettings
func (s *AIRecapSettings) IsValid() *AppError {
	if s.DefaultLimits != nil {
		if appErr := s.DefaultLimits.isValid(); appErr != nil {
			return appErr
		}
	}
	return nil
}
