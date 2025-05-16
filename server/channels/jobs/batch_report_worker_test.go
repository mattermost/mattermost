// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs_test

import (
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/stretchr/testify/require"
)

type ReportMockApp struct{}

func (rma *ReportMockApp) SaveReportChunk(format string, prefix string, count int, reportData []model.ReportableObject) *model.AppError {
	return nil
}
func (rma *ReportMockApp) CompileReportChunks(format string, prefix string, numberOfChunks int, headers []string) *model.AppError {
	return nil
}
func (rma *ReportMockApp) SendReportToUser(rctx request.CTX, job *model.Job, format string) *model.AppError {
	return nil
}
func (rma *ReportMockApp) CleanupReportChunks(format string, prefix string, numberOfChunks int) *model.AppError {
	return nil
}

func TestBatchReportWorker(t *testing.T) {
	setupBatchWorker := func(
		t *testing.T,
		th *TestHelper,
		getData func(jobData model.StringMap) ([]model.ReportableObject, model.StringMap, bool, error),
	) (*jobs.BatchReportWorker, *model.Job) {
		t.Helper()

		worker := jobs.MakeBatchReportWorker(
			th.Server.Jobs,
			th.Server.Store(),
			&ReportMockApp{},
			1*time.Second,
			"csv",
			[]string{},
			getData)
		job := th.SetupBatchWorker(t, worker.BatchWorker)
		return worker, job
	}

	waitForFileCount := func(t *testing.T, th *TestHelper, job *model.Job, fileCount int) {
		t.Helper()

		require.Eventuallyf(t, func() bool {
			actualJob, appErr := th.Server.Jobs.GetJob(th.Context, job.Id)
			require.Nil(t, appErr)
			require.Equal(t, job.Id, actualJob.Id)

			finalFileCount, err := strconv.Atoi(actualJob.Data["file_count"])
			require.NoError(t, err)
			return finalFileCount == fileCount
		}, 5*time.Second, 250*time.Millisecond, "job did not stop at batch %d", fileCount)
	}

	getFileCountFromData := func(t *testing.T, data model.StringMap) int {
		t.Helper()

		if data["file_count"] == "" {
			return 0
		}

		fileCount, err := strconv.Atoi(data["file_count"])
		require.NoError(t, err)

		return fileCount
	}

	createData := func(th *TestHelper, data model.StringMap) model.StringMap {
		data["requesting_user_id"] = th.SystemAdminUser.Id
		return data
	}

	t.Run("should finish when the report is done, incrementing file count along the way", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		var worker model.Worker
		var job *model.Job

		iterations := 0

		worker, job = setupBatchWorker(t, th, func(data model.StringMap) ([]model.ReportableObject, model.StringMap, bool, error) {
			fileCount := getFileCountFromData(t, data)
			require.Equal(t, iterations, fileCount)
			require.LessOrEqual(t, fileCount, 3, "only 3 batches should have run")

			iterations++

			if fileCount >= 3 {
				go worker.Stop() // Shut down the worker when the job is done
				return []model.ReportableObject{}, createData(th, data), true, nil
			}

			return []model.ReportableObject{}, createData(th, data), false, nil
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		th.WaitForJobStatus(t, job, model.JobStatusSuccess)
		waitForFileCount(t, th, job, 3)
	})

	t.Run("should fail job when get data throws an error", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		var worker model.Worker
		var job *model.Job
		worker, job = setupBatchWorker(t, th, func(data model.StringMap) ([]model.ReportableObject, model.StringMap, bool, error) {
			go worker.Stop() // Shut down the worker right after this
			return []model.ReportableObject{}, createData(th, data), false, errors.New("failed to fetch data")
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		th.WaitForJobStatus(t, job, model.JobStatusError)
	})
}
