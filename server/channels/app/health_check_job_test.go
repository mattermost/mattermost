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
		th := Setup(t)
		saveJob(t, th, &model.Job{Status: model.JobStatusSuccess, CreateAt: model.GetMillis() - 1000})

		job, created, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.True(t, created)
		require.NotNil(t, job)
		assert.Equal(t, model.JobTypeHealthCheck, job.Type)
		assert.Equal(t, model.JobStatusPending, job.Status)
		assert.Equal(t, 2, countJobs(t, th))
	})

	t.Run("returns the pending job", func(t *testing.T) {
		th := Setup(t)
		pending := saveJob(t, th, &model.Job{Status: model.JobStatusPending})

		job, created, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.False(t, created)
		assert.Equal(t, pending.Id, job.Id)
		assert.Equal(t, 1, countJobs(t, th))
	})

	t.Run("returns the job in progress", func(t *testing.T) {
		th := Setup(t)
		running := saveJob(t, th, &model.Job{Status: model.JobStatusInProgress, LastActivityAt: model.GetMillis()})

		job, created, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.False(t, created)
		assert.Equal(t, running.Id, job.Id)
		assert.Equal(t, 1, countJobs(t, th))
	})

	t.Run("a stale job in progress is closed as failed and does not block a new run", func(t *testing.T) {
		th := Setup(t)
		stale := time.Now().Add(-health_check.StaleInProgressAfter - time.Minute).UnixMilli()
		dead := saveJob(t, th, &model.Job{Status: model.JobStatusInProgress, CreateAt: stale, LastActivityAt: stale})

		job, created, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.True(t, created)
		assert.NotEqual(t, dead.Id, job.Id)
		assert.Equal(t, model.JobStatusPending, job.Status)
		assert.Equal(t, 2, countJobs(t, th))

		closed, err := th.App.Srv().Store().Job().Get(th.Context, dead.Id)
		require.NoError(t, err)
		assert.Equal(t, model.JobStatusError, closed.Status)

		// The new run is now the active one.
		again, created, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.False(t, created)
		assert.Equal(t, job.Id, again.Id)
	})

	t.Run("returns a pending job queued behind a stale one", func(t *testing.T) {
		th := Setup(t)
		staleAt := time.Now().Add(-health_check.StaleInProgressAfter - time.Minute).UnixMilli()
		pending := saveJob(t, th, &model.Job{Status: model.JobStatusPending, CreateAt: staleAt - 1000})
		saveJob(t, th, &model.Job{Status: model.JobStatusInProgress, CreateAt: staleAt, LastActivityAt: staleAt})

		job, created, appErr := th.App.StartHealthCheckRun(th.Context)
		require.Nil(t, appErr)
		assert.False(t, created)
		assert.Equal(t, pending.Id, job.Id)
		assert.Equal(t, 2, countJobs(t, th))
	})
}

func TestGetLatestHealthCheckRun(t *testing.T) {
	th := Setup(t)

	_, appErr := th.App.GetLatestHealthCheckRun(th.Context)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode)

	now := model.GetMillis()
	for _, job := range []*model.Job{
		{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusSuccess, CreateAt: now - 2000},
		{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusError, CreateAt: now - 1000},
		{Id: model.NewId(), Type: model.JobTypeMigrations, Status: model.JobStatusPending, CreateAt: now},
	} {
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
	}

	latest, appErr := th.App.GetLatestHealthCheckRun(th.Context)
	require.Nil(t, appErr)
	assert.Equal(t, model.JobStatusError, latest.Status)
	assert.Equal(t, now-1000, latest.CreateAt)
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
