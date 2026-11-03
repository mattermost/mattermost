// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package health_check

import (
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

func TestScheduleJob(t *testing.T) {
	statuses := []string{model.JobStatusPending, model.JobStatusInProgress}

	setup := func(t *testing.T, newest *model.Job) (*Scheduler, *storetest.Store) {
		t.Helper()

		cfg := &model.Config{}
		cfg.SetDefaults()
		mockStore := &storetest.Store{}
		t.Cleanup(func() { mockStore.AssertExpectations(t) })

		if newest != nil {
			mockStore.JobStore.On("GetNewestJobByStatusesAndType", statuses, model.JobTypeHealthCheck).Return(newest, nil)
		} else {
			mockStore.JobStore.On("GetNewestJobByStatusesAndType", statuses, model.JobTypeHealthCheck).Return(nil, store.NewErrNotFound("Job", ""))
		}

		jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: cfg}, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)
		scheduler := MakeScheduler(jobServer, enterpriseLicense)
		jobServer.RegisterJobType(model.JobTypeHealthCheck, nil, scheduler)
		return scheduler, mockStore
	}
	expectSave := func(mockStore *storetest.Store) {
		mockStore.JobStore.On("Save", mock.MatchedBy(func(job *model.Job) bool {
			return job.Type == model.JobTypeHealthCheck && job.Status == model.JobStatusPending
		})).Return(func(job *model.Job) *model.Job { return job }, nil).Once()
	}
	rctx := request.TestContext(t)

	t.Run("creates a job when none is pending or in progress", func(t *testing.T) {
		scheduler, mockStore := setup(t, nil)
		expectSave(mockStore)

		job, appErr := scheduler.ScheduleJob(rctx, nil, false, nil)
		require.Nil(t, appErr)
		require.NotNil(t, job)
		assert.Equal(t, model.JobTypeHealthCheck, job.Type)
	})

	t.Run("skips while a job is pending", func(t *testing.T) {
		scheduler, _ := setup(t, &model.Job{Status: model.JobStatusPending, CreateAt: model.GetMillis()})

		job, appErr := scheduler.ScheduleJob(rctx, nil, false, nil)
		require.Nil(t, appErr)
		assert.Nil(t, job)
	})

	t.Run("skips while a job is in progress", func(t *testing.T) {
		scheduler, _ := setup(t, &model.Job{Status: model.JobStatusInProgress, LastActivityAt: model.GetMillis()})

		job, appErr := scheduler.ScheduleJob(rctx, nil, false, nil)
		require.Nil(t, appErr)
		assert.Nil(t, job)
	})

	t.Run("an in-progress job from a node that died does not block new runs", func(t *testing.T) {
		stale := time.Now().Add(-staleInProgressAfter - time.Minute).UnixMilli()
		scheduler, mockStore := setup(t, &model.Job{Status: model.JobStatusInProgress, LastActivityAt: stale})
		expectSave(mockStore)

		job, appErr := scheduler.ScheduleJob(rctx, nil, false, nil)
		require.Nil(t, appErr)
		require.NotNil(t, job)
	})

	t.Run("skips when the framework reports a pending job", func(t *testing.T) {
		// The newest pending or in-progress job can be a stale in-progress one hiding an older
		// pending job, so pendingJobs is checked first and no store call is expected.
		jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: &model.Config{}}, &storetest.Store{}, nil, mlog.CreateConsoleTestLogger(t), nil)
		scheduler := MakeScheduler(jobServer, enterpriseLicense)

		job, appErr := scheduler.ScheduleJob(rctx, nil, true, nil)
		require.Nil(t, appErr)
		assert.Nil(t, job)
	})

	t.Run("skips below an Enterprise license", func(t *testing.T) {
		for name, license := range map[string]*model.License{
			"no license":   nil,
			"professional": model.NewTestLicenseSKU(model.LicenseShortSkuProfessional),
		} {
			t.Run(name, func(t *testing.T) {
				// No store call is expected: the mock fails on any.
				jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: &model.Config{}}, &storetest.Store{}, nil, mlog.CreateConsoleTestLogger(t), nil)
				scheduler := MakeScheduler(jobServer, func() *model.License { return license })

				job, appErr := scheduler.ScheduleJob(rctx, nil, false, nil)
				require.Nil(t, appErr)
				assert.Nil(t, job)
			})
		}
	})
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
