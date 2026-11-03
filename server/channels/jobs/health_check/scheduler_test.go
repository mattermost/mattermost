// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package health_check

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func enterpriseLicense() *model.License {
	return model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise)
}

// newScheduler returns a scheduler over a mock store. The mock fails on any call it was not
// told to expect, and checks on cleanup that every expected call happened.
func newScheduler(t *testing.T, licenseFunc func() *model.License) (*Scheduler, *storetest.Store) {
	t.Helper()

	mockStore := &storetest.Store{}
	t.Cleanup(func() { mockStore.AssertExpectations(t) })
	jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: &model.Config{}}, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)
	scheduler := MakeScheduler(jobServer, licenseFunc)
	jobServer.RegisterJobType(model.JobTypeHealthCheck, nil, scheduler)
	return scheduler, mockStore
}

func TestScheduleJob(t *testing.T) {
	rctx := request.TestContext(t)
	expectRunning := func(mockStore *storetest.Store, running *model.Job) {
		var err error
		if running == nil {
			err = store.NewErrNotFound("Job", "")
		}
		mockStore.JobStore.On("GetNewestJobByStatusAndType", model.JobStatusInProgress, model.JobTypeHealthCheck).Return(running, err)
	}
	expectSaveOnce := func(mockStore *storetest.Store) {
		mockStore.JobStore.On("SaveOnce", mock.MatchedBy(func(job *model.Job) bool {
			return job.Type == model.JobTypeHealthCheck && job.Status == model.JobStatusPending
		})).Return(func(job *model.Job) *model.Job { return job }, nil).Once()
	}

	t.Run("creates a job when none is pending or in progress", func(t *testing.T) {
		scheduler, mockStore := newScheduler(t, enterpriseLicense)
		expectRunning(mockStore, nil)
		expectSaveOnce(mockStore)

		job, appErr := scheduler.ScheduleJob(rctx, nil, false, nil)
		require.Nil(t, appErr)
		require.NotNil(t, job)
		assert.Equal(t, model.JobTypeHealthCheck, job.Type)
	})

	t.Run("skips while a job is in progress", func(t *testing.T) {
		scheduler, mockStore := newScheduler(t, enterpriseLicense)
		expectRunning(mockStore, &model.Job{Status: model.JobStatusInProgress, LastActivityAt: model.GetMillis()})

		job, appErr := scheduler.ScheduleJob(rctx, nil, false, nil)
		require.Nil(t, appErr)
		assert.Nil(t, job)
	})

	t.Run("closes an in-progress job from a node that died and creates a new one", func(t *testing.T) {
		scheduler, mockStore := newScheduler(t, enterpriseLicense)
		stale := &model.Job{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusInProgress,
			LastActivityAt: time.Now().Add(-StaleInProgressAfter - time.Minute).UnixMilli()}
		expectRunning(mockStore, stale)
		mockStore.JobStore.On("UpdateStatus", stale.Id, model.JobStatusError).Return(stale, nil).Once()
		expectSaveOnce(mockStore)

		job, appErr := scheduler.ScheduleJob(rctx, nil, false, nil)
		require.Nil(t, appErr)
		require.NotNil(t, job)
	})

	// No store call is expected in these cases.
	for name, tc := range map[string]struct {
		license     *model.License
		pendingJobs bool
	}{
		"skips while a job is pending":      {license: enterpriseLicense(), pendingJobs: true},
		"skips without a license":           {license: nil},
		"skips with a Professional license": {license: model.NewTestLicenseSKU(model.LicenseShortSkuProfessional)},
	} {
		t.Run(name, func(t *testing.T) {
			scheduler, _ := newScheduler(t, func() *model.License { return tc.license })

			job, appErr := scheduler.ScheduleJob(rctx, nil, tc.pendingJobs, nil)
			require.Nil(t, appErr)
			assert.Nil(t, job)
		})
	}
}

func TestSchedulerEnabled(t *testing.T) {
	scheduler := MakeScheduler(nil, enterpriseLicense)
	cfg := &model.Config{}
	cfg.SetDefaults()

	cfg.FeatureFlags.HealthDashboard = false
	assert.False(t, scheduler.Enabled(cfg))
	cfg.FeatureFlags.HealthDashboard = true
	assert.True(t, scheduler.Enabled(cfg))
}

func TestIsStale(t *testing.T) {
	old := time.Now().Add(-StaleInProgressAfter - time.Minute).UnixMilli()
	recent := model.GetMillis()

	assert.True(t, IsStale(&model.Job{Status: model.JobStatusInProgress, LastActivityAt: old}))
	assert.False(t, IsStale(&model.Job{Status: model.JobStatusInProgress, LastActivityAt: recent}))
	// Only a run in progress can be stale: a pending run hasn't started, and a finished one is done.
	assert.False(t, IsStale(&model.Job{Status: model.JobStatusPending, LastActivityAt: old}))
	assert.False(t, IsStale(&model.Job{Status: model.JobStatusSuccess, LastActivityAt: old}))
}

func TestRunningJob(t *testing.T) {
	rctx := request.TestContext(t)
	newJobServer := func(t *testing.T) (*jobs.JobServer, *storetest.Store) {
		scheduler, mockStore := newScheduler(t, enterpriseLicense)
		return scheduler.jobServer, mockStore
	}

	t.Run("none", func(t *testing.T) {
		jobServer, mockStore := newJobServer(t)
		mockStore.JobStore.On("GetNewestJobByStatusAndType", model.JobStatusInProgress, model.JobTypeHealthCheck).Return(nil, store.NewErrNotFound("Job", ""))

		job, appErr := RunningJob(rctx, jobServer)
		require.Nil(t, appErr)
		assert.Nil(t, job)
	})

	t.Run("a job in progress", func(t *testing.T) {
		jobServer, mockStore := newJobServer(t)
		running := &model.Job{Id: model.NewId(), Status: model.JobStatusInProgress, LastActivityAt: model.GetMillis()}
		mockStore.JobStore.On("GetNewestJobByStatusAndType", model.JobStatusInProgress, model.JobTypeHealthCheck).Return(running, nil)

		job, appErr := RunningJob(rctx, jobServer)
		require.Nil(t, appErr)
		assert.Equal(t, running, job)
	})

	t.Run("a stale job is closed as failed", func(t *testing.T) {
		jobServer, mockStore := newJobServer(t)
		stale := &model.Job{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusInProgress,
			LastActivityAt: time.Now().Add(-StaleInProgressAfter - time.Minute).UnixMilli()}
		mockStore.JobStore.On("GetNewestJobByStatusAndType", model.JobStatusInProgress, model.JobTypeHealthCheck).Return(stale, nil)
		mockStore.JobStore.On("UpdateStatus", stale.Id, model.JobStatusError).Return(stale, nil).Once()

		job, appErr := RunningJob(rctx, jobServer)
		require.Nil(t, appErr)
		assert.Nil(t, job)
	})

	t.Run("store error", func(t *testing.T) {
		jobServer, mockStore := newJobServer(t)
		mockStore.JobStore.On("GetNewestJobByStatusAndType", model.JobStatusInProgress, model.JobTypeHealthCheck).Return(nil, errors.New("boom"))

		_, appErr := RunningJob(rctx, jobServer)
		require.NotNil(t, appErr)
	})
}
