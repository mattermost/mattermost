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
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestScheduleJobEnqueuesEachDueRecapAndSkipsDuplicateAtomically(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true

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

	dueRecap1 := testScheduledRecap(true)
	dueRecap2 := testScheduledRecap(true)
	duplicateRecap := *dueRecap1
	dueRecaps := []*model.ScheduledRecap{dueRecap1, dueRecap2, &duplicateRecap}

	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeScheduledRecap, model.JobStatusInProgress).
		Return([]*model.Job{}, nil).
		Once()
	mockStore.ScheduledRecapStore.
		On("GetDueBefore", mock.AnythingOfType("int64"), 100).
		Return(dueRecaps, nil)

	for _, sr := range []*model.ScheduledRecap{dueRecap1, dueRecap2} {
		mockStore.JobStore.
			On("SaveOnceByTypeAndData", mock.MatchedBy(func(job *model.Job) bool {
				return job.Type == model.JobTypeScheduledRecap &&
					len(job.Data) == 1 &&
					job.Data["scheduled_recap_id"] == sr.Id
			}), map[string]string{"scheduled_recap_id": sr.Id}).
			Return(func(job *model.Job, data map[string]string) *model.Job { return job }, nil).
			Once()
	}

	mockStore.JobStore.
		On("SaveOnceByTypeAndData", mock.MatchedBy(func(job *model.Job) bool {
			return job.Type == model.JobTypeScheduledRecap &&
				job.Data["scheduled_recap_id"] == dueRecap1.Id
		}), map[string]string{"scheduled_recap_id": dueRecap1.Id}).
		Return(nil, nil).
		Once()

	scheduler := MakeScheduler(jobServer, mockStore)
	job, appErr := scheduler.ScheduleJob(request.EmptyContext(mlog.CreateConsoleTestLogger(t)), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}

func TestScheduleJobResetsWedgedJobThenEnqueuesSameTick(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true

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
		On("GetDueBefore", mock.AnythingOfType("int64"), 100).
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

	scheduler := MakeScheduler(jobServer, mockStore)
	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
	require.Equal(t, []string{"reset", "enqueue"}, order)
}

func TestScheduleJobContinuesWhenWedgedResetFails(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true

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

	scheduledRecap := testScheduledRecap(true)
	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeScheduledRecap, model.JobStatusInProgress).
		Return(nil, errors.New("boom")).
		Once()
	mockStore.ScheduledRecapStore.
		On("GetDueBefore", mock.AnythingOfType("int64"), 100).
		Return([]*model.ScheduledRecap{scheduledRecap}, nil).
		Once()
	mockStore.JobStore.
		On("SaveOnceByTypeAndData", mock.Anything, map[string]string{"scheduled_recap_id": scheduledRecap.Id}).
		Return(func(job *model.Job, data map[string]string) *model.Job { return job }, nil).
		Once()

	scheduler := MakeScheduler(jobServer, mockStore)
	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}
