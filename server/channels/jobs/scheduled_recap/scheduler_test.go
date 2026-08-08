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
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	metricsmocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func newSchedulerTestWithMetrics(t *testing.T, cfg *model.Config, metrics einterfaces.MetricsInterface) (*Scheduler, *storetest.Store) {
	t.Helper()

	mockStore := &storetest.Store{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
	})

	jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: cfg}, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)
	jobServer.RegisterJobType(model.JobTypeScheduledRecap, jobs.NewSimpleWorker(
		model.JobTypeScheduledRecap,
		jobServer,
		func(logger mlog.LoggerIFace, job *model.Job) error { return nil },
		func(cfg *model.Config) bool { return true },
	), nil)

	return MakeScheduler(jobServer, mockStore, func() einterfaces.MetricsInterface { return metrics }), mockStore
}

func newSchedulerTest(t *testing.T, cfg *model.Config) (*Scheduler, *storetest.Store, *metricsmocks.MetricsInterface) {
	t.Helper()

	mockMetrics := &metricsmocks.MetricsInterface{}
	t.Cleanup(func() {
		mockMetrics.AssertExpectations(t)
	})
	scheduler, mockStore := newSchedulerTestWithMetrics(t, cfg, mockMetrics)
	return scheduler, mockStore, mockMetrics
}

func expectNoWedgedJobs(mockStore *storetest.Store) {
	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeScheduledRecap, model.JobStatusInProgress).
		Return([]*model.Job{}, nil).
		Once()
}

// makeDueRecaps returns schedules with strictly increasing keyset keys.
func makeDueRecaps(n int, baseNextRunAt int64) []*model.ScheduledRecap {
	recaps := make([]*model.ScheduledRecap, n)
	for i := range recaps {
		recaps[i] = testScheduledRecap(true)
		recaps[i].NextRunAt = baseNextRunAt + int64(i)
	}
	return recaps
}

func expectBatch(mockStore *storetest.Store, cursorAt int64, cursorID string, limit int, rows []*model.ScheduledRecap) {
	mockStore.ScheduledRecapStore.
		On("GetDueBefore", mock.AnythingOfType("int64"), cursorAt, cursorID, limit).
		Return(rows, nil).
		Once()
}

func expectEnqueueOK(mockStore *storetest.Store, sr *model.ScheduledRecap) {
	mockStore.JobStore.
		On("SaveOnceByTypeAndData", mock.MatchedBy(func(job *model.Job) bool {
			return job.Type == model.JobTypeScheduledRecap &&
				len(job.Data) == 1 &&
				job.Data["scheduled_recap_id"] == sr.Id
		}), map[string]string{"scheduled_recap_id": sr.Id}).
		Return(func(job *model.Job, data map[string]string) *model.Job { return job }, nil).
		Once()
}

func expectEnqueueDuplicate(mockStore *storetest.Store, sr *model.ScheduledRecap) {
	mockStore.JobStore.
		On("SaveOnceByTypeAndData", mock.MatchedBy(func(job *model.Job) bool {
			return job.Type == model.JobTypeScheduledRecap &&
				job.Data["scheduled_recap_id"] == sr.Id
		}), map[string]string{"scheduled_recap_id": sr.Id}).
		Return(nil, nil).
		Once()
}

func expectEnqueueError(mockStore *storetest.Store, sr *model.ScheduledRecap) {
	mockStore.JobStore.
		On("SaveOnceByTypeAndData", mock.MatchedBy(func(job *model.Job) bool {
			return job.Type == model.JobTypeScheduledRecap &&
				job.Data["scheduled_recap_id"] == sr.Id
		}), map[string]string{"scheduled_recap_id": sr.Id}).
		Return(nil, errors.New("boom")).
		Once()
}

func TestScheduleJobEnqueuesEachDueRecapAndSkipsDuplicateAtomically(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true

	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)

	dueRecap1 := testScheduledRecap(true)
	dueRecap2 := testScheduledRecap(true)
	duplicateRecap := *dueRecap1
	dueRecaps := []*model.ScheduledRecap{dueRecap1, dueRecap2, &duplicateRecap}

	expectNoWedgedJobs(mockStore)
	expectBatch(mockStore, 0, "", 100, dueRecaps)

	for _, sr := range []*model.ScheduledRecap{dueRecap1, dueRecap2} {
		expectEnqueueOK(mockStore, sr)
	}

	expectEnqueueDuplicate(mockStore, dueRecap1)
	mockMetrics.On("ObserveRecapScheduledBacklog", int64(3)).Once()

	job, appErr := scheduler.ScheduleJob(request.EmptyContext(mlog.CreateConsoleTestLogger(t)), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}

