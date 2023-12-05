// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"fmt"
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
	SaveReportChunk(format string, filename string, reportData []interface{}) error
	CompileReportChunks(format string, filenames []string) (string, error)
	SendReportToUser(userID string, filename string) error
}

type BatchReportWorker struct {
	BatchWorker[BatchReportWorkerAppIFace]
	reportFormat string
	getData      func(jobData model.StringMap, app BatchReportWorkerAppIFace) ([]interface{}, model.StringMap, bool, error)
}

func MakeBatchReportWorker(
	jobServer *JobServer,
	store store.Store,
	app BatchReportWorkerAppIFace,
	timeBetweenBatches time.Duration,
	reportFormat string,
	getData func(jobData model.StringMap, app BatchReportWorkerAppIFace) ([]interface{}, model.StringMap, bool, error),
) model.Worker {
	worker := &BatchReportWorker{
		reportFormat: reportFormat,
		getData:      getData,
	}
	worker.BatchWorker = BatchWorker[BatchReportWorkerAppIFace]{
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

func (worker *BatchReportWorker) doBatch(rctx *request.Context, job *model.Job) bool {
	reportData, nextData, done, err := worker.getData(job.Data, worker.app)
	if err != nil {
		// TODO getData error
		worker.logger.Error("Worker: Failed to do migration batch. Exiting", mlog.Err(err))
		worker.setJobError(worker.logger, job, model.NewAppError("doMigrationBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		return true
	} else if done {
		if err = worker.complete(job); err != nil {
			// TODO complete error
			worker.logger.Error("Worker: Failed to do migration batch. Exiting", mlog.Err(err))
			worker.setJobError(worker.logger, job, model.NewAppError("doMigrationBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		} else {
			worker.logger.Info("Worker: Job is complete")
			worker.setJobSuccess(worker.logger, job)
		}

		return true
	}

	err = worker.saveData(job, reportData)
	if err != nil {
		// TODO saveData error
		worker.logger.Error("Worker: Failed to do migration batch. Exiting", mlog.Err(err))
		worker.setJobError(worker.logger, job, model.NewAppError("doMigrationBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		return true
	}

	for k, v := range nextData {
		job.Data[k] = v
	}

	// TODO add progress?
	worker.jobServer.SetJobProgress(job, 0)
	return false
}

func makeFilename(jobId string, fileCounter int) string {
	return fmt.Sprintf("%s__%d", jobId, fileCounter)
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

func (worker *BatchReportWorker) saveData(job *model.Job, reportData []interface{}) error {
	fileCount, err := getFileCount(job.Data)
	if err != nil {
		return err
	}

	err = worker.app.SaveReportChunk(worker.reportFormat, makeFilename(job.Id, fileCount), reportData)
	if err != nil {
		return err
	}

	fileCount++
	job.Data["file_count"] = strconv.Itoa(fileCount)

	return nil
}

func (worker *BatchReportWorker) complete(job *model.Job) error {
	requestingUserId := job.Data["requesting_user_id"]
	if requestingUserId == "" {
		return errors.New("No user to send the report to")
	}
	fileCount, err := getFileCount(job.Data)
	if err != nil {
		return err
	}

	filenames := []string{}
	for i := 0; i < fileCount; i++ {
		filenames = append(filenames, makeFilename(job.Id, i))
	}

	compiledFilename, err := worker.app.CompileReportChunks(worker.reportFormat, filenames)
	if err != nil {
		return err
	}

	return worker.app.SendReportToUser(requestingUserId, compiledFilename)
}
