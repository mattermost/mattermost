// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateRecap(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")

	th := Setup(t).InitBasic(t)

	// Enable AI Recaps feature flag
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

	t.Run("create recap with valid channels", func(t *testing.T) {
		channel2 := th.CreateChannel(t, th.BasicTeam)
		channelIds := []string{th.BasicChannel.Id, channel2.Id}

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recap, err := th.App.CreateRecap(ctx, "My Test Recap", channelIds, "test-agent-id")
		require.Nil(t, err)
		require.NotNil(t, recap)
		assert.Equal(t, th.BasicUser.Id, recap.UserId)
		assert.Equal(t, model.RecapStatusPending, recap.Status)
		assert.Equal(t, "My Test Recap", recap.Title)
	})

	t.Run("create recap with channel user is not member of", func(t *testing.T) {
		// Create a private channel and add only BasicUser2
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		// Remove BasicUser if they were added automatically
		_ = th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		// Ensure BasicUser2 is a member instead
		th.AddUserToChannel(t, th.BasicUser2, privateChannel)

		// Try to create recap as BasicUser who is not a member
		channelIds := []string{privateChannel.Id}
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recap, err := th.App.CreateRecap(ctx, "Test Recap", channelIds, "test-agent-id")
		require.NotNil(t, err)
		assert.Nil(t, recap)
		assert.Equal(t, "app.recap.permission_denied", err.Id)
	})

	t.Run("cooldown error rounds up remaining minutes", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.CooldownMinutes = model.NewPointer(2)
		})

		// Place the last recap 1s ago so the remaining cooldown sits near the top of the
		// 2-minute band (~119s). This still exercises ceiling rounding while leaving ~59s of
		// slack, so a slow/loaded CI run can't flip the rounded value down to "1 minute".
		lastCreateAt := model.GetMillis() - int64(1*1000)
		lastManualRecap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Completed Recap",
			CreateAt:          lastCreateAt,
			UpdateAt:          lastCreateAt,
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 1,
			Status:            model.RecapStatusCompleted,
			BotID:             "test-agent-id",
		}
		_, saveErr := th.App.Srv().Store().Recap().SaveRecap(lastManualRecap)
		require.NoError(t, saveErr)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recap, err := th.App.CreateRecap(ctx, "Cooldown Recap", []string{th.BasicChannel.Id}, "test-agent-id")
		require.NotNil(t, err)
		require.Nil(t, recap)
		assert.Equal(t, "app.recap.cooldown_active.app_error", err.Id)
		assert.Contains(t, err.SystemMessage(i18n.GetUserTranslations("en")), "another recap in 2 minutes")
	})

	t.Run("cooldown still applies after soft deleting last recap", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.CooldownMinutes = model.NewPointer(2)
		})

		lastCreateAt := model.GetMillis() - int64(30*1000)
		lastManualRecap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Soft Deleted Completed Recap",
			CreateAt:          lastCreateAt,
			UpdateAt:          lastCreateAt,
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 1,
			Status:            model.RecapStatusCompleted,
			BotID:             "test-agent-id",
		}
		_, saveErr := th.App.Srv().Store().Recap().SaveRecap(lastManualRecap)
		require.NoError(t, saveErr)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		deleteErr := th.App.DeleteRecap(ctx, lastManualRecap.Id)
		require.Nil(t, deleteErr)

		recap, err := th.App.CreateRecap(ctx, "Cooldown Recap", []string{th.BasicChannel.Id}, "test-agent-id")
		require.NotNil(t, err)
		require.Nil(t, recap)
		assert.Equal(t, "app.recap.cooldown_active.app_error", err.Id)
	})

	t.Run("create recap blocked by max channels per recap", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AIRecapSettings.EnforceChannelsPerRecap = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.MaxChannelsPerRecap = model.NewPointer(1)
		})

		channel2 := th.CreateChannel(t, th.BasicTeam)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recap, err := th.App.CreateRecap(ctx, "Too Many Channels", []string{th.BasicChannel.Id, channel2.Id}, "test-agent-id")
		require.NotNil(t, err)
		require.Nil(t, recap)
		assert.Equal(t, "app.recap.max_channels_exceeded.app_error", err.Id)
	})

	t.Run("create recap blocked by max recaps per day", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.MaxRecapsPerDay = model.NewPointer(1)
			cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(false)
		})

		existingRecap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Existing Today",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 1,
			Status:            model.RecapStatusCompleted,
			BotID:             "test-agent-id",
		}
		_, saveErr := th.App.Srv().Store().Recap().SaveRecap(existingRecap)
		require.NoError(t, saveErr)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recap, err := th.App.CreateRecap(ctx, "Daily Limit Recap", []string{th.BasicChannel.Id}, "test-agent-id")
		require.NotNil(t, err)
		require.Nil(t, recap)
		assert.Equal(t, "app.recap.max_recaps_reached.app_error", err.Id)
	})
}

