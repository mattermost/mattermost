// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

type BatchReportWorkerAppIFace interface {
	SaveReportChunk(format string, prefix string, count int, reportData []model.ReportableObject) *model.AppError
	CompileReportChunks(format string, prefix string, numberOfChunks int, headers []string) *model.AppError
	SendReportToUser(rctx request.CTX, job *model.Job, format string) *model.AppError
	CleanupReportChunks(format string, prefix string, numberOfChunks int) *model.AppError
}

type BatchReportWorker struct {
	*BatchWorker
	app          BatchReportWorkerAppIFace
	reportFormat string
	headers      []string
	getData      func(jobData model.StringMap) ([]model.ReportableObject, model.StringMap, bool, error)
}

func MakeBatchReportWorker(
	jobServer *JobServer,
	store store.Store,
	app BatchReportWorkerAppIFace,
	timeBetweenBatches time.Duration,
	reportFormat string,
	headers []string,
	getData func(jobData model.StringMap) ([]model.ReportableObject, model.StringMap, bool, error),
) *BatchReportWorker {
	worker := &BatchReportWorker{
		app:          app,
		reportFormat: reportFormat,
		headers:      headers,
		getData:      getData,
	}
	worker.BatchWorker = MakeBatchWorker(jobServer, store, timeBetweenBatches, worker.doBatch)
	return worker
}

func (worker *BatchReportWorker) doBatch(rctx *request.Context, job *model.Job) bool {
	reportData, nextData, done, err := worker.getData(job.Data)
	if err != nil {
		worker.logger.Error("Worker: Failed to get data for report batch. Exiting", mlog.Err(err))
		worker.setJobError(worker.logger, job, model.NewAppError("doBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		return true
	} else if done {
		if err = worker.complete(rctx, job); err != nil {
			worker.logger.Error("Worker: Failed to finish the batch report. Exiting", mlog.Err(err))
			worker.setJobError(worker.logger, job, model.NewAppError("doBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		} else {
			worker.logger.Info("Worker: Report job complete")
			worker.setJobSuccess(worker.logger, job)
		}

		return true
	}

	err = worker.processChunk(job, reportData)
	if err != nil {
		worker.logger.Error("Worker: Failed to save report batch. Exiting", mlog.Err(err))
		worker.setJobError(worker.logger, job, model.NewAppError("doBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		return true
	}

	job.Data = nextData

	// We might be able to add progress for this type of job in the future
	// But for now we can just set to 0
	if err := worker.jobServer.SetJobProgress(job, 0); err != nil {
		worker.logger.Error("Worker: Failed to set job progress", mlog.Err(err))
		return false
	}
	return false
}

func getFileCount(jobData model.StringMap) (int, error) {
	if jobData["file_count"] != "" {
		parsedFileCount, parseErr := strconv.Atoi(jobData["file_count"])
		if parseErr != nil {
			return 0, errors.Wrap(parseErr, "failed to parse file_count")
		}
		return parsedFileCount, nil
	}

	// Assume it hasn't been set
	return 0, nil
}

func (worker *BatchReportWorker) processChunk(job *model.Job, reportData []model.ReportableObject) error {
	fileCount, err := getFileCount(job.Data)
	if err != nil {
		return err
	}

	appErr := worker.app.SaveReportChunk(worker.reportFormat, job.Id, fileCount, reportData)
	if appErr != nil {
		return err
	}

	fileCount++
	job.Data["file_count"] = strconv.Itoa(fileCount)

	return nil
}

func (worker *BatchReportWorker) complete(rctx request.CTX, job *model.Job) error {
	fileCount, err := getFileCount(job.Data)
	if err != nil {
		return err
	}

	appErr := worker.app.CompileReportChunks(worker.reportFormat, job.Id, fileCount, worker.headers)
	if appErr != nil {
		return appErr
	}

	defer func() {
		if err := worker.app.CleanupReportChunks(worker.reportFormat, job.Id, fileCount); err != nil {
			worker.logger.Error("Worker: Failed to cleanup report chunks", mlog.Err(err))
		}
	}()

	if appErr = worker.app.SendReportToUser(rctx, job, worker.reportFormat); appErr != nil {
		return appErr
	}

	return nil
}
