// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

// recapTestConfig enables AI Recaps (must happen at setup time: SetupConfig
// unlocks feature-flag writes, which plain Setup keeps read-only), stops job
// workers so recaps stay in the status the API wrote, and defensively zeroes
// the manual cooldown so tests can create recaps back to back.
func recapTestConfig(cfg *model.Config) {
	cfg.FeatureFlags.EnableAIRecaps = true
	cfg.AIRecapSettings.DefaultLimits.CooldownMinutes = model.NewPointer(0)
	cfg.AIRecapSettings.DefaultLimits.MaxRecapsPerDay = model.NewPointer(10)
	cfg.JobSettings.RunJobs = model.NewPointer(false)
}

// withRecapsDisabled toggles the AI Recaps feature flag off for the duration
// of the callback.
func withRecapsDisabled(th *TestHelper, fn func()) {
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = false })
	defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })
	fn()
}

func TestCreateRecap(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	t.Run("feature disabled", func(t *testing.T) {
		withRecapsDisabled(th, func() {
			_, resp, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
				Title:      "My recap",
				ChannelIds: []string{th.BasicChannel.Id},
				AgentID:    model.NewId(),
			})
			require.Error(t, err)
			CheckNotImplementedStatus(t, resp)
		})
	})

	t.Run("invalid request bodies", func(t *testing.T) {
		for name, req := range map[string]*model.CreateRecapRequest{
			"missing channel ids": {Title: "My recap", AgentID: model.NewId()},
			"missing title":       {ChannelIds: []string{th.BasicChannel.Id}, AgentID: model.NewId()},
			"missing agent id":    {Title: "My recap", ChannelIds: []string{th.BasicChannel.Id}},
		} {
			t.Run(name, func(t *testing.T) {
				_, resp, err := th.Client.CreateRecap(context.Background(), req)
				require.Error(t, err)
				CheckBadRequestStatus(t, resp)
			})
		}
	})

	t.Run("channel the user cannot read", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.RemoveUserFromChannel(t, th.BasicUser, privateChannel)

		_, resp, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
			Title:      "My recap",
			ChannelIds: []string{privateChannel.Id},
			AgentID:    model.NewId(),
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("happy path", func(t *testing.T) {
		agentID := model.NewId()
		recap, resp, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
			Title:      "My recap",
			ChannelIds: []string{th.BasicChannel.Id},
			AgentID:    agentID,
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, recap)
		require.NotEmpty(t, recap.Id)
		require.Equal(t, th.BasicUser.Id, recap.UserId)
		require.Equal(t, "My recap", recap.Title)
		require.Equal(t, agentID, recap.BotID)
		require.Equal(t, model.RecapStatusPending, recap.Status)
	})
}

func TestGetRecap(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	created, _, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
		Title:      "My recap",
		ChannelIds: []string{th.BasicChannel.Id},
		AgentID:    model.NewId(),
	})
	require.NoError(t, err)

	t.Run("owner can fetch", func(t *testing.T) {
		recap, _, err := th.Client.GetRecap(context.Background(), created.Id)
		require.NoError(t, err)
		require.Equal(t, created.Id, recap.Id)
		require.Equal(t, created.Title, recap.Title)
	})

	t.Run("other user is forbidden", func(t *testing.T) {
		th.LoginBasic2(t)
		defer th.LoginBasic(t)

		_, resp, err := th.Client.GetRecap(context.Background(), created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unknown recap", func(t *testing.T) {
		_, resp, err := th.Client.GetRecap(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestGetRecaps(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	first, _, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
		Title:      "First recap",
		ChannelIds: []string{th.BasicChannel.Id},
		AgentID:    model.NewId(),
	})
	require.NoError(t, err)

	second, _, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
		Title:      "Second recap",
		ChannelIds: []string{th.BasicChannel.Id},
		AgentID:    model.NewId(),
	})
	require.NoError(t, err)

	t.Run("lists own recaps", func(t *testing.T) {
		recaps, _, err := th.Client.GetRecaps(context.Background(), 0, 10)
		require.NoError(t, err)

		ids := make([]string, 0, len(recaps))
		for _, recap := range recaps {
			require.Equal(t, th.BasicUser.Id, recap.UserId)
			ids = append(ids, recap.Id)
		}
		require.Contains(t, ids, first.Id)
		require.Contains(t, ids, second.Id)
	})

	t.Run("pagination", func(t *testing.T) {
		recaps, _, err := th.Client.GetRecaps(context.Background(), 0, 1)
		require.NoError(t, err)
		require.Len(t, recaps, 1)
	})

	t.Run("other user sees none of them", func(t *testing.T) {
		th.LoginBasic2(t)
		defer th.LoginBasic(t)

		recaps, _, err := th.Client.GetRecaps(context.Background(), 0, 10)
		require.NoError(t, err)
		require.Empty(t, recaps)
	})
}

func TestGetRecapLimitStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	status, _, err := th.Client.GetRecapLimitStatus(context.Background())
	require.NoError(t, err)
	require.NotNil(t, status)
	require.Equal(t, 10, status.EffectiveLimits.MaxRecapsPerDay)
	require.Equal(t, 0, status.Daily.Used)

	_, _, err = th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
		Title:      "My recap",
		ChannelIds: []string{th.BasicChannel.Id},
		AgentID:    model.NewId(),
	})
	require.NoError(t, err)

	status, _, err = th.Client.GetRecapLimitStatus(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, status.Daily.Used)
}

func TestMarkRecapReadAndViewed(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	created, _, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
		Title:      "My recap",
		ChannelIds: []string{th.BasicChannel.Id},
		AgentID:    model.NewId(),
	})
	require.NoError(t, err)

	t.Run("other user cannot mark read", func(t *testing.T) {
		th.LoginBasic2(t)
		defer th.LoginBasic(t)

		_, resp, err := th.Client.MarkRecapAsRead(context.Background(), created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("mark read", func(t *testing.T) {
		recap, _, err := th.Client.MarkRecapAsRead(context.Background(), created.Id)
		require.NoError(t, err)
		require.Greater(t, recap.ReadAt, int64(0))
	})

	t.Run("mark viewed", func(t *testing.T) {
		// Only completed/failed recaps get marked viewed; nothing processes
		// the pending recap in this harness, so complete it directly.
		require.NoError(t, th.App.Srv().Store().Recap().UpdateRecapStatus(created.Id, model.RecapStatusCompleted))

		viewed, _, err := th.Client.MarkRecapsAsViewed(context.Background())
		require.NoError(t, err)
		require.Contains(t, viewed.RecapIds, created.Id)

		recap, _, err := th.Client.GetRecap(context.Background(), created.Id)
		require.NoError(t, err)
		require.Greater(t, recap.ViewedAt, int64(0))
	})
}

func TestRegenerateRecap(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	created, _, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
		Title:      "My recap",
		ChannelIds: []string{th.BasicChannel.Id},
		AgentID:    model.NewId(),
	})
	require.NoError(t, err)

	t.Run("other user cannot regenerate", func(t *testing.T) {
		th.LoginBasic2(t)
		defer th.LoginBasic(t)

		_, resp, err := th.Client.RegenerateRecap(context.Background(), created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unknown recap", func(t *testing.T) {
		_, resp, err := th.Client.RegenerateRecap(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("owner can regenerate", func(t *testing.T) {
		recap, _, err := th.Client.RegenerateRecap(context.Background(), created.Id)
		require.NoError(t, err)
		require.Equal(t, created.Id, recap.Id)
		require.Equal(t, model.RecapStatusPending, recap.Status)
	})
}

func TestDeleteRecap(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	created, _, err := th.Client.CreateRecap(context.Background(), &model.CreateRecapRequest{
		Title:      "My recap",
		ChannelIds: []string{th.BasicChannel.Id},
		AgentID:    model.NewId(),
	})
	require.NoError(t, err)

	t.Run("other user cannot delete", func(t *testing.T) {
		th.LoginBasic2(t)
		defer th.LoginBasic(t)

		resp, err := th.Client.DeleteRecap(context.Background(), created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("owner can delete", func(t *testing.T) {
		_, err := th.Client.DeleteRecap(context.Background(), created.Id)
		require.NoError(t, err)

		_, resp, err := th.Client.GetRecap(context.Background(), created.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func newTestScheduledRecap(th *TestHelper) *model.ScheduledRecap {
	return &model.ScheduledRecap{
		Title:       "Morning recap",
		DaysOfWeek:  model.Weekdays,
		TimeOfDay:   "09:00",
		Timezone:    "UTC",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  model.StringArray{th.BasicChannel.Id},
		AgentId:     model.NewId(),
		IsRecurring: true,
	}
}

func TestCreateScheduledRecap(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	t.Run("feature disabled", func(t *testing.T) {
		withRecapsDisabled(th, func() {
			_, resp, err := th.Client.CreateScheduledRecap(context.Background(), newTestScheduledRecap(th))
			require.Error(t, err)
			CheckNotImplementedStatus(t, resp)
		})
	})

	t.Run("missing required fields", func(t *testing.T) {
		scheduledRecap := newTestScheduledRecap(th)
		scheduledRecap.TimeOfDay = ""

		_, resp, err := th.Client.CreateScheduledRecap(context.Background(), scheduledRecap)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("happy path", func(t *testing.T) {
		created, resp, err := th.Client.CreateScheduledRecap(context.Background(), newTestScheduledRecap(th))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, created.Id)
		require.Equal(t, th.BasicUser.Id, created.UserId)
		require.True(t, created.Enabled)
		require.Greater(t, created.NextRunAt, int64(0))
	})
}

func TestScheduledRecapLifecycle(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, recapTestConfig).InitBasic(t)

	created, _, err := th.Client.CreateScheduledRecap(context.Background(), newTestScheduledRecap(th))
	require.NoError(t, err)

	t.Run("get", func(t *testing.T) {
		fetched, _, err := th.Client.GetScheduledRecap(context.Background(), created.Id)
		require.NoError(t, err)
		require.Equal(t, created.Id, fetched.Id)
	})

	t.Run("list", func(t *testing.T) {
		scheduledRecaps, _, err := th.Client.GetScheduledRecaps(context.Background(), 0, 10)
		require.NoError(t, err)

		ids := make([]string, 0, len(scheduledRecaps))
		for _, scheduledRecap := range scheduledRecaps {
			ids = append(ids, scheduledRecap.Id)
		}
		require.Contains(t, ids, created.Id)
	})

	t.Run("update", func(t *testing.T) {
		updateRequest := newTestScheduledRecap(th)
		updateRequest.Id = created.Id
		updateRequest.Title = "Evening recap"
		updateRequest.TimeOfDay = "18:00"

		updated, _, err := th.Client.UpdateScheduledRecap(context.Background(), updateRequest)
		require.NoError(t, err)
		require.Equal(t, "Evening recap", updated.Title)
		require.Equal(t, "18:00", updated.TimeOfDay)
	})

	t.Run("pause and resume", func(t *testing.T) {
		paused, _, err := th.Client.PauseScheduledRecap(context.Background(), created.Id)
		require.NoError(t, err)
		require.False(t, paused.Enabled)

		resumed, _, err := th.Client.ResumeScheduledRecap(context.Background(), created.Id)
		require.NoError(t, err)
		require.True(t, resumed.Enabled)
	})

	t.Run("other user is forbidden", func(t *testing.T) {
		th.LoginBasic2(t)
		defer th.LoginBasic(t)

		_, resp, err := th.Client.GetScheduledRecap(context.Background(), created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		otherUserUpdate := newTestScheduledRecap(th)
		otherUserUpdate.Id = created.Id
		_, resp, err = th.Client.UpdateScheduledRecap(context.Background(), otherUserUpdate)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		resp, err = th.Client.DeleteScheduledRecap(context.Background(), created.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delete", func(t *testing.T) {
		_, err := th.Client.DeleteScheduledRecap(context.Background(), created.Id)
		require.NoError(t, err)

		_, resp, err := th.Client.GetScheduledRecap(context.Background(), created.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}