func TestCreateRecapMasterToggleDisabledBlocksCreation(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.EnableAIRecaps = true
		cfg.AIRecapSettings.Enable = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(true)
		cfg.AIRecapSettings.DefaultLimits.MaxRecapsPerDay = model.NewPointer(1)
		cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(true)
		cfg.AIRecapSettings.DefaultLimits.CooldownMinutes = model.NewPointer(60)
	})

	existingRecap := &model.Recap{
		Id:                model.NewId(),
		UserId:            th.BasicUser.Id,
		Title:             "Existing Today",
		CreateAt:          model.GetMillis(),
		UpdateAt:          model.GetMillis(),
		TotalMessageCount: 1,
		Status:            model.RecapStatusCompleted,
		BotID:             "test-agent-id",
	}
	_, saveErr := th.App.Srv().Store().Recap().SaveRecap(existingRecap)
	require.NoError(t, saveErr)

	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
	recap, appErr := th.App.CreateRecap(ctx, "Blocked Recap", []string{th.BasicChannel.Id}, "test-agent-id")
	require.NotNil(t, appErr)
	require.Nil(t, recap)
	assert.Equal(t, "api.recap.disabled.app_error", appErr.Id)
}

func TestCreateRecapFeatureFlagDisabledBlocksCreation(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.EnableAIRecaps = false
		cfg.AIRecapSettings.Enable = model.NewPointer(true)
	})

	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
	recap, appErr := th.App.CreateRecap(ctx, "Blocked Recap", []string{th.BasicChannel.Id}, "test-agent-id")
	require.NotNil(t, appErr)
	require.Nil(t, recap)
	assert.Equal(t, "api.recap.disabled.app_error", appErr.Id)
}

func TestGetRecap(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Enable AI Recaps feature flag
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

	t.Run("get recap by owner", func(t *testing.T) {
		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Test Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
		}

		_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		// Create recap channel
		recapChannel := &model.RecapChannel{
			Id:            model.NewId(),
			RecapId:       recap.Id,
			ChannelId:     th.BasicChannel.Id,
			ChannelName:   th.BasicChannel.DisplayName,
			Highlights:    []string{"Test highlight"},
			ActionItems:   []string{"Test action"},
			SourcePostIds: []string{model.NewId()},
			CreateAt:      model.GetMillis(),
		}

		err = th.App.Srv().Store().Recap().SaveRecapChannel(recapChannel)
		require.NoError(t, err)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		retrievedRecap, appErr := th.App.GetRecap(ctx, recap.Id)
		require.Nil(t, appErr)
		require.NotNil(t, retrievedRecap)
		assert.Equal(t, recap.Id, retrievedRecap.Id)
		assert.Len(t, retrievedRecap.Channels, 1)
		assert.Equal(t, recapChannel.ChannelName, retrievedRecap.Channels[0].ChannelName)
	})

	t.Run("get recap by non-owner", func(t *testing.T) {
		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Test Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
		}

		_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		// Try to get as a different user - create context with BasicUser2's session
		ctx := request.TestContext(t).WithSession(&model.Session{UserId: th.BasicUser2.Id})
		retrievedRecap, appErr := th.App.GetRecap(ctx, recap.Id)
		// Permissions are now checked in API layer, so App layer should return the recap
		require.Nil(t, appErr)
		require.NotNil(t, retrievedRecap)
		assert.Equal(t, recap.Id, retrievedRecap.Id)
	})
}

func TestGetRecapsForUser(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Enable AI Recaps feature flag
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

	t.Run("get recaps for user", func(t *testing.T) {
		// Create multiple recaps for the user
		for range 5 {
			recap := &model.Recap{
				Id:                model.NewId(),
				UserId:            th.BasicUser.Id,
				Title:             "Test Recap",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				DeleteAt:          0,
				ReadAt:            0,
				TotalMessageCount: 10,
				Status:            model.RecapStatusCompleted,
			}

			_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
			require.NoError(t, err)
		}

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recaps, err := th.App.GetRecapsForUser(ctx, 0, 10)
		require.Nil(t, err)
		assert.Len(t, recaps, 5)
	})

	t.Run("pagination works correctly", func(t *testing.T) {
		userId := model.NewId()

		// Create context with the test user's session
		ctx := request.TestContext(t).WithSession(&model.Session{UserId: userId})

		// Create 15 recaps
		for range 15 {
			recap := &model.Recap{
				Id:                model.NewId(),
				UserId:            userId,
				Title:             "Test Recap",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				DeleteAt:          0,
				ReadAt:            0,
				TotalMessageCount: 10,
				Status:            model.RecapStatusCompleted,
			}

			_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
			require.NoError(t, err)
		}

		// Get first page
		recapsPage1, err := th.App.GetRecapsForUser(ctx, 0, 10)
		require.Nil(t, err)
		assert.Len(t, recapsPage1, 10)

		// Get second page
		recapsPage2, err := th.App.GetRecapsForUser(ctx, 1, 10)
		require.Nil(t, err)
		assert.Len(t, recapsPage2, 5)
	})
}

