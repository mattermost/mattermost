// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package recap

import (
	"strconv"
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
	"github.com/mattermost/mattermost/server/v8/einterfaces"
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

func expectRecapChannelMetrics(t *testing.T, successes, failures int) *einterfacesmocks.MetricsInterface {
	t.Helper()

	mockMetrics := &einterfacesmocks.MetricsInterface{}
	t.Cleanup(func() {
		mockMetrics.AssertExpectations(t)
	})

	total := successes + failures
	mockMetrics.On("IncrementRecapLLMInFlight").Times(total)
	mockMetrics.On("DecrementRecapLLMInFlight").Times(total)
	if successes > 0 {
		mockMetrics.On("ObserveRecapChannelProcessTime", true, mock.AnythingOfType("float64")).Times(successes)
	}
	if failures > 0 {
		mockMetrics.On("ObserveRecapChannelProcessTime", false, mock.AnythingOfType("float64")).Times(failures)
	}
	return mockMetrics
}

type recapChannelTestOutcome struct {
	result *model.RecapChannelResult
	err    *model.AppError
}

func runRecapJobWithOutcomes(t *testing.T, logger mlog.LoggerIFace, job *model.Job, outcomes map[string]recapChannelTestOutcome, metrics einterfaces.MetricsInterface) error {
	t.Helper()

	mockStore := &mocks.Store{}
	mockRecapStore := &mocks.RecapStore{}
	mockStore.On("Recap").Return(mockRecapStore)
	mockApp := &MockAppIface{}
	t.Cleanup(func() {
		mockApp.AssertExpectations(t)
		mockRecapStore.AssertExpectations(t)
	})

	recapID := job.Data["recap_id"]
	userID := job.Data["user_id"]
	agentID := job.Data["agent_id"]
	mockRecapStore.On("UpdateRecapStatus", recapID, model.RecapStatusProcessing).Return(nil)
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("NewRecapPostBudgetForUser", userID).Return(unlimitedBudget(), nil)

	totalMessages := 0
	successes := 0
	for channelID, outcome := range outcomes {
		var result any
		if outcome.result != nil {
			result = outcome.result
		}
		mockApp.On("ProcessRecapChannelWithOptions", mock.Anything, recapID, channelID, userID, agentID, matchOptions(model.RecapProcessingOptions{})).
			Return(result, outcome.err).
			Once()
		if outcome.err == nil && outcome.result != nil && outcome.result.Success {
			successes++
			totalMessages += outcome.result.MessageCount
		}
	}

	expectedStatus := model.RecapStatusCompleted
	if successes == 0 {
		expectedStatus = model.RecapStatusFailed
	}
	recap := &model.Recap{Id: recapID}
	mockRecapStore.On("GetRecap", recapID).Return(recap, nil)
	mockRecapStore.On("UpdateRecap", mock.MatchedBy(func(r *model.Recap) bool {
		return r.TotalMessageCount == totalMessages && r.Status == expectedStatus
	})).Return(recap, nil)

	return processRecapJob(logger, job, mockStore, mockApp, metrics, semaphore.NewWeighted(16), nil)
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
		mockMetrics := expectRecapChannelMetrics(t, 2, 0)

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

		err := processRecapJob(logger, job, mockStore, mockApp, mockMetrics, semaphore.NewWeighted(16), nil)
		require.NoError(t, err)
		mockMetrics.AssertNotCalled(t, "ObserveRecapDeliveryDelay", mock.Anything)
	})

	t.Run("partial failure", func(t *testing.T) {
		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}
		mockMetrics := expectRecapChannelMetrics(t, 1, 1)

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

		err := processRecapJob(logger, job, mockStore, mockApp, mockMetrics, semaphore.NewWeighted(16), nil)
		require.NoError(t, err)
		mockMetrics.AssertNotCalled(t, "ObserveRecapDeliveryDelay", mock.Anything)
	})

	t.Run("complete failure", func(t *testing.T) {
		mockStore := &mocks.Store{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("Recap").Return(mockRecapStore)

		mockApp := &MockAppIface{}
		mockMetrics := expectRecapChannelMetrics(t, 0, 2)

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

		err := processRecapJob(logger, job, mockStore, mockApp, mockMetrics, semaphore.NewWeighted(16), nil)
		require.Error(t, err)
		require.Equal(t, "all channels failed to process", err.Error())
		mockMetrics.AssertNotCalled(t, "ObserveRecapDeliveryDelay", mock.Anything)
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
		mockMetrics := expectRecapChannelMetrics(t, 1, 0)
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

		err := processRecapJob(logger, jobWithOptions, mockStore, mockApp, mockMetrics, semaphore.NewWeighted(16), nil)
		require.NoError(t, err)
		mockApp.AssertExpectations(t)
	})

	t.Run("observes delivery delay for scheduled recaps", func(t *testing.T) {
		scheduledJob := &model.Job{Data: map[string]string{
			"recap_id":      "recap1",
			"user_id":       "user1",
			"channel_ids":   "channel1",
			"agent_id":      "agent1",
			"scheduled_for": strconv.FormatInt(model.GetMillis()-90_000, 10),
		}}
		mockMetrics := expectRecapChannelMetrics(t, 1, 0)
		mockMetrics.On("ObserveRecapDeliveryDelay", mock.MatchedBy(func(seconds float64) bool {
			return seconds >= 90 && seconds < 120
		})).Once()

		err := runRecapJobWithOutcomes(t, logger, scheduledJob, map[string]recapChannelTestOutcome{
			"channel1": {result: &model.RecapChannelResult{ChannelID: "channel1", Success: true, MessageCount: 1}},
		}, mockMetrics)
		require.NoError(t, err)
	})

	t.Run("observes delivery delay on partial failure", func(t *testing.T) {
		scheduledJob := &model.Job{Data: map[string]string{
			"recap_id":      "recap1",
			"user_id":       "user1",
			"channel_ids":   "channel1,channel2",
			"agent_id":      "agent1",
			"scheduled_for": strconv.FormatInt(model.GetMillis()-90_000, 10),
		}}
		mockMetrics := expectRecapChannelMetrics(t, 1, 1)
		mockMetrics.On("ObserveRecapDeliveryDelay", mock.AnythingOfType("float64")).Once()

		err := runRecapJobWithOutcomes(t, logger, scheduledJob, map[string]recapChannelTestOutcome{
			"channel1": {result: &model.RecapChannelResult{ChannelID: "channel1", Success: true, MessageCount: 1}},
			"channel2": {err: model.NewAppError("fail", "fail", nil, "", 500)},
		}, mockMetrics)
		require.NoError(t, err)
	})

	t.Run("skips delivery delay when all channels fail", func(t *testing.T) {
		scheduledJob := &model.Job{Data: map[string]string{
			"recap_id":      "recap1",
			"user_id":       "user1",
			"channel_ids":   "channel1,channel2",
			"agent_id":      "agent1",
			"scheduled_for": strconv.FormatInt(model.GetMillis()-90_000, 10),
		}}
		mockMetrics := expectRecapChannelMetrics(t, 0, 2)

		err := runRecapJobWithOutcomes(t, logger, scheduledJob, map[string]recapChannelTestOutcome{
			"channel1": {err: model.NewAppError("fail", "fail", nil, "", 500)},
			"channel2": {err: model.NewAppError("fail", "fail", nil, "", 500)},
		}, mockMetrics)
		require.Error(t, err)
		mockMetrics.AssertNotCalled(t, "ObserveRecapDeliveryDelay", mock.Anything)
	})

	t.Run("skips delivery delay on malformed scheduled_for", func(t *testing.T) {
		malformedJob := &model.Job{Data: map[string]string{
			"recap_id":      "recap1",
			"user_id":       "user1",
			"channel_ids":   "channel1",
			"agent_id":      "agent1",
			"scheduled_for": "not-a-number",
		}}
		mockMetrics := expectRecapChannelMetrics(t, 1, 0)

		err := runRecapJobWithOutcomes(t, logger, malformedJob, map[string]recapChannelTestOutcome{
			"channel1": {result: &model.RecapChannelResult{ChannelID: "channel1", Success: true, MessageCount: 1}},
		}, mockMetrics)
		require.NoError(t, err)
		mockMetrics.AssertNotCalled(t, "ObserveRecapDeliveryDelay", mock.Anything)
	})

	t.Run("nil metrics is safe", func(t *testing.T) {
		scheduledJob := &model.Job{Data: map[string]string{
			"recap_id":      "recap1",
			"user_id":       "user1",
			"channel_ids":   "channel1",
			"agent_id":      "agent1",
			"scheduled_for": strconv.FormatInt(model.GetMillis()-90_000, 10),
		}}

		err := runRecapJobWithOutcomes(t, logger, scheduledJob, map[string]recapChannelTestOutcome{
			"channel1": {result: &model.RecapChannelResult{ChannelID: "channel1", Success: true, MessageCount: 1}},
		}, nil)
		require.NoError(t, err)
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
	worker := MakeWorker(jobServer, mockStore, mockApp, func() einterfaces.MetricsInterface { return mockMetrics })

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
	mockMetrics.On("IncrementRecapLLMInFlight").Twice()
	mockMetrics.On("DecrementRecapLLMInFlight").Twice()
	mockMetrics.On("ObserveRecapChannelProcessTime", false, mock.AnythingOfType("float64")).Once()
	mockMetrics.On("ObserveRecapChannelProcessTime", true, mock.AnythingOfType("float64")).Once()

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
	mockMetrics := &einterfacesmocks.MetricsInterface{}
	t.Cleanup(func() {
		mockMetrics.AssertExpectations(t)
	})
	mockRecapStore.On("UpdateRecapStatus", "recap1", model.RecapStatusProcessing).Return(nil)
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("NewRecapPostBudgetForUser", "user1").Return(unlimitedBudget(), nil)

	var inFlight atomic.Int32
	var maxInFlight atomic.Int32
	var metricInFlight atomic.Int64
	var metricMaxInFlight atomic.Int64
	var started atomic.Int32
	release := make(chan struct{})
	mockMetrics.On("IncrementRecapLLMInFlight").Run(func(mock.Arguments) {
		current := metricInFlight.Add(1)
		for {
			previous := metricMaxInFlight.Load()
			if current <= previous || metricMaxInFlight.CompareAndSwap(previous, current) {
				break
			}
		}
	}).Times(6)
	mockMetrics.On("DecrementRecapLLMInFlight").Run(func(mock.Arguments) {
		metricInFlight.Add(-1)
	}).Times(6)
	mockMetrics.On("ObserveRecapChannelProcessTime", true, mock.AnythingOfType("float64")).Times(6)
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
		done <- processRecapJob(logger, job, mockStore, mockApp, mockMetrics, semaphore.NewWeighted(2), nil)
	}()

	require.Eventually(t, func() bool { return inFlight.Load() == 2 }, 5*time.Second, 10*time.Millisecond)
	time.Sleep(150 * time.Millisecond)
	assert.EqualValues(t, 2, started.Load())
	close(release)
	require.Eventually(t, func() bool { return len(done) == 1 }, 10*time.Second, 10*time.Millisecond)
	require.NoError(t, <-done)
	assert.LessOrEqual(t, maxInFlight.Load(), int32(2))
	assert.Zero(t, metricInFlight.Load())
	assert.LessOrEqual(t, metricMaxInFlight.Load(), int64(2))
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
		done <- processRecapJob(logger, job, mockStore, mockApp, nil, semaphore.NewWeighted(64), nil)
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
	err := processRecapJob(logger, job, mockStore, mockApp, nil, semaphore.NewWeighted(16), func(value int64) {
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

	err := processRecapJob(logger, job, mockStore, mockApp, nil, semaphore.NewWeighted(16), nil)
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

	err := processRecapJob(logger, job, mockStore, mockApp, nil, semaphore.NewWeighted(16), nil)
	require.NoError(t, err)
	mockApp.AssertNumberOfCalls(t, "ProcessRecapChannelWithOptions", 6)
	mockApp.AssertExpectations(t)
	mockRecapStore.AssertExpectations(t)
}