func TestScheduleJobResetsWedgedJobThenEnqueuesSameTick(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true

	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)

	scheduledRecap := testScheduledRecap(true)
	stale := model.GetMillis() - (ScheduledRecapJobWedgedTimeout + time.Minute).Milliseconds()
	wedged := &model.Job{
		Id:             model.NewId(),
		Type:           model.JobTypeScheduledRecap,
		StartAt:        stale,
		LastActivityAt: stale,
		Data:           map[string]string{"scheduled_recap_id": scheduledRecap.Id},
	}
	var order []string
	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeScheduledRecap, model.JobStatusInProgress).
		Return([]*model.Job{wedged}, nil).
		Once()
	mockStore.JobStore.
		On("UpdateOptimistically", mock.MatchedBy(func(job *model.Job) bool {
			return job == wedged && job.Status == model.JobStatusError &&
				job.Data["scheduled_recap_id"] == scheduledRecap.Id
		}), model.JobStatusInProgress).
		Run(func(args mock.Arguments) {
			order = append(order, "reset")
		}).
		Return(wedged, nil).
		Once()
	mockStore.ScheduledRecapStore.
		On("GetDueBefore", mock.AnythingOfType("int64"), int64(0), "", 100).
		Return([]*model.ScheduledRecap{scheduledRecap}, nil).
		Once()
	mockStore.JobStore.
		On("SaveOnceByTypeAndData", mock.MatchedBy(func(job *model.Job) bool {
			return job.Type == model.JobTypeScheduledRecap &&
				job.Data["scheduled_recap_id"] == scheduledRecap.Id
		}), map[string]string{"scheduled_recap_id": scheduledRecap.Id}).
		Run(func(args mock.Arguments) {
			order = append(order, "enqueue")
		}).
		Return(func(job *model.Job, data map[string]string) *model.Job { return job }, nil).
		Once()
	mockMetrics.On("ObserveRecapScheduledBacklog", int64(1)).Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
	require.Equal(t, []string{"reset", "enqueue"}, order)
}

func TestScheduleJobContinuesWhenWedgedResetFails(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true

	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)

	scheduledRecap := testScheduledRecap(true)
	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeScheduledRecap, model.JobStatusInProgress).
		Return(nil, errors.New("boom")).
		Once()
	mockStore.ScheduledRecapStore.
		On("GetDueBefore", mock.AnythingOfType("int64"), int64(0), "", 100).
		Return([]*model.ScheduledRecap{scheduledRecap}, nil).
		Once()
	mockStore.JobStore.
		On("SaveOnceByTypeAndData", mock.Anything, map[string]string{"scheduled_recap_id": scheduledRecap.Id}).
		Return(func(job *model.Job, data map[string]string) *model.Job { return job }, nil).
		Once()
	mockMetrics.On("ObserveRecapScheduledBacklog", int64(1)).Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}

func TestScheduleJobDrainsBacklogAcrossBatches(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true
	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)
	expectNoWedgedJobs(mockStore)

	recaps := makeDueRecaps(250, model.GetMillis()-1000)
	expectBatch(mockStore, 0, "", 100, recaps[:100])
	expectBatch(mockStore, recaps[99].NextRunAt, recaps[99].Id, 100, recaps[100:200])
	expectBatch(mockStore, recaps[199].NextRunAt, recaps[199].Id, 100, recaps[200:])
	for _, sr := range recaps {
		expectEnqueueOK(mockStore, sr)
	}
	mockMetrics.On("ObserveRecapScheduledBacklog", int64(250)).Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}

