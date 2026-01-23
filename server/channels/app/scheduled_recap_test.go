// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestScheduledRecap_OverLimitCanManageExisting verifies ENF-07: Users over limit
// can still manage their existing scheduled recaps. Limits only block creation,
// not view/edit/delete operations. This is "grandfathering" behavior.
func TestScheduledRecap_OverLimitCanManageExisting(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)

	// Set a very restrictive limit (1 scheduled recap max)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.EnforceScheduledRecaps = model.NewPointer(true)
		cfg.AIRecapSettings.DefaultLimits.MaxScheduledRecaps = model.NewPointer(1)
	})

	// Create a scheduled recap directly in the store (bypassing API limits)
	// to simulate user who already has scheduled recaps
	scheduledRecap := &model.ScheduledRecap{
		Id:          model.NewId(),
		UserId:      th.BasicUser.Id,
		Title:       "Existing Recap",
		DaysOfWeek:  model.EveryDay, // Run every day
		TimeOfDay:   "09:00",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		Timezone:    "America/New_York",
		IsRecurring: true,
		Enabled:     true,
		CreateAt:    model.GetMillis(),
		UpdateAt:    model.GetMillis(),
	}

	// Compute initial NextRunAt
	nextRunAt, err := scheduledRecap.ComputeNextRunAt(time.Now())
	require.NoError(t, err)
	scheduledRecap.NextRunAt = nextRunAt

	savedRecap, saveErr := th.App.Srv().Store().ScheduledRecap().Save(scheduledRecap)
	require.NoError(t, saveErr)
	require.NotNil(t, savedRecap)

	// Create a second scheduled recap to put user at/over limit
	secondRecap := &model.ScheduledRecap{
		Id:          model.NewId(),
		UserId:      th.BasicUser.Id,
		Title:       "Second Recap",
		DaysOfWeek:  model.Monday, // Run on Mondays
		TimeOfDay:   "10:30",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		Timezone:    "America/New_York",
		IsRecurring: true,
		Enabled:     true,
		CreateAt:    model.GetMillis(),
		UpdateAt:    model.GetMillis(),
	}
	nextRunAt2, err := secondRecap.ComputeNextRunAt(time.Now())
	require.NoError(t, err)
	secondRecap.NextRunAt = nextRunAt2

	_, saveErr = th.App.Srv().Store().ScheduledRecap().Save(secondRecap)
	require.NoError(t, saveErr)

	// User now has 2 scheduled recaps but limit is 1 - they are "over limit"

	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

	t.Run("over-limit user can view existing scheduled recap", func(t *testing.T) {
		// ENF-07: Get operations should NOT check limits
		fetchedRecap, getErr := th.App.GetScheduledRecap(ctx, savedRecap.Id)
		require.Nil(t, getErr, "GetScheduledRecap should succeed regardless of limits")
		require.NotNil(t, fetchedRecap)
		assert.Equal(t, savedRecap.Id, fetchedRecap.Id)
		assert.Equal(t, savedRecap.Title, fetchedRecap.Title)
	})

	t.Run("over-limit user can list existing scheduled recaps", func(t *testing.T) {
		// ENF-07: List operations should NOT check limits
		recaps, listErr := th.App.GetScheduledRecapsForUser(ctx, 0, 10)
		require.Nil(t, listErr, "GetScheduledRecapsForUser should succeed regardless of limits")
		require.NotNil(t, recaps)
		assert.Len(t, recaps, 2, "Should return all user's scheduled recaps")
	})

	t.Run("over-limit user can update existing scheduled recap", func(t *testing.T) {
		// ENF-07: Update operations should NOT check limits
		savedRecap.Title = "Updated Title By Over-Limit User"
		savedRecap.TimeOfDay = "14:00"

		updatedRecap, updateErr := th.App.UpdateScheduledRecap(ctx, savedRecap)
		require.Nil(t, updateErr, "UpdateScheduledRecap should succeed regardless of limits")
		require.NotNil(t, updatedRecap)
		assert.Equal(t, "Updated Title By Over-Limit User", updatedRecap.Title)
		assert.Equal(t, "14:00", updatedRecap.TimeOfDay)
	})

	t.Run("over-limit user can pause existing scheduled recap", func(t *testing.T) {
		// ENF-07: Pause operations should NOT check limits
		pausedRecap, pauseErr := th.App.PauseScheduledRecap(ctx, savedRecap.Id)
		require.Nil(t, pauseErr, "PauseScheduledRecap should succeed regardless of limits")
		require.NotNil(t, pausedRecap)
		assert.False(t, pausedRecap.Enabled)
	})

	t.Run("over-limit user can resume existing scheduled recap", func(t *testing.T) {
		// ENF-07: Resume operations should NOT check limits
		resumedRecap, resumeErr := th.App.ResumeScheduledRecap(ctx, savedRecap.Id)
		require.Nil(t, resumeErr, "ResumeScheduledRecap should succeed regardless of limits")
		require.NotNil(t, resumedRecap)
		assert.True(t, resumedRecap.Enabled)
	})

	t.Run("over-limit user can delete existing scheduled recap", func(t *testing.T) {
		// ENF-07: Delete operations should NOT check limits
		// Deleting allows user to get back under limit
		deleteErr := th.App.DeleteScheduledRecap(ctx, savedRecap.Id)
		require.Nil(t, deleteErr, "DeleteScheduledRecap should succeed regardless of limits")
		// Note: Soft delete - record still exists but has DeleteAt set
	})
}