func TestMarkRecapAsRead(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Enable AI Recaps feature flag
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

	t.Run("mark recap as read by owner", func(t *testing.T) {
		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Test Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
		}

		savedRecap, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		// Mark as read
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		updatedRecap, appErr := th.App.MarkRecapAsRead(ctx, savedRecap)
		require.Nil(t, appErr)
		require.NotNil(t, updatedRecap)
		assert.Greater(t, updatedRecap.ReadAt, int64(0))
	})

	t.Run("mark recap as read by non-owner", func(t *testing.T) {
		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Test Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
		}

		savedRecap, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		// Try to mark as read as a different user - create context with BasicUser2's session
		ctx := request.TestContext(t).WithSession(&model.Session{UserId: th.BasicUser2.Id})
		updatedRecap, appErr := th.App.MarkRecapAsRead(ctx, savedRecap)
		// Permissions are now checked in API layer, so App layer should allow it
		require.Nil(t, appErr)
		require.NotNil(t, updatedRecap)
		assert.Greater(t, updatedRecap.ReadAt, int64(0))
	})
}

func TestRegenerateRecapLimitEnforcement(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLEAIRECAPS")

	th := Setup(t).InitBasic(t)

	t.Run("regenerate recap blocked by max recaps per day", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.MaxRecapsPerDay = model.NewPointer(1)
			cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(false)
		})

		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Existing Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
			BotID:             "test-agent-id",
		}
		_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		recapChannel := &model.RecapChannel{
			Id:            model.NewId(),
			RecapId:       recap.Id,
			ChannelId:     th.BasicChannel.Id,
			ChannelName:   th.BasicChannel.DisplayName,
			Highlights:    []string{"highlight"},
			ActionItems:   []string{"action"},
			SourcePostIds: []string{model.NewId()},
			CreateAt:      model.GetMillis(),
		}
		err = th.App.Srv().Store().Recap().SaveRecapChannel(recapChannel)
		require.NoError(t, err)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		regenerated, appErr := th.App.RegenerateRecap(ctx, th.BasicUser.Id, recap)
		require.NotNil(t, appErr)
		require.Nil(t, regenerated)
		assert.Equal(t, "app.recap.max_recaps_reached.app_error", appErr.Id)
	})

	t.Run("regenerate recap blocked by cooldown", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(false)
			cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.CooldownMinutes = model.NewPointer(60)
		})

		recap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Cooldown Existing Recap",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			DeleteAt:          0,
			ReadAt:            0,
			TotalMessageCount: 10,
			Status:            model.RecapStatusCompleted,
			BotID:             "test-agent-id",
		}
		_, err := th.App.Srv().Store().Recap().SaveRecap(recap)
		require.NoError(t, err)

		recapChannel := &model.RecapChannel{
			Id:            model.NewId(),
			RecapId:       recap.Id,
			ChannelId:     th.BasicChannel.Id,
			ChannelName:   th.BasicChannel.DisplayName,
			Highlights:    []string{"highlight"},
			ActionItems:   []string{"action"},
			SourcePostIds: []string{model.NewId()},
			CreateAt:      model.GetMillis(),
		}
		err = th.App.Srv().Store().Recap().SaveRecapChannel(recapChannel)
		require.NoError(t, err)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		regenerated, appErr := th.App.RegenerateRecap(ctx, th.BasicUser.Id, recap)
		require.NotNil(t, appErr)
		require.Nil(t, regenerated)
		assert.Equal(t, "app.recap.cooldown_active.app_error", appErr.Id)
	})
}

func TestMarkRecapsAsViewed(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

	save := func(userID, status string, viewedAt int64) string {
		r := &model.Recap{
			Id:                model.NewId(),
			UserId:            userID,
			Title:             "T",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			Status:            status,
			ViewedAt:          viewedAt,
			TotalMessageCount: 1,
		}
		_, err := th.App.Srv().Store().Recap().SaveRecap(r)
		require.NoError(t, err)
		return r.Id
	}

	t.Run("marks completed and failed and ignores in-flight statuses", func(t *testing.T) {
		userID := model.NewId()
		completed := save(userID, model.RecapStatusCompleted, 0)
		failed := save(userID, model.RecapStatusFailed, 0)
		pending := save(userID, model.RecapStatusPending, 0)
		processing := save(userID, model.RecapStatusProcessing, 0)

		ctx := th.Context.WithSession(&model.Session{UserId: userID})
		ids, appErr := th.App.MarkRecapsAsViewed(ctx)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, []string{completed, failed}, ids)

		r1, err := th.App.Srv().Store().Recap().GetRecap(pending)
		require.NoError(t, err)
		assert.Zero(t, r1.ViewedAt)
		r2, err := th.App.Srv().Store().Recap().GetRecap(processing)
		require.NoError(t, err)
		assert.Zero(t, r2.ViewedAt)
	})

	t.Run("returns empty list when nothing to mark", func(t *testing.T) {
		ctx := th.Context.WithSession(&model.Session{UserId: model.NewId()})
		ids, appErr := th.App.MarkRecapsAsViewed(ctx)
		require.Nil(t, appErr)
		assert.Empty(t, ids)
	})

	t.Run("publishes a recap_updated websocket event per affected recap", func(t *testing.T) {
		userID := th.BasicUser.Id

		// Two completed recaps that need to be marked as viewed.
		a := save(userID, model.RecapStatusCompleted, 0)
		b := save(userID, model.RecapStatusCompleted, 0)

		messages, closeWS := connectFakeWebSocket(t, th, userID, "", []model.WebsocketEventType{model.WebsocketEventRecapUpdated})
		defer closeWS()

		ctx := th.Context.WithSession(&model.Session{UserId: userID})
		ids, appErr := th.App.MarkRecapsAsViewed(ctx)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, []string{a, b}, ids)

		seen := make(map[string]bool)
		deadline := time.After(5 * time.Second)
		for len(seen) < 2 {
			select {
			case msg := <-messages:
				recapID, ok := msg.GetData()["recap_id"].(string)
				require.True(t, ok, "recap_updated event missing recap_id")
				seen[recapID] = true
			case <-deadline:
				require.Failf(t, "timed out waiting for recap_updated events", "received %d/2", len(seen))
			}
		}
		assert.True(t, seen[a])
		assert.True(t, seen[b])
	})
}

