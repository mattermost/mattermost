// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package recap

import (
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	einterfacesmocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/semaphore"
)

type MockAppIface struct {
	mock.Mock
}

func (m *MockAppIface) ProcessRecapChannelWithOptions(rctx request.CTX, recapID, channelID, userID, agentID string, options model.RecapProcessingOptions) (*model.RecapChannelResult, *model.AppError) {
	args := m.Called(rctx, recapID, channelID, userID, agentID, options)
	if resultFn, ok := args.Get(0).(func(request.CTX, string, string, string, string, model.RecapProcessingOptions) *model.RecapChannelResult); ok {
		return resultFn(rctx, recapID, channelID, userID, agentID, options), nil
	}
	if args.Get(0) == nil {
		return nil, args.Get(1).(*model.AppError)
	}
	return args.Get(0).(*model.RecapChannelResult), nil
}

func (m *MockAppIface) NewRecapPostBudgetForUser(userID string) (*model.RecapPostBudget, *model.AppError) {
	args := m.Called(userID)
	var budget *model.RecapPostBudget
	if args.Get(0) != nil {
		budget = args.Get(0).(*model.RecapPostBudget)
	}
	if args.Get(1) == nil {
		return budget, nil
	}
	return budget, args.Get(1).(*model.AppError)
}

func (m *MockAppIface) Publish(message *model.WebSocketEvent) {
	m.Called(message)
}

func unlimitedBudget() *model.RecapPostBudget {
	return model.NewRecapPostBudget(model.UnlimitedValue, model.UnlimitedValue, 0)
}

func matchOptions(want model.RecapProcessingOptions) any {
	return mock.MatchedBy(func(got model.RecapProcessingOptions) bool {
		return got.TimePeriod == want.TimePeriod &&
			got.CustomInstructions == want.CustomInstructions &&
			got.PostBudget != nil
	})
}

func TestProcessRecapJob(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	job := &model.Job{
		Data: map[string]string{
			"recap_id":    "recap1",
			"user_id":     "user1",
			"channel_ids": "channel1,channel2",
			"agent_id":    "agent1",
		},
	}

	t.Run("successful processing", func(t *testing.T) {
		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}

		// Setup expectations
		mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
		mockApp.On("Publish", mock.Anything).Return()
		mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil)

		mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel1", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).Return(&model.RecapChannelResult{
			ChannelID:    "channel1",
			Success:      true,
			MessageCount: 10,
		}, nil)

		mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel2", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).Return(&model.RecapChannelResult{
			ChannelID:    "channel2",
			Success:      true,
			MessageCount: 5,
		}, nil)

		recap := &model.Recap{Id: "recap1"}
		mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
		mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.TotalMessageCount == 15 && r.Status == model.RecapStatusCompleted
		})).Return(recap, nil)

		err := processRecapJob(logger, job, mockStore, mockApp, semaphore.NewWeighted(16), nil)
		require.NoError(t, err)
	})

	t.Run("partial failure", func(t *testing.T) {
		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}

		mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
		mockApp.On("Publish", mock.Anything).Return()
		mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil)

		mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel1", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).Return(&model.RecapChannelResult{
			ChannelID:    "channel1",
			Success:      true,
			MessageCount: 10,
		}, nil)

		mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel2", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).Return(nil, model.NewAppError("fail", "fail", nil, "", 500))

		recap := &model.Recap{Id: "recap1"}
		mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
		mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.TotalMessageCount == 10 && r.Status == model.RecapStatusCompleted
		})).Return(recap, nil)

		err := processRecapJob(logger, job, mockStore, mockApp, semaphore.NewWeighted(16), nil)
		require.NoError(t, err)
	})

	t.Run("complete failure", func(t *testing.T) {
		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}

		mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
		mockApp.On("Publish", mock.Anything).Return()
		mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil)

		mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel1", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).Return(nil, model.NewAppError("fail", "fail", nil, "", 500))
		mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel2", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).Return(nil, model.NewAppError("fail", "fail", nil, "", 500))

		recap := &model.Recap{Id: "recap1"}
		mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
		mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.TotalMessageCount == 0 && r.Status == model.RecapStatusFailed
		})).Return(recap, nil)

		err := processRecapJob(logger, job, mockStore, mockApp, semaphore.NewWeighted(16), nil)
		require.Error(t, err)
		require.Equal(t, "all channels failed to process", err.Error())
	})

	t.Run("passes scheduled options to channel processing", func(t *testing.T) {
		jobWithOptions := &model.Job{
			Data: map[string]string{
				"recap_id":            "recap1",
				"user_id":             "user1",
				"channel_ids":         "channel1",
				"agent_id":            "agent1",
				"time_period":         model.TimePeriodLastWeek,
				"custom_instructions": "Focus on blockers",
			},
		}

		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}
		mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
		mockApp.On("Publish", mock.Anything).Return()
		mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil)
		mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel1", "user1", "agent1", matchOptions(model.RecapProcessingOptions{
			TimePeriod:         model.TimePeriodLastWeek,
			CustomInstructions: "Focus on blockers",
		})).Return(&model.RecapChannelResult{
			ChannelID:    "channel1",
			Success:      true,
			MessageCount: 3,
		}, nil)

		recap := &model.Recap{Id: "recap1"}
		mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
		mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.TotalMessageCount == 3 && r.Status == model.RecapStatusCompleted
		})).Return(recap, nil)

		err := processRecapJob(logger, jobWithOptions, mockStore, mockApp, semaphore.NewWeighted(16), nil)
		require.NoError(t, err)
		mockApp.AssertExpectations(t)
	})
}

