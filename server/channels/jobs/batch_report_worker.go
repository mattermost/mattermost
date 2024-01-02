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
	SendReportToUser(rctx request.CTX, userID string, jobId string, format string) *model.AppError
}

type BatchReportWorker[T BatchReportWorkerAppIFace] struct {
	BatchWorker
	app          T
	reportFormat string
	headers      []string
	getData      func(jobData model.StringMap, app T) ([]model.ReportableObject, model.StringMap, bool, error)
}

func MakeBatchReportWorker[T BatchReportWorkerAppIFace](
	jobServer *JobServer,
	store store.Store,
	app T,
	timeBetweenBatches time.Duration,
	reportFormat string,
	headers []string,
	getData func(jobData model.StringMap, app T) ([]model.ReportableObject, model.StringMap, bool, error),
) model.Worker {
	worker := &BatchReportWorker[T]{
		app:          app,
		reportFormat: reportFormat,
		headers:      headers,
		getData:      getData,
	}
	worker.BatchWorker = BatchWorker{
		jobServer:          jobServer,
		logger:             jobServer.Logger(),
		store:              store,
		stop:               make(chan struct{}),
		stopped:            make(chan bool, 1),
		jobs:               make(chan model.Job),
		timeBetweenBatches: timeBetweenBatches,
		doBatch:            worker.doBatch,
	}
	return worker
}

func (worker *BatchReportWorker[T]) doBatch(rctx *request.Context, job *model.Job) bool {
	reportData, nextData, done, err := worker.getData(job.Data, worker.app)
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

	err = worker.saveData(job, reportData)
	if err != nil {
		worker.logger.Error("Worker: Failed to save report batch. Exiting", mlog.Err(err))
		worker.setJobError(worker.logger, job, model.NewAppError("doBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		return true
	}

	for k, v := range nextData {
		job.Data[k] = v
	}

	// TODO add progress?
	worker.jobServer.SetJobProgress(job, 0)
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

func (worker *BatchReportWorker[T]) saveData(job *model.Job, reportData []model.ReportableObject) error {
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

func (worker *BatchReportWorker[T]) complete(rctx request.CTX, job *model.Job) error {
	requestingUserId := job.Data["requesting_user_id"]
	if requestingUserId == "" {
		return errors.New("No user to send the report to")
	}
	fileCount, err := getFileCount(job.Data)
	if err != nil {
		return err
	}

	appErr := worker.app.CompileReportChunks(worker.reportFormat, job.Id, fileCount, worker.headers)
	if appErr != nil {
		return appErr
	}

	if appErr = worker.app.SendReportToUser(rctx, requestingUserId, job.Id, worker.reportFormat); appErr != nil {
		return appErr
	}

	return nil
}
