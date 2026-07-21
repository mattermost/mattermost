// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduled_recap

import (
	"errors"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockScheduledRecapApp struct {
	mock.Mock
}

func (m *mockScheduledRecapApp) CreateRecapFromSchedule(rctx request.CTX, scheduledRecap *model.ScheduledRecap) (*model.Recap, *model.AppError) {
	args := m.Called(rctx, scheduledRecap)
	if args.Get(0) == nil {
		return nil, args.Get(1).(*model.AppError)
	}
	return args.Get(0).(*model.Recap), nil
}

type blockingScheduledRecapApp struct {
	started chan<- string
	release <-chan struct{}
}

func (a *blockingScheduledRecapApp) CreateRecapFromSchedule(_ request.CTX, scheduledRecap *model.ScheduledRecap) (*model.Recap, *model.AppError) {
	a.started <- scheduledRecap.Id
	<-a.release
	return &model.Recap{Id: model.NewId()}, nil
}

func TestPoolSizeFromConfig(t *testing.T) {
	defaultedConfig := &model.Config{}
	defaultedConfig.SetDefaults()

	tests := []struct {
		name string
		cfg  *model.Config
		want int
	}{
		{
			name: "nil config",
			want: model.RecapProcessingDefaultMaxConcurrentJobs,
		},
		{
			name: "nil Processing",
			cfg:  &model.Config{},
			want: model.RecapProcessingDefaultMaxConcurrentJobs,
		},
		{
			name: "nil MaxConcurrentJobs",
			cfg: &model.Config{
				AIRecapSettings: model.AIRecapSettings{
					Processing: &model.RecapProcessingSettings{},
				},
			},
			want: model.RecapProcessingDefaultMaxConcurrentJobs,
		},
		{
			name: "configured value",
			cfg: &model.Config{
				AIRecapSettings: model.AIRecapSettings{
					Processing: &model.RecapProcessingSettings{
						MaxConcurrentJobs: model.NewPointer(7),
					},
				},
			},
			want: 7,
		},
		{
			name: "defaulted config",
			cfg:  defaultedConfig,
			want: model.RecapProcessingDefaultMaxConcurrentJobs,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, poolSizeFromConfig(tt.cfg))
		})
	}
}

func TestMakeWorkerProcessesScheduledRecapsConcurrently(t *testing.T) {
	const poolSize = 3

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.AIRecapSettings.Processing.MaxConcurrentJobs = model.NewPointer(poolSize)

	mockStore := &storetest.Store{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
	})

	started := make(chan string, poolSize)
	release := make(chan struct{})
	app := &blockingScheduledRecapApp{started: started, release: release}
	jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: cfg}, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)
	worker := MakeWorker(jobServer, mockStore, app)

	scheduledRecaps := make([]*model.ScheduledRecap, 0, poolSize)
	jobsToRun := make([]model.Job, 0, poolSize)
	for range poolSize {
		scheduledRecap := testScheduledRecap(true)
		job := model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeScheduledRecap,
			Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id},
		}
		claimedJob := job
		claimedJob.Status = model.JobStatusInProgress

		mockStore.JobStore.
			On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).
			Return(&claimedJob, nil).
			Once()
		mockStore.JobStore.
			On("UpdateOptimistically", mock.MatchedBy(func(updatedJob *model.Job) bool {
				return updatedJob.Id == job.Id
			}), model.JobStatusInProgress).
			Return(&claimedJob, nil).
			Once()
		mockStore.JobStore.
			On("UpdateStatus", job.Id, model.JobStatusSuccess).
			Return(&claimedJob, nil).
			Once()
		mockStore.ScheduledRecapStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil).Once()
		mockStore.ScheduledRecapStore.
			On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).
			Return(nil).
			Once()

		scheduledRecaps = append(scheduledRecaps, scheduledRecap)
		jobsToRun = append(jobsToRun, job)
	}

	go worker.Run()
	for i := range jobsToRun {
		select {
		case worker.JobChannel() <- jobsToRun[i]:
		case <-time.After(5 * time.Second):
			assert.FailNow(t, "timed out sending scheduled recap job")
		}
	}

	startedIDs := make(map[string]bool, poolSize)
	for range poolSize {
		select {
		case id := <-started:
			startedIDs[id] = true
		case <-time.After(5 * time.Second):
			assert.FailNow(t, "scheduled recap jobs did not execute concurrently")
		}
	}
	expectedIDs := make(map[string]bool, poolSize)
	for _, scheduledRecap := range scheduledRecaps {
		expectedIDs[scheduledRecap.Id] = true
	}
	assert.Equal(t, expectedIDs, startedIDs)

	extraJob := model.Job{Id: model.NewId(), Type: model.JobTypeScheduledRecap}
	select {
	case worker.JobChannel() <- extraJob:
		assert.FailNow(t, "worker accepted a job while the configured pool was exhausted")
	case <-time.After(100 * time.Millisecond):
	}

	close(release)
	stopped := make(chan struct{})
	go func() {
		worker.Stop()
		close(stopped)
	}()
	select {
	case <-stopped:
	case <-time.After(5 * time.Second):
		assert.FailNow(t, "worker did not stop after concurrent jobs completed")
	}
}