func TestRecapWorkerPanicMarksJobErrorAndReleasesSemaphore(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true
	cfg.AIRecapSettings.Enable = model.NewPointer(true)
	cfg.AIRecapSettings.Processing.MaxConcurrentLLMCalls = model.NewPointer(1)

	mockStore := &storetest.Store{}
	mockMetrics := &einterfacesmocks.MetricsInterface{}
	mockApp := &MockAppIface{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
		mockMetrics.AssertExpectations(t)
		mockApp.AssertExpectations(t)
	})

	logger, loggerErr := mlog.NewLogger()
	require.NoError(t, loggerErr)
	t.Cleanup(func() {
		assert.NoError(t, logger.Shutdown())
	})
	jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: cfg}, mockStore, mockMetrics, logger, nil)
	worker := MakeWorker(jobServer, mockStore, mockApp)

	claimedJob1 := &model.Job{
		Id:     "job1",
		Type:   model.JobTypeRecap,
		Status: model.JobStatusInProgress,
		Data: map[string]string{
			"recap_id": "recap1", "user_id": "user1",
			"channel_ids": "channel1", "agent_id": "agent1",
		},
	}
	claimedJob2 := &model.Job{
		Id:     "job2",
		Type:   model.JobTypeRecap,
		Status: model.JobStatusInProgress,
		Data: map[string]string{
			"recap_id": "recap2", "user_id": "user1",
			"channel_ids": "channel2", "agent_id": "agent1",
		},
	}
	candidateJob1 := &model.Job{Id: "job1", Type: model.JobTypeRecap}
	candidateJob2 := &model.Job{Id: "job2", Type: model.JobTypeRecap}

	mockStore.JobStore.On("UpdateStatusOptimistically", "job1", model.JobStatusPending, model.JobStatusInProgress).Return(claimedJob1, nil).Once()
	mockStore.JobStore.On("UpdateStatusOptimistically", "job2", model.JobStatusPending, model.JobStatusInProgress).Return(claimedJob2, nil).Once()
	mockStore.JobStore.On("UpdateOptimistically", claimedJob1, model.JobStatusInProgress).Return(claimedJob1, nil).Times(3)
	mockStore.JobStore.On("UpdateOptimistically", claimedJob2, model.JobStatusInProgress).Return(claimedJob2, nil).Times(3)
	mockStore.JobStore.On("UpdateStatus", "job2", model.JobStatusSuccess).Return(claimedJob2, nil).Once()
	mockMetrics.On("IncrementJobActive", model.JobTypeRecap).Twice()
	mockMetrics.On("DecrementJobActive", model.JobTypeRecap).Twice()

	mockStore.RecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil).Once()
	mockStore.RecapStore.On("UpdateRecapStatus", "recap2", model.RecapStatusProcessing).Return(nil).Once()
	recap2 := &model.Recap{Id: "recap2"}
	mockStore.RecapStore.On("GetRecap", "recap2").Return(recap2, nil).Once()
	mockStore.RecapStore.On("UpdateRecap", mock.MatchedBy(func(recap *model.Recap) bool {
		return recap.Id == "recap2" &&
			recap.TotalMessageCount == 1 &&
			recap.Status == model.RecapStatusCompleted
	})).Return(recap2, nil).Once()

	mockApp.On("Publish", mock.Anything).Return().Times(3)
	mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil).Twice()
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel1", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).
		Run(func(args mock.Arguments) { panic("channel panic") }).
		Return((*model.RecapChannelResult)(nil), (*model.AppError)(nil)).
		Once()
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap2", "channel2", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).
		Return(&model.RecapChannelResult{ChannelID: "channel2", MessageCount: 1, Success: true}, nil).
		Once()

	require.PanicsWithValue(t, "channel panic", func() {
		worker.DoJob(candidateJob1)
	})
	assert.Equal(t, model.JobStatusError, claimedJob1.Status)

	secondJobResult := make(chan any, 1)
	go func() {
		defer func() {
			secondJobResult <- recover()
		}()
		worker.DoJob(candidateJob2)
	}()

	var secondJobPanic any
	require.Eventually(t, func() bool {
		select {
		case secondJobPanic = <-secondJobResult:
			return true
		default:
			return false
		}
	}, 5*time.Second, 10*time.Millisecond)
	assert.Nil(t, secondJobPanic)
}

