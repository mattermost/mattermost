// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

	job, appErr := health_check.MakeScheduler(th.Server.Jobs).ScheduleJob(th.Context, th.App.Config(), false, nil)
	require.Nil(t, appErr)
	require.NotNil(t, job)

	ch := th.Server.Channels()
	ch.startHealthCheckWorkers()
	t.Cleanup(ch.stopHealthCheckWorkers)

	// Poll instead of waiting for the watcher's 15 s interval.
	require.Eventually(t, func() bool {
		ch.healthCheckWorkers.Watcher.PollAndNotify()
		stored, err := th.App.Srv().Store().Job().Get(th.Context, job.Id)
		require.NoError(t, err)
		return stored.Status == model.JobStatusSuccess
	}, 30*time.Second, 100*time.Millisecond)

	stored, err := th.App.Srv().Store().Job().Get(th.Context, job.Id)
	require.NoError(t, err)

	list, appErr := th.App.GetHealthFindings(th.Context, model.HealthFindingFilter{Muted: model.MutedIncluded})
	require.Nil(t, appErr)
	assert.Equal(t, stored.LastActivityAt, list.EvaluatedAt)

	codes := map[string]string{}
	for _, finding := range list.Findings {
		codes[finding.Code] = finding.State
	}
	assert.Equal(t, "firing", codes["SITE_URL_EMPTY"])
}
