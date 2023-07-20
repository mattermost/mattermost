// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package s3_path_migration

import (
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
	JobName = "S3PathMigration"

	timeBetweenBatches = 1 * time.Second
)

type S3PathMigrationWorker struct {
	name        string
	jobServer   *jobs.JobServer
	store       store.Store
	fileBackend *filestore.S3FileBackend

	stop    chan bool
	stopped chan bool
	jobs    chan model.Job
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store, fileBackend filestore.FileBackend) model.Worker {
	// If the type cast fails, it will be nil
	// which is checked later.
	s3Backend, _ := fileBackend.(*filestore.S3FileBackend)
	worker := &S3PathMigrationWorker{
		jobServer:   jobServer,
		store:       store,
		fileBackend: s3Backend,
		name:        JobName,
		stop:        make(chan bool, 1),
		stopped:     make(chan bool, 1),
		jobs:        make(chan model.Job),
	}
	return worker
}

func (worker *S3PathMigrationWorker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", worker.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", worker.name))
		worker.stopped <- true
	}()

	for {
		select {
		case <-worker.stop:
			mlog.Debug("Worker received stop signal", mlog.String("worker", worker.name))
			return
		case job := <-worker.jobs:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", worker.name))
			worker.DoJob(&job)
		}
	}
}

func (worker *S3PathMigrationWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", worker.name))
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
	defer worker.jobServer.HandleJobPanic(job)

	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("S3PathMigrationWorker experienced an error while trying to claim job",
			mlog.String("worker", worker.name),
			mlog.String("job_id", job.Id),
			mlog.Err(err))
		return
	} else if !claimed {
		return
	}

	if worker.fileBackend == nil {
		mlog.Error("S3PathMigrationWorker: no s3 file backend found.")
		return
	}

	var appErr *model.AppError
	// We get the job again because ClaimJob changes the job status.
	job, appErr = worker.jobServer.GetJob(job.Id)
	if appErr != nil {
		mlog.Error("S3PathMigrationWorker: job execution error", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(appErr))
		worker.setJobError(job, appErr)
		return
	}

	totalCount, appErr := worker.getJobMetadata(job, "total_file_count")
	if appErr != nil {
		mlog.Error("S3PathMigrationWorker: failed to get total file count", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(appErr))
		worker.setJobError(job, appErr)
		return
	}
	if totalCount == 0 {
		total, err := worker.store.FileInfo().CountAll()
		if err != nil {
			mlog.Error("S3PathMigrationWorker: failed to count all files", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
			worker.setJobError(job, model.NewAppError("S3PathMigrationWorker", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
			return
		}
		totalCount = int(total)
	}

	// Check if there is metadata for that job.
	// If there isn't, it will be empty by default, which is the right value.
	offset := job.Data["start_file_id"]

	doneCount, appErr := worker.getJobMetadata(job, "done_file_count")
	if appErr != nil {
		mlog.Error("S3PathMigrationWorker: failed to get done file count", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(appErr))
		worker.setJobError(job, appErr)
		return
	}

	createAtOffset, appErr := worker.getJobMetadata(job, "start_create_at")
	if appErr != nil {
		mlog.Error("S3PathMigrationWorker: failed to get start create_at", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(appErr))
		worker.setJobError(job, appErr)
		return
	}

	const pageSize = 100

	for {
		select {
		case <-worker.stop:
			mlog.Info("Worker: S3 Migration has been canceled via Worker Stop. Setting the job back to pending.",
				mlog.String("workername", worker.name),
				mlog.String("job_id", job.Id))
			if err := worker.jobServer.SetJobPending(job); err != nil {
				mlog.Error("Worker: Failed to mark job as pending",
					mlog.String("workername", worker.name),
					mlog.String("job_id", job.Id),
					mlog.Err(err))
			}
			return
		case <-time.After(timeBetweenBatches):
			var files []*model.FileForIndexing
			tries := 0
			for files == nil {
				var err error
				// Iterate through the rows in fileInfo, starting from the metadata ID
				files, err = worker.store.FileInfo().GetFilesBatchForIndexing(int64(createAtOffset), offset, false, pageSize)
				if err != nil {
					if tries > 3 {
						mlog.Error("Worker: Failed to get files after multiple retries. Exiting")
						worker.setJobError(job, model.NewAppError("DoJob", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
						return
					}
					mlog.Warn("Failed to get file info for s3 migration. Retrying .. ", mlog.Err(err))

					// Wait a bit before trying again.
					time.Sleep(15 * time.Second)
				}

				tries++
			}

			if len(files) == 0 {
				mlog.Info("S3PathMigrationWorker: Job is complete", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
				worker.setJobSuccess(job)
				worker.markAsComplete()
				return
			}

			// Take batches of `pageSize`
			for _, f := range files {
				// We do not fail the job if a single image failed to encode.
				if f.Path != "" {
					if err := worker.fileBackend.EncodeFilePathIfNeeded(f.Path); err != nil {
						mlog.Warn("Failed to encode S3 file path", mlog.String("path", f.Path), mlog.Err(err))
					}
				}
				if f.PreviewPath != "" {
					if err := worker.fileBackend.EncodeFilePathIfNeeded(f.PreviewPath); err != nil {
						mlog.Warn("Failed to encode S3 file path", mlog.String("path", f.PreviewPath), mlog.Err(err))
					}
				}
				if f.ThumbnailPath != "" {
					if err := worker.fileBackend.EncodeFilePathIfNeeded(f.ThumbnailPath); err != nil {
						mlog.Warn("Failed to encode S3 file path", mlog.String("path", f.ThumbnailPath), mlog.Err(err))
					}
				}
			}

			// Work on each batch and save the batch starting ID in metadata
			lastFile := files[len(files)-1]
			offset = lastFile.Id
			createAtOffset = int(lastFile.CreateAt)

			if job.Data == nil {
				job.Data = make(model.StringMap)
			}
			job.Data["start_file_id"] = offset
			job.Data["start_create_at"] = strconv.Itoa(createAtOffset)
			doneCount += len(files)
			job.Data["done_file_count"] = strconv.Itoa(doneCount)
			job.Data["total_file_count"] = strconv.Itoa(totalCount)

			worker.jobServer.SetJobProgress(job, int64((doneCount+len(files))/totalCount))
		}
	}
}

func (worker *S3PathMigrationWorker) markAsComplete() {
	system := model.System{
		Name:  model.MigrationKeyS3Path,
		Value: "true",
	}

	if err := worker.jobServer.Store.System().Save(&system); err != nil {
		mlog.Error("Worker: Failed to mark s3 path migration as completed.", mlog.String("workername", worker.name), mlog.Err(err))
	}
}

func (worker *S3PathMigrationWorker) setJobSuccess(job *model.Job) {
	if err := worker.jobServer.SetJobProgress(job, 100); err != nil {
		mlog.Error("Worker: Failed to update progress for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
		worker.setJobError(job, err)
	}

	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		mlog.Error("S3PathMigrationWorker: Failed to set success for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
		worker.setJobError(job, err)
	}
}

func (worker *S3PathMigrationWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		mlog.Error("S3PathMigrationWorker: Failed to set job error", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
	}
}
