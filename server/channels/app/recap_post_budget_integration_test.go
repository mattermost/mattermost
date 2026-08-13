// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
		wg.Go(func() {
			ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})
			results[i], appErrs[i] = th.App.ProcessRecapChannelWithOptions(ctx, recapID, channel.Id, th.BasicUser.Id, "test-agent", model.RecapProcessingOptions{PostBudget: budget})
		})
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
