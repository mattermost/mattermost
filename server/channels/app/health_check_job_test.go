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
	"github.com/mattermost/mattermost/server/public/shared/request"
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

		job, err := th.App.StartHealthCheckRun(th.Context)
		require.NoError(t, err)
		require.NotNil(t, job)
		assert.Equal(t, model.JobTypeHealthCheck, job.Type)
		assert.Equal(t, model.JobStatusPending, job.Status)
		assert.Equal(t, 2, countJobs(t, th))
	})

	t.Run("returns the pending job", func(t *testing.T) {
		th := setup(t)
		pending := saveJob(t, th, &model.Job{Status: model.JobStatusPending})

		job, err := th.App.StartHealthCheckRun(th.Context)
		require.NoError(t, err)
		assert.Equal(t, pending.Id, job.Id)
		assert.Equal(t, 1, countJobs(t, th))
	})

	t.Run("returns the job in progress", func(t *testing.T) {
		th := setup(t)
		running := saveJob(t, th, &model.Job{Status: model.JobStatusInProgress, LastActivityAt: model.GetMillis()})

		job, err := th.App.StartHealthCheckRun(th.Context)
		require.NoError(t, err)
		assert.Equal(t, running.Id, job.Id)
		assert.Equal(t, 1, countJobs(t, th))
	})

	t.Run("a stale job in progress is closed as failed and does not block a new run", func(t *testing.T) {
		th := setup(t)
		stale := time.Now().Add(-health_check.StaleInProgressAfter - time.Minute).UnixMilli()
		dead := saveJob(t, th, &model.Job{Status: model.JobStatusInProgress, CreateAt: stale, LastActivityAt: stale})

		job, err := th.App.StartHealthCheckRun(th.Context)
		require.NoError(t, err)
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

		job, err := th.App.StartHealthCheckRun(th.Context)
		require.NoError(t, err)
		assert.Equal(t, pending.Id, job.Id)
		assert.Equal(t, 2, countJobs(t, th))
	})

	t.Run("refused with the feature flag off", func(t *testing.T) {
		th := setup(t)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.HealthDashboard = false })

		_, err := th.App.StartHealthCheckRun(th.Context)
		require.Error(t, err)
		appErr := model.AsAppError(err)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
		assert.Equal(t, 0, countJobs(t, th))
	})

	t.Run("creates a pending job on a Professional license", func(t *testing.T) {
		th := setup(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

		job, err := th.App.StartHealthCheckRun(th.Context)
		require.NoError(t, err)
		require.NotNil(t, job)
		assert.Equal(t, model.JobStatusPending, job.Status)
		assert.Equal(t, 1, countJobs(t, th))
	})

	for name, license := range map[string]*model.License{
		"refused without a license":            nil,
		"refused below a Professional license": model.NewTestLicenseSKU(model.LicenseShortSkuE20),
	} {
		t.Run(name, func(t *testing.T) {
			th := setup(t)
			th.App.Srv().SetLicense(license)

			_, err := th.App.StartHealthCheckRun(th.Context)
			require.Error(t, err)
			appErr := model.AsAppError(err)
			assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
			assert.Equal(t, 0, countJobs(t, th))
		})
	}

	t.Run("answers 409 when the run in the way finished before it could be read", func(t *testing.T) {
		th := setup(t)
		saveJob(t, th, &model.Job{Status: model.JobStatusPending})
		jobServer := th.App.Srv().Jobs
		orig := jobServer.Store
		jobServer.Store = &missingActiveRunStore{Store: orig}
		t.Cleanup(func() { jobServer.Store = orig })

		_, err := th.App.StartHealthCheckRun(th.Context)
		require.Error(t, err)
		appErr := model.AsAppError(err)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Equal(t, 1, countJobs(t, th))
	})
}

// missingActiveRunStore makes the lookup of the active run miss, as if that run had just finished.
type missingActiveRunStore struct {
	store.Store
}

func (s *missingActiveRunStore) Job() store.JobStore {
	return missingActiveRunJobs{s.Store.Job()}
}

type missingActiveRunJobs struct {
	store.JobStore
}

func (missingActiveRunJobs) GetNewestJobByStatusesAndType(_ []string, jobType string) (*model.Job, error) {
	return nil, store.NewErrNotFound("Job", jobType)
}

func TestStopHealthCheckWorkersCancelsRunningJob(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.HealthDashboard = true
	})
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	t.Cleanup(func() { th.App.Srv().SetLicense(nil) })

	job, appErr := health_check.MakeScheduler(th.Server.Jobs, th.App.Srv().License).ScheduleJob(th.Context, th.App.Config(), false, nil)
	require.Nil(t, appErr)
	require.NotNil(t, job)

	// The run blocks until its context is canceled, like a collect waiting on a slow node.
	started := make(chan struct{})
	ch := th.Server.Channels()
	ch.startHealthCheckWorkersWithRun(func(rctx request.CTX) error {
		close(started)
		<-rctx.Context().Done()
		return rctx.Context().Err()
	})
	t.Cleanup(ch.stopHealthCheckWorkers)

	ch.healthCheckWorkers.Watcher.PollAndNotify()
	select {
	case <-started:
	case <-time.After(30 * time.Second):
		require.FailNow(t, "health check job did not start")
	}

	stopped := make(chan struct{})
	go func() {
		ch.stopHealthCheckWorkers()
		close(stopped)
	}()
	select {
	case <-stopped:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "stopHealthCheckWorkers did not cancel the running job")
	}
	assert.Nil(t, ch.healthCheckWorkers)

	stored, err := th.App.Srv().Store().Job().Get(th.Context, job.Id)
	require.NoError(t, err)
	assert.Equal(t, model.JobStatusError, stored.Status)
}

// Not parallel: it uses the process-wide latest-version cache that BuildHealthSnapshot reads.
func TestHealthCheckJobEndToEnd(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.HealthDashboard = true
		cfg.ServiceSettings.SiteURL = model.NewPointer("")
	}, LatestVersionURL(latestVersionServer(t).URL))
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	t.Cleanup(func() { th.App.Srv().SetLicense(nil) })

	require.NoError(t, th.App.clearLatestVersionCache())
	t.Cleanup(func() { assert.NoError(t, th.App.clearLatestVersionCache()) })

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
