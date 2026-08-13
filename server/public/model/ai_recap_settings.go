// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

const (
	RecapProcessingDefaultMaxConcurrentJobs      = 4
	RecapProcessingDefaultMaxConcurrentLLMCalls  = 16
	RecapProcessingDefaultMaxDueSchedulesPerTick = 1000
)

// RecapLimitSettings configures the limits for AI Recaps
type RecapLimitSettings struct {
	MaxRecapsPerDay     *int `access:"ai_recaps"` // Default: 10, -1 = unlimited
	MaxScheduledRecaps  *int `access:"ai_recaps"` // Default: 5, -1 = unlimited
	MaxChannelsPerRecap *int `access:"ai_recaps"` // Default: -1 (unlimited)
	MaxPostsPerRecap    *int `access:"ai_recaps"` // Default: 500, -1 = unlimited
	MaxTokensPerRecap   *int `access:"ai_recaps"` // Default: 100000, -1 = unlimited
	MaxPostsPerDay      *int `access:"ai_recaps"` // Default: 5000, -1 = unlimited
	CooldownMinutes     *int `access:"ai_recaps"` // Default: 60, 0 = no cooldown
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

// RecapProcessingSettings configures server-side processing of recap jobs.
type RecapProcessingSettings struct {
	// MaxConcurrentJobs is the size of each recap-related job worker pool on a
	// server node. Takes effect when the workers restart.
	MaxConcurrentJobs *int `access:"ai_recaps"` // Default: 4, minimum 1

	// MaxConcurrentLLMCalls caps in-flight LLM channel-summarization calls per
	// node across all recap jobs. Declared now; consumed in a later phase.
	MaxConcurrentLLMCalls *int `access:"ai_recaps"` // Default: 16, minimum 1

	// MaxDueSchedulesPerTick caps how many due scheduled recaps are enqueued
	// per scheduler tick. Declared now; consumed in a later phase.
	MaxDueSchedulesPerTick *int `access:"ai_recaps"` // Default: 1000, minimum 1
}

// MaxConcurrentJobsOrDefault returns the configured worker pool size, falling
// back to the default and enforcing the runtime minimum.
func (s *RecapProcessingSettings) MaxConcurrentJobsOrDefault() int {
	if s == nil || s.MaxConcurrentJobs == nil {
		return RecapProcessingDefaultMaxConcurrentJobs
	}
	return max(*s.MaxConcurrentJobs, 1)
}

// MaxConcurrentLLMCallsOrDefault returns the configured per-node LLM call
// limit, falling back to the default and enforcing the runtime minimum.
func (s *RecapProcessingSettings) MaxConcurrentLLMCallsOrDefault() int {
	if s == nil || s.MaxConcurrentLLMCalls == nil {
		return RecapProcessingDefaultMaxConcurrentLLMCalls
	}
	return max(*s.MaxConcurrentLLMCalls, 1)
}

// MaxDueSchedulesPerTickOrDefault returns the configured per-tick enqueue cap,
// falling back to the default and enforcing the runtime minimum.
func (s *RecapProcessingSettings) MaxDueSchedulesPerTickOrDefault() int {
	if s == nil || s.MaxDueSchedulesPerTick == nil {
		return RecapProcessingDefaultMaxDueSchedulesPerTick
	}
	return max(*s.MaxDueSchedulesPerTick, 1)
}

// SetDefaults sets the default values for RecapProcessingSettings
func (s *RecapProcessingSettings) SetDefaults() {
	if s.MaxConcurrentJobs == nil {
		s.MaxConcurrentJobs = NewPointer(RecapProcessingDefaultMaxConcurrentJobs)
	}
	if s.MaxConcurrentLLMCalls == nil {
		s.MaxConcurrentLLMCalls = NewPointer(RecapProcessingDefaultMaxConcurrentLLMCalls)
	}
	if s.MaxDueSchedulesPerTick == nil {
		s.MaxDueSchedulesPerTick = NewPointer(RecapProcessingDefaultMaxDueSchedulesPerTick)
	}
}

// isValid validates the RecapProcessingSettings. Unlike RecapLimitSettings,
// these knobs have no unlimited (-1) value; the floor is always 1.
func (s *RecapProcessingSettings) isValid() *AppError {
	if s.MaxConcurrentJobs != nil && *s.MaxConcurrentJobs < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_concurrent_jobs.app_error", nil, "", http.StatusBadRequest)
	}
	if s.MaxConcurrentLLMCalls != nil && *s.MaxConcurrentLLMCalls < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_concurrent_llm_calls.app_error", nil, "", http.StatusBadRequest)
	}
	if s.MaxDueSchedulesPerTick != nil && *s.MaxDueSchedulesPerTick < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ai_recap.max_due_schedules_per_tick.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// AIRecapSettings configures the AI Recap feature limits
type AIRecapSettings struct {
	Enable *bool `access:"ai_recaps"` // Master toggle, default: true

	// System-wide default limits
	DefaultLimits *RecapLimitSettings `access:"ai_recaps"`

	// Server-side processing configuration
	Processing *RecapProcessingSettings `access:"ai_recaps"`

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

	if s.Processing == nil {
		s.Processing = &RecapProcessingSettings{}
	}
	s.Processing.SetDefaults()

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

// IsEnabled reports whether the admin AI Recaps master toggle is enabled.
func (s *AIRecapSettings) IsEnabled() bool {
	return s == nil || s.Enable == nil || *s.Enable
}

// AIRecapsEnabled reports whether AI Recaps are enabled by both feature flag and admin config.
func (o *Config) AIRecapsEnabled() bool {
	return o != nil && o.FeatureFlags.EnableAIRecaps && o.AIRecapSettings.IsEnabled()
}

// IsValid validates the AIRecapSettings
func (s *AIRecapSettings) IsValid() *AppError {
	if s.DefaultLimits != nil {
		if appErr := s.DefaultLimits.isValid(); appErr != nil {
			return appErr
		}
	}
	if s.Processing != nil {
		if appErr := s.Processing.isValid(); appErr != nil {
			return appErr
		}
	}
	return nil
}
