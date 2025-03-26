// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package s3_path_migration

import (
	"errors"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	timeBetweenBatches = 1 * time.Second
)

type S3PathMigrationWorker struct {
	name        string
	jobServer   *jobs.JobServer
	logger      mlog.LoggerIFace
	store       store.Store
	fileBackend *filestore.S3FileBackend

	stop    chan struct{}
	stopped chan bool
	jobs    chan model.Job
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store, fileBackend filestore.FileBackend) *S3PathMigrationWorker {
	// If the type cast fails, it will be nil
	// which is checked later.
	s3Backend, _ := fileBackend.(*filestore.S3FileBackend)
	const workerName = "S3PathMigration"
	worker := &S3PathMigrationWorker{
		name:        workerName,
		jobServer:   jobServer,
		logger:      jobServer.Logger().With(mlog.String("worker_name", workerName)),
		store:       store,
		fileBackend: s3Backend,
		stop:        make(chan struct{}),
		stopped:     make(chan bool, 1),
		jobs:        make(chan model.Job),
	}
	return worker
}

func (worker *S3PathMigrationWorker) Run() {
	worker.logger.Debug("Worker started")
	// We have to re-assign the stop channel again, because
	// it might happen that the job was restarted due to a config change.
	worker.stop = make(chan struct{}, 1)

	defer func() {
		worker.logger.Debug("Worker finished")
		worker.stopped <- true
	}()

	for {
		select {
		case <-worker.stop:
			worker.logger.Debug("Worker received stop signal")
			return
		case job := <-worker.jobs:
			worker.DoJob(&job)
		}
	}
}

func (worker *S3PathMigrationWorker) Stop() {
	worker.logger.Debug("Worker stopping")
	close(worker.stop)
	<-worker.stopped
}

func (worker *S3PathMigrationWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *S3PathMigrationWorker) IsEnabled(_ *model.Config) bool {
	return os.Getenv("MM_CLOUD_FILESTORE_BIFROST") != ""
}

func (worker *S3PathMigrationWorker) getJobMetadata(job *model.Job, key string) (int, *model.AppError) {
	countStr := job.Data[key]
	count := 0
	var err error
	if countStr != "" {
		count, err = strconv.Atoi(countStr)
		if err != nil {
			return 0, model.NewAppError("getJobMetadata", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return count, nil
}

func (worker *S3PathMigrationWorker) DoJob(job *model.Job) {
	logger := worker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")
	defer worker.jobServer.HandleJobPanic(logger, job)

	var appErr *model.AppError
	job, appErr = worker.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn("S3PathMigrationWorker experienced an error while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	if worker.fileBackend == nil {
		err := errors.New("no S3 file backend found")
		logger.Error("S3PathMigrationWorker: ", mlog.Err(err))
		worker.setJobError(logger, job, model.NewAppError("DoJob", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		return
	}

	// Check if there is metadata for that job.
	// If there isn't, it will be empty by default, which is the right value.
	startFileID := job.Data["start_file_id"]

	doneCount, appErr := worker.getJobMetadata(job, "done_file_count")
	if appErr != nil {
		logger.Error("S3PathMigrationWorker: failed to get done file count", mlog.Err(appErr))
		worker.setJobError(logger, job, appErr)
		return
	}

	startTime, appErr := worker.getJobMetadata(job, "start_create_at")
	if appErr != nil {
		logger.Error("S3PathMigrationWorker: failed to get start create_at", mlog.Err(appErr))
		worker.setJobError(logger, job, appErr)
		return
	}
	if startTime == 0 {
		// Time of the commit because we know no files older than that are affected.
		// Exact commit was done on 09:54AM June 27, IST.
		// We take June 26 as an approximation.
		startTime = int(time.Date(2023, time.June, 26, 0, 0, 0, 0, time.UTC).UnixMilli())
	}

	const pageSize = 100

	for {
		select {
		case <-worker.stop:
			logger.Info("Worker: S3 Migration has been canceled via Worker Stop. Setting the job back to pending.")
			if err := worker.jobServer.SetJobPending(job); err != nil {
				worker.logger.Error("Worker: Failed to mark job as pending", mlog.Err(err))
			}
			return
		case <-time.After(timeBetweenBatches):
			var files []*model.FileForIndexing
			tries := 0
			for files == nil {
				var err error
				// Take batches of `pageSize`
				files, err = worker.store.FileInfo().GetFilesBatchForIndexing(int64(startTime), startFileID, true, pageSize)
				if err != nil {
					if tries > 3 {
						logger.Error("Worker: Failed to get files after multiple retries. Exiting")
						worker.setJobError(logger, job, model.NewAppError("DoJob", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
						return
					}
					logger.Warn("Failed to get file info for s3 migration. Retrying .. ", mlog.Err(err))

					// Wait a bit before trying again.
					time.Sleep(15 * time.Second)
				}

				tries++
			}

			if len(files) == 0 {
				logger.Info("S3PathMigrationWorker: Job is complete")
				worker.setJobSuccess(logger, job)
				worker.markAsComplete(logger, job)
				return
			}

			// Iterate through the rows in each page.
			for _, f := range files {
				logger.Debug("Processing file ID", mlog.String("id", f.Id))
				// We do not fail the job if a single image failed to encode.
				if f.Path != "" {
					if err := worker.fileBackend.DecodeFilePathIfNeeded(f.Path); err != nil {
						logger.Warn("Failed to encode S3 file path", mlog.String("path", f.Path), mlog.String("id", f.Id), mlog.Err(err))
					}
				}
				if f.PreviewPath != "" {
					if err := worker.fileBackend.DecodeFilePathIfNeeded(f.PreviewPath); err != nil {
						logger.Warn("Failed to encode S3 file path", mlog.String("path", f.PreviewPath), mlog.String("id", f.Id), mlog.Err(err))
					}
				}
				if f.ThumbnailPath != "" {
					if err := worker.fileBackend.DecodeFilePathIfNeeded(f.ThumbnailPath); err != nil {
						logger.Warn("Failed to encode S3 file path", mlog.String("path", f.ThumbnailPath), mlog.String("id", f.Id), mlog.Err(err))
					}
				}
			}

			// Work on each batch and save the batch starting ID in metadata
			lastFile := files[len(files)-1]
			startFileID = lastFile.Id
			startTime = int(lastFile.CreateAt)

			if job.Data == nil {
				job.Data = make(model.StringMap)
			}
			job.Data["start_file_id"] = startFileID
			job.Data["start_create_at"] = strconv.Itoa(startTime)
			doneCount += len(files)
			job.Data["done_file_count"] = strconv.Itoa(doneCount)
		}
	}
}

func (worker *S3PathMigrationWorker) markAsComplete(logger mlog.LoggerIFace, job *model.Job) {
	system := model.System{
		Name:  model.MigrationKeyS3Path,
		Value: "true",
	}

	// Note that if this fails, then the job would have still succeeded.
	// So it will try to run the same job again next time, but then
	// it will just fall through everything because all files would have
	// converted. The actual job is idempotent, so there won't be a problem.
	if err := worker.jobServer.Store.System().Save(&system); err != nil {
		logger.Error("Worker: Failed to mark s3 path migration as completed in the systems table.", mlog.Err(err))
	}
}

func (worker *S3PathMigrationWorker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobProgress(job, 100); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}

	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("S3PathMigrationWorker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
}

func (worker *S3PathMigrationWorker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("S3PathMigrationWorker: Failed to set job error", mlog.Err(err))
	}
}