func TestProcessRecapJobRespectsLLMSemaphore(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	job := &model.Job{Data: map[string]string{
		"recap_id": "recap1", "user_id": "user1",
		"channel_ids": "channel1,channel2,channel3,channel4,channel5,channel6",
		"agent_id":    "agent1",
	}}
	mockStore := &mocks.Store{}
	mockRecapStore := &mocks.RecapStore{}
	mockStore.On("Recap").Return(mockRecapStore)
	mockApp := &MockAppIface{}
	mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil)

	var inFlight atomic.Int32
	var maxInFlight atomic.Int32
	var started atomic.Int32
	release := make(chan struct{})
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", mock.Anything, "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).
		Run(func(args mock.Arguments) {
			started.Add(1)
			current := inFlight.Add(1)
			for {
				previous := maxInFlight.Load()
				if current <= previous || maxInFlight.CompareAndSwap(previous, current) {
					break
				}
			}
			<-release
			inFlight.Add(-1)
		}).
		Return(&model.RecapChannelResult{Success: true, MessageCount: 1}, nil)

	recap := &model.Recap{Id: "recap1"}
	mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
	mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
		return r.TotalMessageCount == 6 && r.Status == model.RecapStatusCompleted
	})).Return(recap, nil)

	done := make(chan error, 1)
	go func() {
		done <- processRecapJob(logger, job, mockStore, mockApp, semaphore.NewWeighted(2), nil)
	}()

	require.Eventually(t, func() bool { return inFlight.Load() == 2 }, 5*time.Second, 10*time.Millisecond)
	time.Sleep(150 * time.Millisecond)
	assert.EqualValues(t, 2, started.Load())
	close(release)
	require.Eventually(t, func() bool { return len(done) == 1 }, 10*time.Second, 10*time.Millisecond)
	require.NoError(t, <-done)
	assert.LessOrEqual(t, maxInFlight.Load(), int32(2))
	mockApp.AssertNumberOfCalls(t, "ProcessRecapChannelWithOptions", 6)
	mockApp.AssertExpectations(t)
	mockRecapStore.AssertExpectations(t)
}

