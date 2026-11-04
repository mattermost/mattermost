// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs/health_check"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestHealthCheckWorkersStartOnAppServersOnly(t *testing.T) {
	t.Run("a server that does not run essential jobs does not start them", func(t *testing.T) {
		th := Setup(t)
		assert.Nil(t, th.Server.Channels().healthCheckWorkers)
	})

	t.Run("an app server starts them whatever RunJobs says", func(t *testing.T) {
		if testing.Short() {
			t.SkipNow()
		}
		dbStore, sqlStore, dbSettings, searchEngine := setupStores(t)
		th := setupTestHelper(dbStore, sqlStore, dbSettings, searchEngine, false, true, func(cfg *model.Config) {
			*cfg.JobSettings.RunJobs = false
		}, []Option{RunEssentialJobs}, t)

		assert.NotNil(t, th.Server.Channels().healthCheckWorkers)
	})
}

func TestStartHealthCheckRun(t *testing.T) {
	setup := func(t *testing.T) *TestHelper {
		th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.HealthDashboard = true })
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		t.Cleanup(func() { th.App.Srv().SetLicense(nil) })
		return th
	}
	saveJob := func(t *testing.T, th *TestHelper, job *model.Job) *model.Job {
		t.Helper()
		job.Id = model.NewId()
		job.Type = model.JobTypeHealthCheck
		if job.CreateAt == 0 {
			job.CreateAt = model.GetMillis()
		}
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		return job
	}
	countJobs := func(t *testing.T, th *TestHelper) int {
		t.Helper()
		jobs, err := th.App.Srv().Store().Job().GetAllByType(th.Context, model.JobTypeHealthCheck)
		require.NoError(t, err)
		return len(jobs)
	}

	t.Run("creates a pending job when none is active", func(t *testing.T) {
		th := setup(t)
		saveJob(t, th, &model.Job{Status: model.JobStatusSuccess, CreateAt: model.GetMillis() - 1000})

		job, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, job)
		assert.Equal(t, model.JobTypeHealthCheck, job.Type)
		assert.Equal(t, model.JobStatusPending, job.Status)
		assert.Equal(t, 2, countJobs(t, th))
	})

	t.Run("returns the pending job", func(t *testing.T) {
		th := setup(t)
		pending := saveJob(t, th, &model.Job{Status: model.JobStatusPending})

		job, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.Equal(t, pending.Id, job.Id)
		assert.Equal(t, 1, countJobs(t, th))
	})

	t.Run("returns the job in progress", func(t *testing.T) {
		th := setup(t)
		running := saveJob(t, th, &model.Job{Status: model.JobStatusInProgress, LastActivityAt: model.GetMillis()})

		job, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.Equal(t, running.Id, job.Id)
		assert.Equal(t, 1, countJobs(t, th))
	})

	t.Run("a stale job in progress is closed as failed and does not block a new run", func(t *testing.T) {
		th := setup(t)
		stale := time.Now().Add(-health_check.StaleInProgressAfter - time.Minute).UnixMilli()
		dead := saveJob(t, th, &model.Job{Status: model.JobStatusInProgress, CreateAt: stale, LastActivityAt: stale})

		job, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.NotEqual(t, dead.Id, job.Id)
		assert.Equal(t, model.JobStatusPending, job.Status)
		assert.Equal(t, 2, countJobs(t, th))

		closed, err := th.App.Srv().Store().Job().Get(th.Context, dead.Id)
		require.NoError(t, err)
		assert.Equal(t, model.JobStatusError, closed.Status)
	})

	t.Run("returns a pending job queued behind a stale one", func(t *testing.T) {
		th := setup(t)
		staleAt := time.Now().Add(-health_check.StaleInProgressAfter - time.Minute).UnixMilli()
		pending := saveJob(t, th, &model.Job{Status: model.JobStatusPending, CreateAt: staleAt - 1000})
		saveJob(t, th, &model.Job{Status: model.JobStatusInProgress, CreateAt: staleAt, LastActivityAt: staleAt})

		job, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.Equal(t, pending.Id, job.Id)
		assert.Equal(t, 2, countJobs(t, th))
	})

	t.Run("refused with the feature flag off", func(t *testing.T) {
		th := setup(t)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.HealthDashboard = false })

		_, appErr := th.App.StartHealthCheckRun(th.Context)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
		assert.Equal(t, 0, countJobs(t, th))
	})

	t.Run("refused without an Enterprise license", func(t *testing.T) {
		th := setup(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

		_, appErr := th.App.StartHealthCheckRun(th.Context)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
		assert.Equal(t, 0, countJobs(t, th))
	})

	// lagReplica makes the job server's lookup of the active run miss, as a lagging read replica
	// would, the given number of times, calling beforeMiss first each time.
	lagReplica := func(t *testing.T, th *TestHelper, misses int, beforeMiss func()) {
		t.Helper()
		jobServer := th.App.Srv().Jobs
		orig := jobServer.Store
		jobServer.Store = &laggingJobStore{Store: orig, misses: misses, beforeMiss: beforeMiss}
		t.Cleanup(func() { jobServer.Store = orig })
	}

	t.Run("returns the pending run once the replica has caught up", func(t *testing.T) {
		th := setup(t)
		pending := saveJob(t, th, &model.Job{Status: model.JobStatusPending})
		lagReplica(t, th, 1, nil)

		job, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.Equal(t, pending.Id, job.Id)
		assert.Equal(t, 1, countJobs(t, th))
	})

	t.Run("starts a run when the blocking run finished before it could be read", func(t *testing.T) {
		th := setup(t)
		pending := saveJob(t, th, &model.Job{Status: model.JobStatusPending})
		lagReplica(t, th, 1, func() {
			_, err := th.App.Srv().Store().Job().UpdateStatus(pending.Id, model.JobStatusSuccess)
			require.NoError(t, err)
		})

		job, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.NotEqual(t, pending.Id, job.Id)
		assert.Equal(t, model.JobStatusPending, job.Status)
		assert.Equal(t, 2, countJobs(t, th))
	})

	t.Run("answers 409 when the blocking run still cannot be read", func(t *testing.T) {
		th := setup(t)
		saveJob(t, th, &model.Job{Status: model.JobStatusPending})
		lagReplica(t, th, 2, nil)

		_, appErr := th.App.StartHealthCheckRun(th.Context)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Equal(t, 1, countJobs(t, th))
	})
}