func TestNewRecapPostBudgetForUser(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")

	tests := []struct {
		name                 string
		enforcePostsPerRecap bool
		maxPostsPerRecap     int
		enforcePostsPerDay   bool
		maxPostsPerDay       int
		usedToday            int
		usageStatus          string
		wantReservations     []int
	}{
		{
			name:                 "min of per-recap and per-day",
			enforcePostsPerRecap: true,
			maxPostsPerRecap:     500,
			enforcePostsPerDay:   true,
			maxPostsPerDay:       10,
			usedToday:            4,
			usageStatus:          model.RecapStatusCompleted,
			wantReservations:     []int{6},
		},
		{
			name:                 "per-recap binds when per-day disabled",
			enforcePostsPerRecap: true,
			maxPostsPerRecap:     50,
			enforcePostsPerDay:   false,
			maxPostsPerDay:       10,
			wantReservations:     []int{50},
		},
		{
			name:                 "unlimited when both disabled",
			enforcePostsPerRecap: false,
			maxPostsPerRecap:     50,
			enforcePostsPerDay:   false,
			maxPostsPerDay:       10,
			wantReservations:     []int{100, 100},
		},
		{
			name:                 "skipped recaps do not count",
			enforcePostsPerRecap: false,
			maxPostsPerRecap:     500,
			enforcePostsPerDay:   true,
			maxPostsPerDay:       10,
			usedToday:            9,
			usageStatus:          model.RecapStatusSkipped,
			wantReservations:     []int{10},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			th := Setup(t).InitBasic(t)
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.FeatureFlags.EnableAIRecaps = true
				cfg.AIRecapSettings.EnforcePostsPerRecap = model.NewPointer(tt.enforcePostsPerRecap)
				cfg.AIRecapSettings.DefaultLimits.MaxPostsPerRecap = model.NewPointer(tt.maxPostsPerRecap)
				cfg.AIRecapSettings.EnforcePostsPerDay = model.NewPointer(tt.enforcePostsPerDay)
				cfg.AIRecapSettings.DefaultLimits.MaxPostsPerDay = model.NewPointer(tt.maxPostsPerDay)
			})

			if tt.usedToday > 0 {
				now := model.GetMillis()
				_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
					Id:                model.NewId(),
					UserId:            th.BasicUser.Id,
					Title:             "Existing usage",
					CreateAt:          now,
					UpdateAt:          now,
					TotalMessageCount: tt.usedToday,
					Status:            tt.usageStatus,
				})
				require.NoError(t, storeErr)
			}

			budget, appErr := th.App.NewRecapPostBudgetForUser(th.BasicUser.Id)
			require.Nil(t, appErr)
			require.NotNil(t, budget)
			for _, want := range tt.wantReservations {
				assert.Equal(t, want, budget.Reserve(100))
			}
		})
	}
}