func TestProcessRecapJobFanOutCap(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	channelIDs := make([]string, 12)
	for i := range channelIDs {
		channelIDs[i] = "channel" + string(rune('a'+i))
	}
	job := &model.Job{Data: map[string]string{
		"recap_id": "recap1", "user_id": "user1",
		"channel_ids": strings.Join(channelIDs, ","),
		"agent_id":    "agent1",
	}}
	mockStore := &mocks.Store{}
	mockRecapStore := &mocks.RecapStore{}
	mockStore.On("Recap").Return(mockRecapStore)
	mockApp := &MockAppIface{}
	mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil)

	var inFlight atomic.Int32
	var maxInFlight atomic.Int32
	var started atomic.Int32
	release := make(chan struct{})
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", mock.Anything, "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).
		Run(func(args mock.Arguments) {
			started.Add(1)
			current := inFlight.Add(1)
			for {
				previous := maxInFlight.Load()
				if current <= previous || maxInFlight.CompareAndSwap(previous, current) {
					break
				}
			}
			<-release
			inFlight.Add(-1)
		}).
		Return(&model.RecapChannelResult{Success: true, MessageCount: 1}, nil)

	recap := &model.Recap{Id: "recap1"}
	mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
	mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
		return r.TotalMessageCount == 12 && r.Status == model.RecapStatusCompleted
	})).Return(recap, nil)

	done := make(chan error, 1)
	go func() {
		done <- processRecapJob(logger, job, mockStore, mockApp, semaphore.NewWeighted(64), nil)
	}()

	require.Eventually(t, func() bool { return inFlight.Load() == maxChannelWorkersPerJob }, 5*time.Second, 10*time.Millisecond)
	time.Sleep(150 * time.Millisecond)
	assert.EqualValues(t, maxChannelWorkersPerJob, started.Load())
	close(release)
	require.Eventually(t, func() bool { return len(done) == 1 }, 10*time.Second, 10*time.Millisecond)
	require.NoError(t, <-done)
	assert.LessOrEqual(t, maxInFlight.Load(), int32(maxChannelWorkersPerJob))
	mockApp.AssertNumberOfCalls(t, "ProcessRecapChannelWithOptions", 12)
	mockApp.AssertExpectations(t)
	mockRecapStore.AssertExpectations(t)
}

func TestProcessRecapJobOutOfOrderCompletion(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	job := &model.Job{Data: map[string]string{
		"recap_id": "recap1", "user_id": "user1",
		"channel_ids": "channel1,channel2,channel3",
		"agent_id":    "agent1",
	}}
	mockStore := &mocks.Store{}
	mockRecapStore := &mocks.RecapStore{}
	mockStore.On("Recap").Return(mockRecapStore)
	mockApp := &MockAppIface{}
	mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil)

	releaseFirst := make(chan struct{})
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel1", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).
		Run(func(args mock.Arguments) { <-releaseFirst }).
		Return(&model.RecapChannelResult{Success: true, MessageCount: 1}, nil)
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel2", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).
		Return(&model.RecapChannelResult{Success: true, MessageCount: 10}, nil)
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", "channel3", "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).
		Run(func(args mock.Arguments) { close(releaseFirst) }).
		Return(&model.RecapChannelResult{Success: true, MessageCount: 100}, nil)

	recap := &model.Recap{Id: "recap1"}
	mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
	mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
		return r.TotalMessageCount == 111 && r.Status == model.RecapStatusCompleted
	})).Return(recap, nil)

	var progressMu sync.Mutex
	progress := make([]int64, 0, 4)
	err := processRecapJob(logger, job, mockStore, mockApp, semaphore.NewWeighted(16), func(value int64) {
		progressMu.Lock()
		defer progressMu.Unlock()
		progress = append(progress, value)
	})
	require.NoError(t, err)

	progressMu.Lock()
	defer progressMu.Unlock()
	require.NotEmpty(t, progress)
	assert.Equal(t, int64(0), progress[0])
	assert.Equal(t, int64(100), progress[len(progress)-1])
	for i := 1; i < len(progress); i++ {
		assert.Greater(t, progress[i], progress[i-1])
	}
	mockApp.AssertExpectations(t)
	mockRecapStore.AssertExpectations(t)
}

func TestProcessRecapJobBudgetInitFallback(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	job := &model.Job{Data: map[string]string{
		"recap_id": "recap1", "user_id": "user1",
		"channel_ids": "channel1,channel2",
		"agent_id":    "agent1",
	}}
	mockStore := &mocks.Store{}
	mockRecapStore := &mocks.RecapStore{}
	mockStore.On("Recap").Return(mockRecapStore)
	mockApp := &MockAppIface{}
	mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("NewRecapPostBudgetForUser", "user1").Return(nil, model.NewAppError("x", "x", nil, "", 500))
	nilBudgetOptions := mock.MatchedBy(func(got model.RecapProcessingOptions) bool {
		return got.PostBudget == nil
	})
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", mock.Anything, "user1", "agent1", nilBudgetOptions).
		Return(&model.RecapChannelResult{Success: true, MessageCount: 1}, nil)

	recap := &model.Recap{Id: "recap1"}
	mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
	mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
		return r.TotalMessageCount == 2 && r.Status == model.RecapStatusCompleted
	})).Return(recap, nil)

	err := processRecapJob(logger, job, mockStore, mockApp, semaphore.NewWeighted(16), nil)
	require.NoError(t, err)
	mockApp.AssertNumberOfCalls(t, "ProcessRecapChannelWithOptions", 2)
	mockApp.AssertExpectations(t)
	mockRecapStore.AssertExpectations(t)
}