type laggingJobStore struct {
	store.Store
	misses     int
	beforeMiss func()
}

func (s *laggingJobStore) Job() store.JobStore {
	return &laggingJobs{JobStore: s.Store.Job(), parent: s}
}

type laggingJobs struct {
	store.JobStore
	parent *laggingJobStore
}

func (j *laggingJobs) GetNewestJobByStatusesAndType(statuses []string, jobType string) (*model.Job, error) {
	if j.parent.misses > 0 {
		j.parent.misses--
		if j.parent.beforeMiss != nil {
			j.parent.beforeMiss()
		}
		return nil, store.NewErrNotFound("Job", jobType)
	}
	return j.JobStore.GetNewestJobByStatusesAndType(statuses, jobType)
}

// Not parallel: it uses the process-wide latest-version cache that BuildHealthSnapshot reads.
func TestHealthCheckJobEndToEnd(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.HealthDashboard = true
		cfg.ServiceSettings.SiteURL = model.NewPointer("")
	})
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	t.Cleanup(func() { th.App.Srv().SetLicense(nil) })

	require.NoError(t, th.App.clearLatestVersionCache())
	t.Cleanup(func() { assert.NoError(t, th.App.clearLatestVersionCache()) })
	_, appErr := th.App.GetLatestVersion(th.Context, latestVersionServer(t).URL)
	require.Nil(t, appErr)

	job, appErr := health_check.MakeScheduler(th.Server.Jobs, th.App.Srv().License).ScheduleJob(th.Context, th.App.Config(), false, nil)
	require.Nil(t, appErr)
	require.NotNil(t, job)

	ch := th.Server.Channels()
	ch.startHealthCheckWorkers()
	t.Cleanup(ch.stopHealthCheckWorkers)

	// Poll instead of waiting for the watcher's 15 s interval.
	var stored *model.Job
	require.Eventually(t, func() bool {
		ch.healthCheckWorkers.Watcher.PollAndNotify()
		var err error
		stored, err = th.App.Srv().Store().Job().Get(th.Context, job.Id)
		require.NoError(t, err)
		return stored.Status == model.JobStatusSuccess
	}, 30*time.Second, 100*time.Millisecond)

	list, appErr := th.App.GetHealthFindings(th.Context, model.HealthFindingFilter{Muted: model.MutedIncluded})
	require.Nil(t, appErr)
	assert.Equal(t, stored.LastActivityAt, list.EvaluatedAt)

	codes := map[string]string{}
	for _, finding := range list.Findings {
		codes[finding.Code] = finding.State
	}
	assert.Equal(t, "firing", codes["SITE_URL_EMPTY"])
}