func TestProcessRecapChannel(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")

	t.Run("process empty channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Enable AI Recaps feature flag
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

		// Ensure channel has no posts (it shouldn't in init)
		channel := th.CreateChannel(t, th.BasicTeam)
		// No posts added

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id:       recapID,
			UserId:   th.BasicUser.Id,
			Title:    "Empty recap",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
			Status:   model.RecapStatusProcessing,
			BotID:    agentID,
		})
		require.NoError(t, storeErr)

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.Nil(t, err)
		require.NotNil(t, result)
		assert.True(t, result.Success)
		assert.Equal(t, 0, result.MessageCount)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Equal(t, channel.Id, recapChannels[0].ChannelId)
		assert.Empty(t, recapChannels[0].Highlights)
		assert.Empty(t, recapChannels[0].ActionItems)
	})

	t.Run("process channel with posts persists recap channel", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":["A deterministic highlight"],"action_items":["A deterministic action item"]}`, nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)

		// Enable AI Recaps feature flag
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

		channel := th.CreateChannel(t, th.BasicTeam)
		post := th.CreatePost(t, channel)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id:       recapID,
			UserId:   th.BasicUser.Id,
			Title:    "Test recap",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
			Status:   model.RecapStatusProcessing,
			BotID:    agentID,
		})
		require.NoError(t, storeErr)

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.Nil(t, err)
		require.NotNil(t, result)
		assert.True(t, result.Success)
		assert.Equal(t, 1, result.MessageCount)
		require.Len(t, bridge.completeCalls, 1)
		assert.Equal(t, BridgeOperationRecapSummary, bridge.completeCalls[0].request.Operation)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Equal(t, channel.Id, recapChannels[0].ChannelId)
		assert.Equal(t, []string{"A deterministic highlight"}, recapChannels[0].Highlights)
		assert.Equal(t, []string{"A deterministic action item"}, recapChannels[0].ActionItems)
		assert.Equal(t, []string{post.Id}, recapChannels[0].SourcePostIds)
	})

	t.Run("malformed completion surfaces parse failure", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return "{invalid json", nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)

		// Enable AI Recaps feature flag
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

		channel := th.CreateChannel(t, th.BasicTeam)
		th.CreatePost(t, channel)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id:       recapID,
			UserId:   th.BasicUser.Id,
			Title:    "Malformed recap",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
			Status:   model.RecapStatusProcessing,
			BotID:    agentID,
		})
		require.NoError(t, storeErr)

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.NotNil(t, err)
		assert.Equal(t, "app.ai.summarize.parse_failed", err.Id)
		assert.False(t, result.Success)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Equal(t, channel.Id, recapChannels[0].ChannelId)
		assert.Empty(t, recapChannels[0].Highlights)
		assert.Empty(t, recapChannels[0].ActionItems)
		assert.Len(t, recapChannels[0].SourcePostIds, 1)
	})

	t.Run("denies channel when user lacks read permission", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				require.Fail(t, "bridge should not be called when user lacks channel access")
				return "", nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })

		// Private channel owned by another user; BasicUser is not a member.
		channel := th.CreatePrivateChannel(t, th.BasicTeam, func(c *model.Channel) {
			c.CreatorId = th.BasicUser2.Id
		})
		th.CreatePost(t, channel, func(p *model.Post) { p.UserId = th.BasicUser2.Id })

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		recapID := model.NewId()
		agentID := "test-agent"
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id:       recapID,
			UserId:   th.BasicUser.Id,
			Title:    "Unauthorized recap",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
			Status:   model.RecapStatusProcessing,
			BotID:    agentID,
		})
		require.NoError(t, storeErr)

		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.NotNil(t, err)
		assert.Equal(t, "app.recap.permission_denied", err.Id)
		require.NotNil(t, result)
		assert.False(t, result.Success)
		assert.Empty(t, bridge.completeCalls)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		assert.Empty(t, recapChannels)
	})

	t.Run("max posts per day prevents additional post processing", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				require.Fail(t, "bridge should not be called when post usage is exhausted")
				return "", nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.EnableAIRecaps = true
			cfg.AIRecapSettings.EnforcePostsPerDay = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.MaxPostsPerDay = model.NewPointer(1)
		})

		existingRecap := &model.Recap{
			Id:                model.NewId(),
			UserId:            th.BasicUser.Id,
			Title:             "Existing usage",
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
			TotalMessageCount: 1,
			Status:            model.RecapStatusCompleted,
			BotID:             "test-agent",
		}
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(existingRecap)
		require.NoError(t, storeErr)

		channel := th.CreateChannel(t, th.BasicTeam)
		th.CreatePost(t, channel)

		recapID := model.NewId()
		agentID := "test-agent"
		_, storeErr = th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id:       recapID,
			UserId:   th.BasicUser.Id,
			Title:    "Limited recap",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
			Status:   model.RecapStatusProcessing,
			BotID:    agentID,
		})
		require.NoError(t, storeErr)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
		require.Nil(t, err)
		require.NotNil(t, result)
		assert.True(t, result.Success)
		assert.Equal(t, 0, result.MessageCount)
		assert.Empty(t, bridge.completeCalls)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Empty(t, recapChannels[0].SourcePostIds)
	})
}