func TestProcessRecapJobSharedBudgetLimitsTotal(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	job := &model.Job{Data: map[string]string{
		"recap_id": "recap1", "user_id": "user1",
		"channel_ids": "channel1,channel2,channel3,channel4,channel5,channel6",
		"agent_id":    "agent1",
	}}
	mockStore := &mocks.Store{}
	mockRecapStore := &mocks.RecapStore{}
	mockStore.On("Recap").Return(mockRecapStore)
	mockApp := &MockAppIface{}
	mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("NewRecapPostBudgetForUser", "user1").Return(model.NewRecapPostBudget(30, model.UnlimitedValue, 0), nil)
	mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, "recap1", mock.Anything, "user1", "agent1", matchOptions(model.RecapProcessingOptions{})).
		Return(func(_ request.CTX, _, _, _, _ string, options model.RecapProcessingOptions) *model.RecapChannelResult {
			granted := options.PostBudget.Reserve(100)
			used := min(granted, 9)
			options.PostBudget.Refund(granted - used)
			return &model.RecapChannelResult{Success: true, MessageCount: used}
		}, nil)

	recap := &model.Recap{Id: "recap1"}
	mockRecapStore.On("GetRecap", "recap1").Return(recap, nil)
	mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
		return r.TotalMessageCount > 0 &&
			r.TotalMessageCount <= 30 &&
			r.Status == model.RecapStatusCompleted
	})).Return(recap, nil)

	err := processRecapJob(logger, job, mockStore, mockApp, semaphore.NewWeighted(16), nil)
	require.NoError(t, err)
	mockApp.AssertNumberOfCalls(t, "ProcessRecapChannelWithOptions", 6)
	mockApp.AssertExpectations(t)
	mockRecapStore.AssertExpectations(t)
}

func TestLLMCallLimitFromConfig(t *testing.T) {
	defaultedConfig := &model.Config{}
	defaultedConfig.SetDefaults()
	tests := []struct {
		name string
		cfg  *model.Config
		want int
	}{
		{name: "nil config", want: model.RecapProcessingDefaultMaxConcurrentLLMCalls},
		{name: "nil Processing", cfg: &model.Config{}, want: model.RecapProcessingDefaultMaxConcurrentLLMCalls},
		{
			name: "nil MaxConcurrentLLMCalls",
			cfg: &model.Config{AIRecapSettings: model.AIRecapSettings{
				Processing: &model.RecapProcessingSettings{},
			}},
			want: model.RecapProcessingDefaultMaxConcurrentLLMCalls,
		},
		{
			name: "configured value",
			cfg: &model.Config{AIRecapSettings: model.AIRecapSettings{
				Processing: &model.RecapProcessingSettings{
					MaxConcurrentLLMCalls: model.NewPointer(5),
				},
			}},
			want: 5,
		},
		{
			name: "zero clamps to one",
			cfg: &model.Config{AIRecapSettings: model.AIRecapSettings{
				Processing: &model.RecapProcessingSettings{
					MaxConcurrentLLMCalls: model.NewPointer(0),
				},
			}},
			want: 1,
		},
		{
			name: "negative clamps to one",
			cfg: &model.Config{AIRecapSettings: model.AIRecapSettings{
				Processing: &model.RecapProcessingSettings{
					MaxConcurrentLLMCalls: model.NewPointer(-3),
				},
			}},
			want: 1,
		},
		{name: "defaulted config", cfg: defaultedConfig, want: model.RecapProcessingDefaultMaxConcurrentLLMCalls},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, llmCallLimitFromConfig(tt.cfg))
		})
	}
}
