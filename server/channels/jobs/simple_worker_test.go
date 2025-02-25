// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs_test

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/stretchr/testify/require"
)

func TestSimpleWorkerClaimOnce(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a job to test with
	job, appErr := th.Server.Jobs.CreateJob(th.Context, model.JobTypeExportProcess, nil)
	require.Nil(t, appErr)

	// Track how many times the execute function is called
	executeCount := 0
	exec := func(_ mlog.LoggerIFace, _ *model.Job) error {
		executeCount++
		return nil
	}

	isEnabled := func(_ *model.Config) bool {
		return true
	}

	sWorker := jobs.NewSimpleWorker("test", th.Server.Jobs, exec, isEnabled)

	// First call should claim the job and execute it
	sWorker.DoJob(job)

	// Wait for the job to complete
	th.WaitForJobStatus(t, job, model.JobStatusSuccess)

	// Second call should fail to claim and return early
	sWorker.DoJob(job)

	// Verify the execute function was only called once
	require.Equal(t, 1, executeCount, "Execute function should be called exactly once")

	// Verify the job status is still success in the database
	updatedJob, appErr := th.Server.Jobs.GetJob(th.Context, job.Id)
	require.Nil(t, appErr)
	th.WaitForJobStatus(t, updatedJob, model.JobStatusSuccess)
}
