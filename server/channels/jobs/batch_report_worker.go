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
	CompileReportChunks(format string, prefix string, numberOfChunks int) (string, *model.AppError)
	SendReportToUser(userID string, filename string) *model.AppError
}

type BatchReportWorker[T BatchReportWorkerAppIFace] struct {
	BatchWorker[T]
	reportFormat string
	getData      func(jobData model.StringMap, app T) ([]model.ReportableObject, model.StringMap, bool, error)
}

func MakeBatchReportWorker[T BatchReportWorkerAppIFace](
	jobServer *JobServer,
	store store.Store,
	app T,
	timeBetweenBatches time.Duration,
	reportFormat string,
	getData func(jobData model.StringMap, app T) ([]model.ReportableObject, model.StringMap, bool, error),
) model.Worker {
	worker := &BatchReportWorker[T]{
		reportFormat: reportFormat,
		getData:      getData,
	}
	worker.BatchWorker = BatchWorker[T]{
		jobServer:          jobServer,
		logger:             jobServer.Logger(),
		store:              store,
		app:                app,
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
		// TODO getData error
		worker.logger.Error("Worker: Failed to do report batch. Exiting", mlog.Err(err))
		worker.setJobError(worker.logger, job, model.NewAppError("doBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		return true
	} else if done {
		if err = worker.complete(job); err != nil {
			// TODO complete error
			worker.logger.Error("Worker: Failed to do report batch. Exiting", mlog.Err(err))
			worker.setJobError(worker.logger, job, model.NewAppError("doBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		} else {
			worker.logger.Info("Worker: Job is complete")
			worker.setJobSuccess(worker.logger, job)
		}

		return true
	}

	err = worker.saveData(job, reportData)
	if err != nil {
		// TODO saveData error
		worker.logger.Error("Worker: Failed to do report batch. Exiting", mlog.Err(err))
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

func (worker *BatchReportWorker[T]) complete(job *model.Job) error {
	requestingUserId := job.Data["requesting_user_id"]
	if requestingUserId == "" {
		return errors.New("No user to send the report to")
	}
	fileCount, err := getFileCount(job.Data)
	if err != nil {
		return err
	}

	compiledFilename, appErr := worker.app.CompileReportChunks(worker.reportFormat, job.Id, fileCount)
	if appErr != nil {
		return err
	}

	return worker.app.SendReportToUser(requestingUserId, compiledFilename)
}