func TestScheduleJobStopsAtMaxDueSchedulesPerTick(t *testing.T) {
	tests := []struct {
		name    string
		cap     int
		batches []struct {
			limit int
			size  int
		}
		wantEnqueued int
	}{
		{
			name: "cap splits final batch",
			cap:  150,
			batches: []struct {
				limit int
				size  int
			}{{limit: 100, size: 100}, {limit: 50, size: 50}},
			wantEnqueued: 150,
		},
		{
			name: "cap below batch size",
			cap:  30,
			batches: []struct {
				limit int
				size  int
			}{{limit: 30, size: 30}},
			wantEnqueued: 30,
		},
		{
			name: "cap equals backlog exactly",
			cap:  100,
			batches: []struct {
				limit int
				size  int
			}{{limit: 100, size: 100}},
			wantEnqueued: 100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &model.Config{}
			cfg.SetDefaults()
			cfg.FeatureFlags.EnableAIRecaps = true
			cfg.AIRecapSettings.Processing.MaxDueSchedulesPerTick = model.NewPointer(tt.cap)
			scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)
			expectNoWedgedJobs(mockStore)

			recaps := makeDueRecaps(tt.wantEnqueued, model.GetMillis()-1000)
			var cursorAt int64
			var cursorID string
			offset := 0
			for _, batch := range tt.batches {
				rows := recaps[offset : offset+batch.size]
				expectBatch(mockStore, cursorAt, cursorID, batch.limit, rows)
				offset += batch.size
				last := rows[len(rows)-1]
				cursorAt, cursorID = last.NextRunAt, last.Id
			}
			for _, sr := range recaps {
				expectEnqueueOK(mockStore, sr)
			}
			mockMetrics.On("ObserveRecapScheduledBacklog", int64(tt.wantEnqueued)).Once()

			job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
			require.Nil(t, appErr)
			require.Nil(t, job)
		})
	}
}

func TestScheduleJobCountsDuplicatesTowardCapAndContinuesDrain(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true
	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)
	expectNoWedgedJobs(mockStore)

	recaps := makeDueRecaps(120, model.GetMillis()-1000)
	expectBatch(mockStore, 0, "", 100, recaps[:100])
	expectBatch(mockStore, recaps[99].NextRunAt, recaps[99].Id, 100, recaps[100:])

	duplicates := map[int]struct{}{10: {}, 50: {}, 99: {}}
	for i, sr := range recaps {
		if _, duplicate := duplicates[i]; duplicate {
			expectEnqueueDuplicate(mockStore, sr)
		} else {
			expectEnqueueOK(mockStore, sr)
		}
	}
	mockMetrics.On("ObserveRecapScheduledBacklog", int64(120)).Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}

func TestScheduleJobAbortsTickOnStoreErrorMidDrain(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true
	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)
	expectNoWedgedJobs(mockStore)

	recaps := makeDueRecaps(100, model.GetMillis()-1000)
	expectBatch(mockStore, 0, "", 100, recaps)
	mockStore.ScheduledRecapStore.
		On("GetDueBefore", mock.AnythingOfType("int64"), recaps[99].NextRunAt, recaps[99].Id, 100).
		Return(nil, errors.New("boom")).
		Once()
	for _, sr := range recaps {
		expectEnqueueOK(mockStore, sr)
	}

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
	mockMetrics.AssertNotCalled(t, "ObserveRecapScheduledBacklog", mock.Anything)
}

func TestScheduleJobContinuesPastEnqueueErrorMidBatch(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true
	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)
	expectNoWedgedJobs(mockStore)

	recaps := makeDueRecaps(3, model.GetMillis()-1000)
	expectBatch(mockStore, 0, "", 100, recaps)
	expectEnqueueOK(mockStore, recaps[0])
	expectEnqueueError(mockStore, recaps[1])
	expectEnqueueOK(mockStore, recaps[2])
	mockMetrics.On("ObserveRecapScheduledBacklog", int64(3)).Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}

func TestScheduleJobSetsBacklogGaugeToZeroWhenIdle(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true
	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)
	expectNoWedgedJobs(mockStore)
	expectBatch(mockStore, 0, "", 100, []*model.ScheduledRecap{})
	mockMetrics.On("ObserveRecapScheduledBacklog", int64(0)).Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}

func TestScheduleJobSkipsBacklogGaugeOnStoreError(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true
	scheduler, mockStore, mockMetrics := newSchedulerTest(t, cfg)
	expectNoWedgedJobs(mockStore)
	mockStore.ScheduledRecapStore.
		On("GetDueBefore", mock.AnythingOfType("int64"), int64(0), "", 100).
		Return(nil, errors.New("boom")).
		Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
	mockMetrics.AssertNotCalled(t, "ObserveRecapScheduledBacklog", mock.Anything)
}

func TestScheduleJobNilMetricsIsSafe(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true
	scheduler, mockStore := newSchedulerTestWithMetrics(t, cfg, nil)
	expectNoWedgedJobs(mockStore)
	scheduledRecap := testScheduledRecap(true)
	expectBatch(mockStore, 0, "", 100, []*model.ScheduledRecap{scheduledRecap})
	expectEnqueueOK(mockStore, scheduledRecap)

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}
