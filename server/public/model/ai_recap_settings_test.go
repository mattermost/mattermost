// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAIRecapSettingsSetDefaults(t *testing.T) {
	t.Run("sets all defaults on empty struct", func(t *testing.T) {
		s := &AIRecapSettings{}
		s.SetDefaults()

		// Master toggle
		require.NotNil(t, s.Enable)
		assert.True(t, *s.Enable)

		// Enforcement toggles - all should be true
		require.NotNil(t, s.EnforceRecapsPerDay)
		assert.True(t, *s.EnforceRecapsPerDay)
		require.NotNil(t, s.EnforceScheduledRecaps)
		assert.True(t, *s.EnforceScheduledRecaps)
		require.NotNil(t, s.EnforceChannelsPerRecap)
		assert.True(t, *s.EnforceChannelsPerRecap)
		require.NotNil(t, s.EnforcePostsPerRecap)
		assert.True(t, *s.EnforcePostsPerRecap)
		require.NotNil(t, s.EnforceTokensPerRecap)
		assert.True(t, *s.EnforceTokensPerRecap)
		require.NotNil(t, s.EnforcePostsPerDay)
		assert.True(t, *s.EnforcePostsPerDay)
		require.NotNil(t, s.EnforceCooldown)
		assert.True(t, *s.EnforceCooldown)

		// Default limits
		require.NotNil(t, s.DefaultLimits)
		require.NotNil(t, s.DefaultLimits.MaxRecapsPerDay)
		assert.Equal(t, 10, *s.DefaultLimits.MaxRecapsPerDay)
		require.NotNil(t, s.DefaultLimits.MaxScheduledRecaps)
		assert.Equal(t, 5, *s.DefaultLimits.MaxScheduledRecaps)
		require.NotNil(t, s.DefaultLimits.MaxChannelsPerRecap)
		assert.Equal(t, -1, *s.DefaultLimits.MaxChannelsPerRecap) // unlimited
		require.NotNil(t, s.DefaultLimits.MaxPostsPerRecap)
		assert.Equal(t, 500, *s.DefaultLimits.MaxPostsPerRecap)
		require.NotNil(t, s.DefaultLimits.MaxTokensPerRecap)
		assert.Equal(t, 100000, *s.DefaultLimits.MaxTokensPerRecap)
		require.NotNil(t, s.DefaultLimits.MaxPostsPerDay)
		assert.Equal(t, 5000, *s.DefaultLimits.MaxPostsPerDay)
		require.NotNil(t, s.DefaultLimits.CooldownMinutes)
		assert.Equal(t, 60, *s.DefaultLimits.CooldownMinutes)
	})
}

func TestRecapLimitSettingsValidation(t *testing.T) {
	t.Run("valid positive limits", func(t *testing.T) {
		s := &RecapLimitSettings{
			MaxRecapsPerDay:     NewPointer(10),
			MaxScheduledRecaps:  NewPointer(5),
			MaxChannelsPerRecap: NewPointer(3),
			MaxPostsPerRecap:    NewPointer(500),
			MaxTokensPerRecap:   NewPointer(100000),
			MaxPostsPerDay:      NewPointer(5000),
			CooldownMinutes:     NewPointer(60),
		}

		assert.Nil(t, s.isValid())
	})

	t.Run("valid unlimited (-1) values", func(t *testing.T) {
		s := &RecapLimitSettings{
			MaxRecapsPerDay:     NewPointer(-1),
			MaxScheduledRecaps:  NewPointer(-1),
			MaxChannelsPerRecap: NewPointer(-1),
			MaxPostsPerRecap:    NewPointer(-1),
			MaxTokensPerRecap:   NewPointer(-1),
			MaxPostsPerDay:      NewPointer(-1),
			CooldownMinutes:     NewPointer(0), // 0 = no cooldown
		}

		assert.Nil(t, s.isValid())
	})

	t.Run("valid cooldown of 0", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.CooldownMinutes = NewPointer(0)

		assert.Nil(t, s.isValid())
	})

	t.Run("invalid MaxRecapsPerDay = 0", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.MaxRecapsPerDay = NewPointer(0)

		err := s.isValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.max_recaps_per_day.app_error", err.Id)
	})

	t.Run("invalid MaxRecapsPerDay = -2 (only -1 allowed for unlimited)", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.MaxRecapsPerDay = NewPointer(-2)

		err := s.isValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.max_recaps_per_day.app_error", err.Id)
	})

	t.Run("invalid MaxScheduledRecaps = 0", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.MaxScheduledRecaps = NewPointer(0)

		err := s.isValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.max_scheduled_recaps.app_error", err.Id)
	})

	t.Run("invalid MaxChannelsPerRecap = 0", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.MaxChannelsPerRecap = NewPointer(0)

		err := s.isValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.max_channels_per_recap.app_error", err.Id)
	})

	t.Run("invalid MaxPostsPerRecap = 0", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.MaxPostsPerRecap = NewPointer(0)

		err := s.isValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.max_posts_per_recap.app_error", err.Id)
	})

	t.Run("invalid MaxTokensPerRecap = 0", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.MaxTokensPerRecap = NewPointer(0)

		err := s.isValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.max_tokens_per_recap.app_error", err.Id)
	})

	t.Run("invalid MaxPostsPerDay = 0", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.MaxPostsPerDay = NewPointer(0)

		err := s.isValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.max_posts_per_day.app_error", err.Id)
	})

	t.Run("invalid CooldownMinutes negative", func(t *testing.T) {
		s := &RecapLimitSettings{}
		s.SetDefaults()
		s.CooldownMinutes = NewPointer(-1)

		err := s.isValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.cooldown_minutes.app_error", err.Id)
	})
}

func TestAIRecapSettingsPreservesExistingValues(t *testing.T) {
	t.Run("preserves existing MaxRecapsPerDay", func(t *testing.T) {
		s := &AIRecapSettings{
			DefaultLimits: &RecapLimitSettings{
				MaxRecapsPerDay: NewPointer(20),
			},
		}
		s.SetDefaults()

		assert.Equal(t, 20, *s.DefaultLimits.MaxRecapsPerDay)
	})

	t.Run("preserves existing Enable value", func(t *testing.T) {
		s := &AIRecapSettings{
			Enable: NewPointer(false),
		}
		s.SetDefaults()

		assert.False(t, *s.Enable)
	})

	t.Run("preserves existing enforcement toggle", func(t *testing.T) {
		s := &AIRecapSettings{
			EnforceRecapsPerDay: NewPointer(false),
		}
		s.SetDefaults()

		assert.False(t, *s.EnforceRecapsPerDay)
		// Other toggles should be set to true (default)
		assert.True(t, *s.EnforceScheduledRecaps)
	})
}

func TestAIRecapSettingsIsValid(t *testing.T) {
	t.Run("valid with defaults", func(t *testing.T) {
		s := &AIRecapSettings{}
		s.SetDefaults()

		assert.Nil(t, s.IsValid())
	})

	t.Run("valid with nil DefaultLimits", func(t *testing.T) {
		s := &AIRecapSettings{
			Enable: NewPointer(true),
		}

		assert.Nil(t, s.IsValid())
	})

	t.Run("invalid if DefaultLimits are invalid", func(t *testing.T) {
		s := &AIRecapSettings{
			Enable: NewPointer(true),
			DefaultLimits: &RecapLimitSettings{
				MaxRecapsPerDay: NewPointer(0), // invalid
			},
		}

		err := s.IsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.ai_recap.max_recaps_per_day.app_error", err.Id)
	})
}
