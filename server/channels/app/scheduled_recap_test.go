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
		AgentId:     "test-agent",
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
		AgentId:     "test-agent",
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
		AgentId:     "test-agent",
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
		AgentId:     "test-agent",
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

func TestScheduledRecapCreateAndUpdateState(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)
	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

	recap := &model.ScheduledRecap{
		Title:       "Default Enabled Recap",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "09:00",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		AgentId:     "test-agent",
		Timezone:    "America/New_York",
		IsRecurring: true,
	}

	createdRecap, createErr := th.App.CreateScheduledRecap(ctx, recap)
	require.Nil(t, createErr)
	require.NotNil(t, createdRecap)
	assert.True(t, createdRecap.Enabled)

	lastRunAt := model.GetMillis()
	nextRunAt := lastRunAt + int64(time.Hour/time.Millisecond)
	require.NoError(t, th.App.Srv().Store().ScheduledRecap().MarkExecuted(createdRecap.Id, lastRunAt, nextRunAt))

	staleUpdate := &model.ScheduledRecap{
		Id:          createdRecap.Id,
		Title:       "Updated Without State Fields",
		DaysOfWeek:  model.Monday,
		TimeOfDay:   "10:00",
		TimePeriod:  model.TimePeriodLastWeek,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		AgentId:     "test-agent",
		Timezone:    "America/New_York",
		IsRecurring: true,
	}

	updatedRecap, updateErr := th.App.UpdateScheduledRecap(ctx, staleUpdate)
	require.Nil(t, updateErr)
	require.NotNil(t, updatedRecap)
	assert.Equal(t, "Updated Without State Fields", updatedRecap.Title)
	assert.True(t, updatedRecap.Enabled)
	assert.Equal(t, lastRunAt, updatedRecap.LastRunAt)
	assert.Equal(t, 1, updatedRecap.RunCount)
}

func TestCreateRecapFromScheduleAllUnreads(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceChannelsPerRecap = model.NewPointer(true)
		cfg.AIRecapSettings.DefaultLimits.MaxChannelsPerRecap = model.NewPointer(10)
	})

	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
	post := &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "unread for scheduled recap",
		CreateAt:  model.GetMillis(),
	}
	_, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	scheduledRecap := &model.ScheduledRecap{
		Id:                 model.NewId(),
		UserId:             th.BasicUser.Id,
		Title:              "All Unreads",
		DaysOfWeek:         model.EveryDay,
		TimeOfDay:          "09:00",
		TimePeriod:         model.TimePeriodLastWeek,
		ChannelMode:        model.ChannelModeAllUnreads,
		CustomInstructions: "Focus on launch risks",
		AgentId:            "test-agent",
		Timezone:           "America/New_York",
		IsRecurring:        true,
		Enabled:            true,
		CreateAt:           model.GetMillis(),
		UpdateAt:           model.GetMillis(),
	}

	recap, createErr := th.App.CreateRecapFromSchedule(th.Context, scheduledRecap)
	require.Nil(t, createErr)
	require.NotNil(t, recap)
	assert.Equal(t, scheduledRecap.Id, recap.ScheduledRecapId)
	assert.Equal(t, th.BasicUser.Id, recap.UserId)

	jobs, err := th.App.Srv().Store().Job().GetAllByTypeAndStatus(th.Context, model.JobTypeRecap, model.JobStatusPending)
	require.NoError(t, err)

	var recapJob *model.Job
	for _, job := range jobs {
		if job.Data["recap_id"] == recap.Id {
			recapJob = job
			break
		}
	}
	require.NotNil(t, recapJob)
	assert.Equal(t, model.TimePeriodLastWeek, recapJob.Data["time_period"])
	assert.Equal(t, "Focus on launch risks", recapJob.Data["custom_instructions"])
}

func TestCreateScheduledRecapMasterToggleDisabled(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.EnableAIRecaps = true
		cfg.AIRecapSettings.Enable = model.NewPointer(false)
	})

	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
	recap := &model.ScheduledRecap{
		Title:       "Disabled Recap",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "09:00",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		AgentId:     "test-agent",
		Timezone:    "America/New_York",
		IsRecurring: true,
	}

	createdRecap, createErr := th.App.CreateScheduledRecap(ctx, recap)
	require.NotNil(t, createErr)
	require.Nil(t, createdRecap)
	assert.Equal(t, "api.recap.disabled.app_error", createErr.Id)

	scheduledRecap := &model.ScheduledRecap{
		Id:          model.NewId(),
		UserId:      th.BasicUser.Id,
		Title:       "Disabled Execution",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "09:00",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		AgentId:     "test-agent",
		Timezone:    "America/New_York",
		IsRecurring: true,
		Enabled:     true,
	}
	createdFromSchedule, appErr := th.App.CreateRecapFromSchedule(th.Context, scheduledRecap)
	require.NotNil(t, appErr)
	require.Nil(t, createdFromSchedule)
	assert.Equal(t, "api.recap.disabled.app_error", appErr.Id)
}