// TestRecap_OverLimitCanManageExisting verifies ENF-07: Users over limit
// can still manage their existing recaps. Limits only block creation,
// not view/list/delete operations.
func TestRecap_OverLimitCanManageExisting(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)

	// Set restrictive limits (doesn't matter - management ops ignore limits)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(true)
		cfg.AIRecapSettings.DefaultLimits.MaxRecapsPerDay = model.NewPointer(1)
		cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(true)
		cfg.AIRecapSettings.DefaultLimits.CooldownMinutes = model.NewPointer(999)
	})

	// Create recap directly in store (bypassing API limits)
	recap := &model.Recap{
		Id:                model.NewId(),
		UserId:            th.BasicUser.Id,
		Title:             "Existing Recap",
		CreateAt:          model.GetMillis(),
		UpdateAt:          model.GetMillis(),
		DeleteAt:          0,
		ReadAt:            0,
		TotalMessageCount: 25,
		Status:            model.RecapStatusCompleted,
	}

	savedRecap, saveErr := th.App.Srv().Store().Recap().SaveRecap(recap)
	require.NoError(t, saveErr)
	require.NotNil(t, savedRecap)

	// Create recap channel for complete data
	recapChannel := &model.RecapChannel{
		Id:            model.NewId(),
		RecapId:       recap.Id,
		ChannelId:     th.BasicChannel.Id,
		ChannelName:   th.BasicChannel.DisplayName,
		Highlights:    []string{"Test highlight 1", "Test highlight 2"},
		ActionItems:   []string{"Action item 1"},
		SourcePostIds: []string{model.NewId(), model.NewId()},
		CreateAt:      model.GetMillis(),
	}
	err := th.App.Srv().Store().Recap().SaveRecapChannel(recapChannel)
	require.NoError(t, err)

	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

	t.Run("over-limit user can view existing recap", func(t *testing.T) {
		// ENF-07: Get operations should NOT check limits
		fetchedRecap, getErr := th.App.GetRecap(ctx, recap.Id)
		require.Nil(t, getErr, "GetRecap should succeed regardless of limits")
		require.NotNil(t, fetchedRecap)
		assert.Equal(t, recap.Id, fetchedRecap.Id)
		assert.Equal(t, recap.Title, fetchedRecap.Title)
		assert.Len(t, fetchedRecap.Channels, 1)
	})

	t.Run("over-limit user can list existing recaps", func(t *testing.T) {
		// ENF-07: List operations should NOT check limits
		recaps, listErr := th.App.GetRecapsForUser(ctx, 0, 10)
		require.Nil(t, listErr, "GetRecapsForUser should succeed regardless of limits")
		require.NotNil(t, recaps)
		assert.GreaterOrEqual(t, len(recaps), 1)
	})

	t.Run("over-limit user can mark recap as read", func(t *testing.T) {
		// ENF-07: Mark read operations should NOT check limits
		readRecap, markErr := th.App.MarkRecapAsRead(ctx, savedRecap)
		require.Nil(t, markErr, "MarkRecapAsRead should succeed regardless of limits")
		require.NotNil(t, readRecap)
		assert.Greater(t, readRecap.ReadAt, int64(0))
	})

	t.Run("over-limit user can delete existing recap", func(t *testing.T) {
		// ENF-07: Delete operations should NOT check limits
		// Deleting allows user to get back under limit
		deleteErr := th.App.DeleteRecap(ctx, recap.Id)
		require.Nil(t, deleteErr, "DeleteRecap should succeed regardless of limits")
	})
}

// TestScheduledRecap_CreateBlockedWhenOverLimit verifies that while management
// operations succeed for over-limit users, creation IS still blocked.
// This confirms limits work correctly for creation while allowing management.
func TestScheduledRecap_CreateBlockedWhenOverLimit(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)

	// Set limit to 1 scheduled recap
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.EnforceScheduledRecaps = model.NewPointer(true)
		cfg.AIRecapSettings.DefaultLimits.MaxScheduledRecaps = model.NewPointer(1)
	})

	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

	// Create first scheduled recap (should succeed)
	firstRecap := &model.ScheduledRecap{
		Title:       "First Recap",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "09:00",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		Timezone:    "America/New_York",
		IsRecurring: true,
		Enabled:     true,
	}

	createdRecap, createErr := th.App.CreateScheduledRecap(ctx, firstRecap)
	require.Nil(t, createErr, "First scheduled recap should be created successfully")
	require.NotNil(t, createdRecap)

	// Try to create second scheduled recap (should fail - over limit)
	secondRecap := &model.ScheduledRecap{
		Title:       "Second Recap",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "10:00",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		Timezone:    "America/New_York",
		IsRecurring: true,
		Enabled:     true,
	}

	_, createErr = th.App.CreateScheduledRecap(ctx, secondRecap)
	require.NotNil(t, createErr, "Second scheduled recap should be blocked by limit")
	assert.Equal(t, "app.scheduled_recap.max_scheduled_reached.app_error", createErr.Id)

	// But user can still update and delete their existing recap
	createdRecap.Title = "Updated Title"
	updatedRecap, updateErr := th.App.UpdateScheduledRecap(ctx, createdRecap)
	require.Nil(t, updateErr, "Update should succeed for over-limit user")
	assert.Equal(t, "Updated Title", updatedRecap.Title)
}