func TestProcessScheduledRecapJobReturnsPersistenceErrors(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("mark executed failure", func(t *testing.T) {
		scheduledRecap := testScheduledRecap(true)
		job := &model.Job{Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id}}

		mockStore := &mocks.Store{}
		mockScheduledStore := &mocks.ScheduledRecapStore{}
		mockStore.On("ScheduledRecap").Return(mockScheduledStore)
		mockScheduledStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil)
		mockScheduledStore.On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(errors.New("mark failed"))

		mockApp := &mockScheduledRecapApp{}
		mockApp.On("CreateRecapFromSchedule", mock.Anything, scheduledRecap).Return(&model.Recap{Id: model.NewId()}, nil)

		err := processScheduledRecapJob(logger, job, mockStore, mockApp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to mark scheduled recap as executed")
		mockScheduledStore.AssertExpectations(t)
		mockApp.AssertExpectations(t)
	})

	t.Run("non recurring disable failure", func(t *testing.T) {
		scheduledRecap := testScheduledRecap(false)
		job := &model.Job{Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id}}

		mockStore := &mocks.Store{}
		mockScheduledStore := &mocks.ScheduledRecapStore{}
		mockStore.On("ScheduledRecap").Return(mockScheduledStore)
		mockScheduledStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil)
		mockScheduledStore.On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(nil)
		mockScheduledStore.On("SetEnabled", scheduledRecap.Id, false).Return(errors.New("disable failed"))

		mockApp := &mockScheduledRecapApp{}
		mockApp.On("CreateRecapFromSchedule", mock.Anything, scheduledRecap).Return(&model.Recap{Id: model.NewId()}, nil)

		err := processScheduledRecapJob(logger, job, mockStore, mockApp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to disable non-recurring scheduled recap")
		mockScheduledStore.AssertExpectations(t)
		mockApp.AssertExpectations(t)
	})
}

func TestProcessScheduledRecapJobDailyLimitSkip(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	limitErr := model.NewAppError("CreateRecapFromSchedule", "app.recap.max_recaps_reached.app_error", nil, "", 429)

	t.Run("recurring schedule advances but stays enabled", func(t *testing.T) {
		scheduledRecap := testScheduledRecap(true)
		job := &model.Job{Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id}}

		mockStore := &mocks.Store{}
		mockScheduledStore := &mocks.ScheduledRecapStore{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("ScheduledRecap").Return(mockScheduledStore)
		mockStore.On("Recap").Return(mockRecapStore)
		mockScheduledStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil)
		mockScheduledStore.On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(nil)
		mockRecapStore.On("SaveRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.Status == model.RecapStatusSkipped && r.ScheduledRecapId == scheduledRecap.Id
		})).Return(&model.Recap{}, nil)

		mockApp := &mockScheduledRecapApp{}
		mockApp.On("CreateRecapFromSchedule", mock.Anything, scheduledRecap).Return(nil, limitErr)

		err := processScheduledRecapJob(logger, job, mockStore, mockApp)
		require.NoError(t, err)
		mockScheduledStore.AssertExpectations(t)
		mockRecapStore.AssertExpectations(t)
		mockApp.AssertExpectations(t)
		// A recurring schedule must not be disabled on the skip path.
		mockScheduledStore.AssertNotCalled(t, "SetEnabled", mock.Anything, mock.Anything)
	})

	t.Run("non recurring schedule is disabled on skip", func(t *testing.T) {
		scheduledRecap := testScheduledRecap(false)
		job := &model.Job{Data: map[string]string{"scheduled_recap_id": scheduledRecap.Id}}

		mockStore := &mocks.Store{}
		mockScheduledStore := &mocks.ScheduledRecapStore{}
		mockRecapStore := &mocks.RecapStore{}
		mockStore.On("ScheduledRecap").Return(mockScheduledStore)
		mockStore.On("Recap").Return(mockRecapStore)
		mockScheduledStore.On("Get", scheduledRecap.Id).Return(scheduledRecap, nil)
		mockScheduledStore.On("MarkExecuted", scheduledRecap.Id, mock.AnythingOfType("int64"), mock.AnythingOfType("int64")).Return(nil)
		mockScheduledStore.On("SetEnabled", scheduledRecap.Id, false).Return(nil)
		mockRecapStore.On("SaveRecap", mock.MatchedBy(func(r *model.Recap) bool {
			return r.Status == model.RecapStatusSkipped && r.ScheduledRecapId == scheduledRecap.Id
		})).Return(&model.Recap{}, nil)

		mockApp := &mockScheduledRecapApp{}
		mockApp.On("CreateRecapFromSchedule", mock.Anything, scheduledRecap).Return(nil, limitErr)

		err := processScheduledRecapJob(logger, job, mockStore, mockApp)
		require.NoError(t, err)
		mockScheduledStore.AssertExpectations(t)
		mockRecapStore.AssertExpectations(t)
		mockApp.AssertExpectations(t)
	})
}

func testScheduledRecap(isRecurring bool) *model.ScheduledRecap {
	return &model.ScheduledRecap{
		Id:          model.NewId(),
		UserId:      model.NewId(),
		Title:       "Scheduled Recap",
		DaysOfWeek:  model.EveryDay,
		TimeOfDay:   "09:00",
		Timezone:    "America/New_York",
		TimePeriod:  model.TimePeriodLast24h,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{model.NewId()},
		AgentId:     "test-agent",
		IsRecurring: isRecurring,
		Enabled:     true,
	}
}