func TestProcessRecapChannelWithBudget(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")

	t.Run("budget caps fetched posts", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":["h"],"action_items":["a"]}`, nil
			},
		}
		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })
		channel := th.CreateChannel(t, th.BasicTeam)
		for range 5 {
			th.CreateMessagePost(t, channel, "short message")
		}
		recapID := model.NewId()
		now := model.GetMillis()
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id: recapID, UserId: th.BasicUser.Id, Title: "Budget recap",
			CreateAt: now, UpdateAt: now, Status: model.RecapStatusProcessing, BotID: "test-agent",
		})
		require.NoError(t, storeErr)

		budget := model.NewRecapPostBudget(3, model.UnlimitedValue, 0)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		result, appErr := th.App.ProcessRecapChannelWithOptions(ctx, recapID, channel.Id, th.BasicUser.Id, "test-agent", model.RecapProcessingOptions{PostBudget: budget})
		require.Nil(t, appErr)
		require.True(t, result.Success)
		assert.Equal(t, 3, result.MessageCount)
		assert.Equal(t, 0, budget.Reserve(1))

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Len(t, recapChannels[0].SourcePostIds, 3)
	})

	t.Run("unused grant is refunded", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":["h"],"action_items":["a"]}`, nil
			},
		}
		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })
		channel := th.CreateChannel(t, th.BasicTeam)
		for range 2 {
			th.CreateMessagePost(t, channel, "short message")
		}
		recapID := model.NewId()
		now := model.GetMillis()
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id: recapID, UserId: th.BasicUser.Id, Title: "Refund recap",
			CreateAt: now, UpdateAt: now, Status: model.RecapStatusProcessing, BotID: "test-agent",
		})
		require.NoError(t, storeErr)

		budget := model.NewRecapPostBudget(100, model.UnlimitedValue, 0)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		result, appErr := th.App.ProcessRecapChannelWithOptions(ctx, recapID, channel.Id, th.BasicUser.Id, "test-agent", model.RecapProcessingOptions{PostBudget: budget})
		require.Nil(t, appErr)
		require.True(t, result.Success)
		assert.Equal(t, 2, result.MessageCount)
		assert.Equal(t, 98, budget.Reserve(100))
	})

	t.Run("exhausted budget saves empty record without LLM call", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return "", errors.New("bridge must not be called")
			},
		}
		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })
		channel := th.CreateChannel(t, th.BasicTeam)
		th.CreateMessagePost(t, channel, "short message")
		recapID := model.NewId()
		now := model.GetMillis()
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id: recapID, UserId: th.BasicUser.Id, Title: "Exhausted recap",
			CreateAt: now, UpdateAt: now, Status: model.RecapStatusProcessing, BotID: "test-agent",
		})
		require.NoError(t, storeErr)

		budget := model.NewRecapPostBudget(0, model.UnlimitedValue, 0)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		result, appErr := th.App.ProcessRecapChannelWithOptions(ctx, recapID, channel.Id, th.BasicUser.Id, "test-agent", model.RecapProcessingOptions{PostBudget: budget})
		require.Nil(t, appErr)
		require.True(t, result.Success)
		assert.Equal(t, 0, result.MessageCount)
		assert.Empty(t, bridge.completeCalls)

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Empty(t, recapChannels[0].SourcePostIds)
	})

	t.Run("summarize failure does not refund persisted posts", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return "", errors.New("summarization failed")
			},
		}
		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })
		channel := th.CreateChannel(t, th.BasicTeam)
		for range 2 {
			th.CreateMessagePost(t, channel, "short message")
		}
		recapID := model.NewId()
		now := model.GetMillis()
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id: recapID, UserId: th.BasicUser.Id, Title: "Failed recap",
			CreateAt: now, UpdateAt: now, Status: model.RecapStatusProcessing, BotID: "test-agent",
		})
		require.NoError(t, storeErr)

		budget := model.NewRecapPostBudget(10, model.UnlimitedValue, 0)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		_, appErr := th.App.ProcessRecapChannelWithOptions(ctx, recapID, channel.Id, th.BasicUser.Id, "test-agent", model.RecapProcessingOptions{PostBudget: budget})
		require.NotNil(t, appErr)
		assert.Equal(t, 8, budget.Reserve(100))

		recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
		require.NoError(t, storeErr)
		require.Len(t, recapChannels, 1)
		assert.Len(t, recapChannels[0].SourcePostIds, 2)
	})

	t.Run("nil budget uses DB limits", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"highlights":["h"],"action_items":["a"]}`, nil
			},
		}
		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.EnableAIRecaps = true
			cfg.AIRecapSettings.EnforcePostsPerRecap = model.NewPointer(true)
			cfg.AIRecapSettings.DefaultLimits.MaxPostsPerRecap = model.NewPointer(3)
		})
		channel := th.CreateChannel(t, th.BasicTeam)
		for range 5 {
			th.CreateMessagePost(t, channel, "short message")
		}
		recapID := model.NewId()
		now := model.GetMillis()
		_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
			Id: recapID, UserId: th.BasicUser.Id, Title: "DB limit recap",
			CreateAt: now, UpdateAt: now, Status: model.RecapStatusProcessing, BotID: "test-agent",
		})
		require.NoError(t, storeErr)

		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
		result, appErr := th.App.ProcessRecapChannelWithOptions(ctx, recapID, channel.Id, th.BasicUser.Id, "test-agent", model.RecapProcessingOptions{})
		require.Nil(t, appErr)
		require.True(t, result.Success)
		assert.Equal(t, 3, result.MessageCount)
	})
}

func TestProcessRecapChannelBudgetParallelExactness(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	bridge := &testAgentsBridge{
		completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
			return `{"highlights":["h"],"action_items":["a"]}`, nil
		},
	}
	th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.EnableAIRecaps = true
		cfg.AIRecapSettings.EnforceRecapsPerDay = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceScheduledRecaps = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceChannelsPerRecap = model.NewPointer(false)
		cfg.AIRecapSettings.EnforcePostsPerRecap = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceTokensPerRecap = model.NewPointer(false)
		cfg.AIRecapSettings.EnforcePostsPerDay = model.NewPointer(false)
		cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(false)
	})

	channels := make([]*model.Channel, 4)
	for i := range channels {
		channels[i] = th.CreateChannel(t, th.BasicTeam)
		for range 30 {
			th.CreateMessagePost(t, channels[i], "short message")
		}
	}
	recapID := model.NewId()
	now := model.GetMillis()
	_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
		Id: recapID, UserId: th.BasicUser.Id, Title: "Parallel recap",
		CreateAt: now, UpdateAt: now, Status: model.RecapStatusProcessing, BotID: "test-agent",
	})
	require.NoError(t, storeErr)

	budget := model.NewRecapPostBudget(50, model.UnlimitedValue, 0)
	results := make([]*model.RecapChannelResult, len(channels))
	appErrs := make([]*model.AppError, len(channels))
	var wg sync.WaitGroup
	for i, channel := range channels {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
			results[i], appErrs[i] = th.App.ProcessRecapChannelWithOptions(ctx, recapID, channel.Id, th.BasicUser.Id, "test-agent", model.RecapProcessingOptions{PostBudget: budget})
		}()
	}
	wg.Wait()

	for i := range channels {
		require.Nil(t, appErrs[i])
		require.NotNil(t, results[i])
		assert.True(t, results[i].Success)
	}
	recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
	require.NoError(t, storeErr)
	require.Len(t, recapChannels, len(channels))
	totalSourcePosts := 0
	for _, recapChannel := range recapChannels {
		totalSourcePosts += len(recapChannel.SourcePostIds)
	}
	assert.Positive(t, totalSourcePosts)
	assert.LessOrEqual(t, totalSourcePosts, 50)
}

func TestFetchPostsForRecapBatchUsernames(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")
	bridge := &testAgentsBridge{
		completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
			return `{"highlights":["h"],"action_items":["a"]}`, nil
		},
	}
	th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.EnableAIRecaps = true })
	channel := th.CreateChannel(t, th.BasicTeam)
	th.AddUserToChannel(t, th.BasicUser2, channel)
	th.CreatePost(t, channel, func(post *model.Post) { post.UserId = th.BasicUser.Id })
	th.CreatePost(t, channel, func(post *model.Post) { post.UserId = th.BasicUser2.Id })
	recapID := model.NewId()
	now := model.GetMillis()
	_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
		Id: recapID, UserId: th.BasicUser.Id, Title: "Username recap",
		CreateAt: now, UpdateAt: now, Status: model.RecapStatusProcessing, BotID: "test-agent",
	})
	require.NoError(t, storeErr)

	ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
	result, appErr := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, "test-agent")
	require.Nil(t, appErr)
	require.True(t, result.Success)
	require.Len(t, bridge.completeCalls, 1)
	require.Len(t, bridge.completeCalls[0].request.Messages, 2)
	userPrompt := bridge.completeCalls[0].request.Messages[1].Message
	assert.Contains(t, userPrompt, th.BasicUser.Username)
	assert.Contains(t, userPrompt, th.BasicUser2.Username)
}

func TestProcessRecapChannelTokenLimit(t *testing.T) {
	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")

	// 400 chars => ~100 estimated tokens per post; 5 posts => ~500 tokens.
	longMessage := strings.Repeat("x", 400)
	const postCount = 5

	tests := []struct {
		name             string
		enforceTokens    bool
		maxTokens        int
		wantMessageCount int
	}{
		{
			name:             "token limit reduces posts sent to LLM",
			enforceTokens:    true,
			maxTokens:        150, // room for a single ~100-token post
			wantMessageCount: 1,
		},
		{
			name:             "no enforcement keeps every post",
			enforceTokens:    false,
			maxTokens:        150,
			wantMessageCount: postCount,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			bridge := &testAgentsBridge{
				completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
					return `{"highlights":["h"],"action_items":["a"]}`, nil
				},
			}

			th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.FeatureFlags.EnableAIRecaps = true
				cfg.AIRecapSettings.EnforceTokensPerRecap = model.NewPointer(tc.enforceTokens)
				cfg.AIRecapSettings.DefaultLimits.MaxTokensPerRecap = model.NewPointer(tc.maxTokens)
			})

			channel := th.CreateChannel(t, th.BasicTeam)
			for range postCount {
				th.CreateMessagePost(t, channel, longMessage)
			}

			ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
			recapID := model.NewId()
			agentID := "test-agent"
			_, storeErr := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
				Id:       recapID,
				UserId:   th.BasicUser.Id,
				Title:    "Token limit recap",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
				Status:   model.RecapStatusProcessing,
				BotID:    agentID,
			})
			require.NoError(t, storeErr)

			result, err := th.App.ProcessRecapChannel(ctx, recapID, channel.Id, th.BasicUser.Id, agentID)
			require.Nil(t, err)
			require.True(t, result.Success)
			assert.Equal(t, tc.wantMessageCount, result.MessageCount)

			recapChannels, storeErr := th.App.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
			require.NoError(t, storeErr)
			require.Len(t, recapChannels, 1)
			assert.Len(t, recapChannels[0].SourcePostIds, tc.wantMessageCount)
		})
	}
}

func TestRecapFetchStartAt(t *testing.T) {
	now := time.Date(2026, time.April, 28, 12, 0, 0, 0, time.UTC)
	lastViewedAt := now.Add(-2 * time.Hour).UnixMilli()

	startAt, allowFallback := recapFetchStartAt("", lastViewedAt, now)
	assert.Equal(t, lastViewedAt, startAt)
	assert.True(t, allowFallback)

	startAt, allowFallback = recapFetchStartAt(model.TimePeriodSinceLastRead, lastViewedAt, now)
	assert.Equal(t, lastViewedAt, startAt)
	assert.True(t, allowFallback)

	startAt, allowFallback = recapFetchStartAt(model.TimePeriodLast24h, lastViewedAt, now)
	assert.Equal(t, now.Add(-24*time.Hour).UnixMilli(), startAt)
	assert.False(t, allowFallback)

	startAt, allowFallback = recapFetchStartAt(model.TimePeriodLastWeek, lastViewedAt, now)
	assert.Equal(t, now.Add(-7*24*time.Hour).UnixMilli(), startAt)
	assert.False(t, allowFallback)
}

func TestExtractPostIDs(t *testing.T) {
	t.Run("extract post IDs from posts", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", Message: "test1"},
			{Id: "post2", Message: "test2"},
			{Id: "post3", Message: "test3"},
		}

		ids := extractPostIDs(posts)
		assert.Len(t, ids, 3)
		assert.Equal(t, "post1", ids[0])
		assert.Equal(t, "post2", ids[1])
		assert.Equal(t, "post3", ids[2])
	})

	t.Run("extract from empty posts", func(t *testing.T) {
		posts := []*model.Post{}
		ids := extractPostIDs(posts)
		assert.Len(t, ids, 0)
	})
}

func TestEstimateTokens(t *testing.T) {
	t.Run("empty string", func(t *testing.T) {
		tokens := estimateTokens("")
		assert.Equal(t, 0, tokens)
	})

	t.Run("short text", func(t *testing.T) {
		// 4 chars = 1 token (ceiling)
		tokens := estimateTokens("test")
		assert.Equal(t, 1, tokens)
	})

	t.Run("longer text", func(t *testing.T) {
		// 20 chars -> (20+3)/4 = 5 tokens (ceiling division)
		tokens := estimateTokens("12345678901234567890")
		assert.Equal(t, 5, tokens)
	})

	t.Run("conservative ceiling division", func(t *testing.T) {
		// 5 chars -> (5+3)/4 = 2 tokens
		tokens := estimateTokens("hello")
		assert.Equal(t, 2, tokens)
	})
}

func TestEstimatePostTokens(t *testing.T) {
	t.Run("estimates tokens from post message", func(t *testing.T) {
		post := &model.Post{Message: "Hello world from Mattermost"} // 27 chars
		tokens := estimatePostTokens(post)
		// (27+3)/4 = 7 tokens
		assert.Equal(t, 7, tokens)
	})
}

func TestTrimPostsToTokenLimit(t *testing.T) {
	// 40 chars => (40+3)/4 = 10 tokens per post.
	msg40 := strings.Repeat("x", 40)
	makePosts := func(ids ...string) []*model.Post {
		posts := make([]*model.Post, len(ids))
		for i, id := range ids {
			posts[i] = &model.Post{Id: id, Message: msg40}
		}
		return posts
	}

	tests := []struct {
		name        string
		posts       []*model.Post
		maxTokens   int
		wantIDs     []string
		wantTrimmed bool
	}{
		{
			name:        "no trim when under limit",
			posts:       makePosts("a", "b"),
			maxTokens:   1000,
			wantIDs:     []string{"a", "b"},
			wantTrimmed: false,
		},
		{
			name:        "keeps newest posts that fit",
			posts:       makePosts("newest", "middle", "oldest"),
			maxTokens:   25, // room for 2 posts (20 tokens), not 3 (30 tokens)
			wantIDs:     []string{"newest", "middle"},
			wantTrimmed: true,
		},
		{
			name:        "drops all when first post exceeds limit",
			posts:       makePosts("a", "b"),
			maxTokens:   5, // single post is 10 tokens
			wantIDs:     []string{},
			wantTrimmed: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, trimmed := trimPostsToTokenLimit(tc.posts, tc.maxTokens)
			assert.Equal(t, tc.wantTrimmed, trimmed)
			gotIDs := make([]string, len(got))
			for i, p := range got {
				gotIDs[i] = p.Id
			}
			assert.Equal(t, tc.wantIDs, gotIDs)
		})
	}
}
