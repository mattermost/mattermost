// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// UnlimitedValue is the sentinel value indicating a limit is disabled/unlimited
const UnlimitedValue = -1

// LimitSource indicates where the effective limits originated from
type LimitSource string

const (
	LimitSourceSystem LimitSource = "system"
	LimitSourceGroup  LimitSource = "group"
	LimitSourceUser   LimitSource = "user"
)

// EffectiveRecapLimits contains resolved limit values for a user.
// These are non-pointer fields because resolution has already happened.
// A value of -1 (UnlimitedValue) means the limit is disabled/unlimited.
type EffectiveRecapLimits struct {
	// Resolved limit values (-1 = unlimited/disabled)
	MaxRecapsPerDay     int `json:"max_recaps_per_day"`
	MaxScheduledRecaps  int `json:"max_scheduled_recaps"`
	MaxChannelsPerRecap int `json:"max_channels_per_recap"`
	MaxPostsPerRecap    int `json:"max_posts_per_recap"`
	MaxTokensPerRecap   int `json:"max_tokens_per_recap"`
	MaxPostsPerDay      int `json:"max_posts_per_day"`
	CooldownMinutes     int `json:"cooldown_minutes"`

	// Source tracking (for debugging/UI display)
	Source   LimitSource `json:"source"`    // Where limits came from
	SourceID string      `json:"source_id"` // Group ID or User ID if overridden, empty for system
}

// IsLimitEnabled returns true if the given limit value is enabled (not unlimited).
// Useful for enforcement code to check if a limit should be enforced.
func IsLimitEnabled(limitValue int) bool {
	return limitValue != UnlimitedValue
}