func TestCreateScheduledRecapFeatureFlagDisabled(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.EnableAIRecaps = false
		cfg.AIRecapSettings.Enable = model.NewPointer(true)
	})

	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
	recap := &model.ScheduledRecap{
		Title:       "Disabled Recap",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "09:00",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		AgentId:     "test-agent",
		Timezone:    "America/New_York",
		IsRecurring: true,
	}

	createdRecap, createErr := th.App.CreateScheduledRecap(ctx, recap)
	require.NotNil(t, createErr)
	require.Nil(t, createdRecap)
	assert.Equal(t, "api.recap.disabled.app_error", createErr.Id)

	scheduledRecap := &model.ScheduledRecap{
		Id:          model.NewId(),
		UserId:      th.BasicUser.Id,
		Title:       "Disabled Execution",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "09:00",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{th.BasicChannel.Id},
		AgentId:     "test-agent",
		Timezone:    "America/New_York",
		IsRecurring: true,
		Enabled:     true,
	}
	createdFromSchedule, appErr := th.App.CreateRecapFromSchedule(th.Context, scheduledRecap)
	require.NotNil(t, appErr)
	require.Nil(t, createdFromSchedule)
	assert.Equal(t, "api.recap.disabled.app_error", appErr.Id)
}

func TestScheduledRecapChannelValidationAndDeduplication(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)
	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

	t.Run("create rejects channel without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		_ = th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		th.AddUserToChannel(t, th.BasicUser2, privateChannel)

		recap := &model.ScheduledRecap{
			Title:       "Restricted Recap",
			DaysOfWeek:  model.EveryDay,
			TimeOfDay:   "09:00",
			TimePeriod:  model.TimePeriodLast24h,
			ChannelMode: model.ChannelModeSpecific,
			ChannelIds:  []string{privateChannel.Id},
			AgentId:     "test-agent",
			Timezone:    "America/New_York",
			IsRecurring: true,
			Enabled:     true,
		}

		createdRecap, createErr := th.App.CreateScheduledRecap(ctx, recap)
		require.NotNil(t, createErr)
		require.Nil(t, createdRecap)
		assert.Equal(t, "app.recap.permission_denied", createErr.Id)
	})

	t.Run("update rejects channel without read permission", func(t *testing.T) {
		recap := &model.ScheduledRecap{
			Title:       "Valid Recap",
			DaysOfWeek:  model.EveryDay,
			TimeOfDay:   "09:00",
			TimePeriod:  model.TimePeriodLast24h,
			ChannelMode: model.ChannelModeSpecific,
			ChannelIds:  []string{th.BasicChannel.Id},
			AgentId:     "test-agent",
			Timezone:    "America/New_York",
			IsRecurring: true,
			Enabled:     true,
		}

		createdRecap, createErr := th.App.CreateScheduledRecap(ctx, recap)
		require.Nil(t, createErr)
		require.NotNil(t, createdRecap)

		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		_ = th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		th.AddUserToChannel(t, th.BasicUser2, privateChannel)

		createdRecap.ChannelIds = []string{privateChannel.Id}
		updatedRecap, updateErr := th.App.UpdateScheduledRecap(ctx, createdRecap)
		require.NotNil(t, updateErr)
		require.Nil(t, updatedRecap)
		assert.Equal(t, "app.recap.permission_denied", updateErr.Id)
	})

	t.Run("create deduplicates repeated channel ids before limit checks", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AIRecapSettings.EnforceChannelsPerRecap = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.MaxChannelsPerRecap = model.NewPointer(1)
		})

		recap := &model.ScheduledRecap{
			Title:       "Deduped Recap",
			DaysOfWeek:  model.EveryDay,
			TimeOfDay:   "09:00",
			TimePeriod:  model.TimePeriodLast24h,
			ChannelMode: model.ChannelModeSpecific,
			ChannelIds:  []string{th.BasicChannel.Id, th.BasicChannel.Id},
			AgentId:     "test-agent",
			Timezone:    "America/New_York",
			IsRecurring: true,
			Enabled:     true,
		}

		createdRecap, createErr := th.App.CreateScheduledRecap(ctx, recap)
		require.Nil(t, createErr)
		require.NotNil(t, createdRecap)
		assert.Equal(t, model.StringArray{th.BasicChannel.Id}, createdRecap.ChannelIds)
	})
}
