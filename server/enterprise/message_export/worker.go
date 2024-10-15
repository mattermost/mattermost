// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"context"
	"fmt"
	"net/http"
	"path"
	"strconv"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

const (
	JobDataBatchStartTimestamp = "batch_start_timestamp" // message export uses keyset pagination sorted by (posts.updateat, posts.id). batch_start_timestamp is the posts.updateat value from the previous batch.
	JobDataBatchStartId        = "batch_start_id"        // message export uses keyset pagination sorted by (posts.updateat, posts.id). batch_start_id is the posts.id value from the previous batch.

	JobDataStartTimestamp   = "start_timestamp"
	JobDataStartId          = "start_id"
	JobDataExportType       = "export_type"
	jobDataBatchSize        = "batch_size"
	JobDataMessagesExported = "messages_exported"
	JobDataWarningCount     = "warning_count"
	JobDataIsDownloadable   = "is_downloadable"
	JobDataName             = "job_name"
	JobDataBatchNumber      = "job_batch_number"
	TimeBetweenBatches      = 100

	estimatedPostCount = 10_000_000
)

type MessageExportWorker struct {
	name string
	// stateMut protects stopCh, cancel, and stopped and helps enforce
	// ordering in case subsequent Run or Stop calls are made.
	stateMut            sync.Mutex
	stopCh              chan struct{}
	stopped             bool
	stoppedCh           chan struct{}
	jobs                chan model.Job
	jobServer           *jobs.JobServer
	logger              mlog.LoggerIFace
	htmlTemplateWatcher *templates.Container
	license             func() *model.License

	context context.Context
	cancel  func()
}

func (dr *MessageExportJobInterfaceImpl) MakeWorker() model.Worker {
	const workerName = "MessageExportWorker"
	logger := dr.Server.Jobs.Logger().With(mlog.String("worker_name", workerName))

	templatesDir, ok := fileutils.FindDir("templates")
	if !ok {
		logger.Error("Failed to initialize HTMLTemplateWatcher, templates directory not found")
		return nil
	}
	htmlTemplateWatcher, err := templates.New(templatesDir)
	if err != nil {
		logger.Error("Failed to initialize HTMLTemplateWatcher", mlog.Err(err))
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &MessageExportWorker{
		name:                workerName,
		stoppedCh:           make(chan struct{}, 1),
		jobs:                make(chan model.Job),
		jobServer:           dr.Server.Jobs,
		logger:              logger,
		htmlTemplateWatcher: htmlTemplateWatcher,
		// It is not a best practice to store context inside a struct,
		// however we need to cancel a SQL query during a job execution.
		// There is no other good way.
		context: ctx,
		cancel:  cancel,
		license: dr.Server.License,
		stopped: true,
	}
}

func (worker *MessageExportWorker) IsEnabled(cfg *model.Config) bool {
	return worker.license() != nil && *worker.license().Features.MessageExport && *cfg.MessageExportSettings.EnableExport
}

func (worker *MessageExportWorker) Run() {
	worker.stateMut.Lock()
	// We have to re-assign the stop channel again, because
	// it might happen that the job was restarted due to a config change.
	if worker.stopped {
		worker.stopped = false
		worker.stopCh = make(chan struct{})
		worker.context, worker.cancel = context.WithCancel(context.Background())
	} else {
		worker.stateMut.Unlock()
		return
	}
	// Run is called from a separate goroutine and doesn't return.
	// So we cannot Unlock in a defer clause.
	worker.stateMut.Unlock()

	worker.logger.Debug("Worker Started")

	defer func() {
		worker.logger.Debug("Worker finished")
		worker.stoppedCh <- struct{}{}
	}()

	for {
		select {
		case <-worker.stopCh:
			worker.logger.Debug("Worker: Received stop signal")
			return
		case job := <-worker.jobs:
			worker.DoJob(&job)
		}
	}
}

func (worker *MessageExportWorker) Stop() {
	worker.stateMut.Lock()
	defer worker.stateMut.Unlock()

	// Set to close, and if already closed before, then return.
	if worker.stopped {
		return
	}
	worker.stopped = true

	worker.logger.Debug("Worker: Stopping")
	worker.cancel()
	close(worker.stopCh)
	<-worker.stoppedCh
}

func (worker *MessageExportWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *MessageExportWorker) getFileBackend(rctx request.CTX) (filestore.FileBackend, *model.AppError) {
	config := worker.jobServer.Config()
	insecure := config.ServiceSettings.EnableInsecureOutgoingConnections

	if config.FileSettings.DedicatedExportStore != nil && *config.FileSettings.DedicatedExportStore {
		rctx.Logger().Debug("Worker: using dedicated export filestore", mlog.String("driver_name", *config.FileSettings.ExportDriverName))
		backend, errFileBack := filestore.NewExportFileBackend(filestore.NewExportFileBackendSettingsFromConfig(&config.FileSettings, true, insecure != nil && *insecure))
		if errFileBack != nil {
			return nil, model.NewAppError("getFileBackend", "api.file.no_driver.app_error", nil, "", http.StatusInternalServerError).Wrap(errFileBack)
		}

		return backend, nil
	}

	backend, err := filestore.NewFileBackend(filestore.NewFileBackendSettingsFromConfig(&config.FileSettings, true, insecure != nil && *insecure))
	if err != nil {
		return nil, model.NewAppError("getFileBackend", "api.file.no_driver.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return backend, nil
}

func (worker *MessageExportWorker) DoJob(job *model.Job) {
	logger := worker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")
	defer worker.jobServer.HandleJobPanic(logger, job)

	claimed, appErr := worker.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Info("Worker: Error occurred while trying to claim job", mlog.Err(appErr))
		return
	}

	if !claimed {
		return
	}

	var cancelContext request.CTX = request.EmptyContext(worker.logger)
	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	cancelContext = cancelContext.WithContext(cancelCtx)
	go worker.jobServer.CancellationWatcher(cancelContext, job.Id, cancelWatcherChan)
	defer cancelCancelWatcher()

	// if job data is missing, we'll do our best to recover
	worker.initJobData(logger, job)

	// the initJobData call above populates the create_at timestamp of the first post that we should export
	// incase of job resumption or new job
	batchStartTime, err := strconv.ParseInt(job.Data[JobDataBatchStartTimestamp], 10, 64)
	if err != nil {
		worker.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}
	batchStartId := job.Data[JobDataBatchStartId]

	jobStartTime, err := strconv.ParseInt(job.Data[JobDataStartTimestamp], 10, 64)
	if err != nil {
		worker.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}
	jobStartId := job.Data[JobDataStartId]

	batchSize, err := strconv.Atoi(job.Data[jobDataBatchSize])
	if err != nil {
		worker.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}

	batchNumber, err := strconv.Atoi(job.Data[JobDataBatchNumber])
	if err != nil {
		worker.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}

	totalPostsExported, err := strconv.ParseInt(job.Data[JobDataMessagesExported], 10, 64)
	if err != nil {
		worker.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}

	// Counting all posts may fail or timeout when the posts table is large. If this happens, log a warning, but carry
	// on with the job anyway. The only issue is that the progress % reporting will be inaccurate.
	var totalPosts int64
	if count, err := worker.jobServer.Store.Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: jobStartId, SinceUpdateAt: jobStartTime}); err != nil {
		logger.Warn("Worker: Failed to fetch total post count for job. An estimated value will be used for progress reporting.", mlog.Err(err))
		totalPosts = estimatedPostCount
	} else {
		totalPosts = count
	}

	var totalWarningCount int64
	cursor := model.MessageExportCursor{LastPostUpdateAt: batchStartTime, LastPostId: batchStartId}
	for {
		select {
		case <-cancelWatcherChan:
			logger.Debug("Worker: Job has been canceled via CancellationWatcher")
			worker.setJobCanceled(logger, job)
			return

		case <-worker.stopCh:
			logger.Debug("Worker: Job has been canceled via Worker Stop. Setting the job back to pending")
			worker.SetJobPending(logger, job)
			return

		case <-time.After(TimeBetweenBatches * time.Millisecond):
			logger.Debug("Starting batch export", mlog.Int("last_post_update_at", cursor.LastPostUpdateAt))
			rctx := request.EmptyContext(logger).WithContext(worker.context)
			prevPostUpdateAt := cursor.LastPostUpdateAt

			var postsExported []*model.MessageExport
			var nErr error
			postsExported, cursor, nErr = worker.jobServer.Store.Compliance().MessageExport(rctx, cursor, batchSize)
			if nErr != nil {
				// We ignore error if the job was explicitly cancelled
				// and let it
				if worker.context.Err() == context.Canceled {
					logger.Debug("Worker: Job has been canceled via worker's context. Setting the job back to pending")
					worker.SetJobPending(logger, job)
				} else {
					worker.setJobError(logger, job, model.NewAppError("DoJob", "ent.message_export.run_export.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr))
				}
				return
			}
			logger.Debug("Found posts to export", mlog.Int("number_of_posts", len(postsExported)))
			totalPostsExported += int64(len(postsExported))
			job.Data[JobDataMessagesExported] = strconv.FormatInt(totalPostsExported, 10)
			job.Data[JobDataBatchStartTimestamp] = strconv.FormatInt(cursor.LastPostUpdateAt, 10)
			job.Data[JobDataBatchStartId] = cursor.LastPostId

			if len(postsExported) == 0 {
				worker.finishExport(rctx, logger, job, totalWarningCount)
				return
			}

			fileBackend, err := worker.getFileBackend(rctx)
			if err != nil {
				worker.setJobError(logger, job, err)
				return
			}

			batchNumber++
			batchPath := getBatchPath(job.Data[JobDataName], prevPostUpdateAt, cursor.LastPostUpdateAt, batchNumber)
			warningCount, err := runExportByType(
				rctx,
				job.Data[JobDataExportType],
				postsExported,
				batchPath,
				worker.jobServer.Store,
				fileBackend,
				worker.htmlTemplateWatcher,
				worker.jobServer.Config(),
			)
			if err != nil {
				worker.setJobError(logger, job, err)
				return
			}

			totalWarningCount += warningCount
			job.Data[JobDataBatchNumber] = strconv.Itoa(batchNumber)

			// also saves the last post create time
			if err := worker.jobServer.SetJobProgress(job, getJobProgress(totalPostsExported, totalPosts)); err != nil {
				worker.setJobError(logger, job, err)
				return
			}
		}
	}
}

func (worker *MessageExportWorker) finishExport(rctx request.CTX, logger *mlog.Logger, job *model.Job, totalWarningCount int64) {
	job.Data[JobDataWarningCount] = strconv.FormatInt(totalWarningCount, 10)
	// we've exported everything up to the current time
	logger.Debug("FormatExport complete")

	job.Data[JobDataIsDownloadable] = "false"

	if totalWarningCount > 0 {
		worker.setJobWarning(logger, job)
	} else {
		worker.setJobSuccess(logger, job)
	}
}

// initializes job data if it's missing, allows us to recover from failed or improperly configured jobs
func (worker *MessageExportWorker) initJobData(logger mlog.LoggerIFace, job *model.Job) {
	if job.Data == nil {
		job.Data = make(map[string]string)
	}
	if _, exists := job.Data[JobDataMessagesExported]; !exists {
		job.Data[JobDataMessagesExported] = "0"
	}
	if _, exists := job.Data[JobDataExportType]; !exists {
		logger.Info("Worker: Defaulting to configured export format")
		job.Data[JobDataExportType] = *worker.jobServer.Config().MessageExportSettings.ExportFormat
	}
	if _, exists := job.Data[jobDataBatchSize]; !exists {
		logger.Info("Worker: Defaulting to configured batch size")
		job.Data[jobDataBatchSize] = strconv.Itoa(*worker.jobServer.Config().MessageExportSettings.BatchSize)
	}
	if _, exists := job.Data[JobDataName]; !exists {
		logger.Info("Worker: JobDataName does not exist, using current datetime")
		now := time.Now()
		job.Data[JobDataName] = now.Format(model.ComplianceExportDirectoryFormat)
	}
	if _, exists := job.Data[JobDataBatchNumber]; !exists {
		logger.Info("Worker: JobDataBatchNumber does not exist, starting at 0")
		job.Data[JobDataBatchNumber] = "0"
	}
	if _, exists := job.Data[JobDataBatchStartTimestamp]; !exists {
		previousJob, err := worker.jobServer.Store.Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
		if err != nil {
			logger.Info("Worker: No previously successful job found, falling back to configured MessageExportSettings.ExportFromTimestamp")
			job.Data[JobDataBatchStartTimestamp] = strconv.FormatInt(*worker.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10)
			job.Data[JobDataBatchStartId] = ""
			job.Data[JobDataStartTimestamp] = job.Data[JobDataBatchStartTimestamp]
			job.Data[JobDataStartId] = job.Data[JobDataBatchStartId]
			return
		}

		logger.Info("Worker: Implicitly resuming export from where previously successful job left off")
		if previousJob == nil {
			previousJob = &model.Job{}
		}
		if previousJob.Data == nil {
			previousJob.Data = make(map[string]string)
		}
		if _, prevExists := previousJob.Data[JobDataBatchStartTimestamp]; !prevExists {
			logger.Info("Worker: Previously successful job lacks job data, falling back to configured MessageExportSettings.ExportFromTimestamp")
			job.Data[JobDataBatchStartTimestamp] = strconv.FormatInt(*worker.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10)
		} else {
			job.Data[JobDataBatchStartTimestamp] = previousJob.Data[JobDataBatchStartTimestamp]
		}
		if _, prevExists := previousJob.Data[JobDataBatchStartId]; !prevExists {
			logger.Info("Worker: Previously successful job lacks post ID, falling back to empty string")
			job.Data[JobDataBatchStartId] = ""
		} else {
			job.Data[JobDataBatchStartId] = previousJob.Data[JobDataBatchStartId]
		}
		job.Data[JobDataStartTimestamp] = job.Data[JobDataBatchStartTimestamp]
		job.Data[JobDataStartId] = job.Data[JobDataBatchStartId]
	} else {
		logger.Info("Worker: FormatExport start time explicitly set", mlog.String("new_start_time", job.Data[JobDataBatchStartTimestamp]))
	}
}

func getJobProgress(totalExportedPosts, totalPosts int64) int64 {
	return totalExportedPosts * 100 / totalPosts
}

func (worker *MessageExportWorker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	// setting progress causes the job data to be saved, which is necessary if we want the next job to pick up where this one left off
	if err := worker.jobServer.SetJobProgress(job, 100); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("Worker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
}

func (worker *MessageExportWorker) setJobWarning(logger mlog.LoggerIFace, job *model.Job) {
	// setting progress causes the job data to be saved, which is necessary if we want the next job to pick up where this one left off
	if err := worker.jobServer.SetJobProgress(job, 100); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
	if err := worker.jobServer.SetJobWarning(job); err != nil {
		logger.Error("Worker: Failed to set warning for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
}

func (worker *MessageExportWorker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	logger.Error("Worker: Job error", mlog.Err(appError))
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("Worker: Failed to set job errorv", mlog.Err(err), mlog.NamedErr("set_error", appError))
	}
}

func (worker *MessageExportWorker) setJobCanceled(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobCanceled(job); err != nil {
		logger.Error("Worker: Failed to mark job as canceled", mlog.Err(err))
	}
}

func (worker *MessageExportWorker) SetJobPending(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobPending(job); err != nil {
		logger.Error("Worker: Failed to mark job as pending", mlog.Err(err))
	}
}

func getBatchPath(jobName string, prevPostUpdateAt int64, lastPostUpdateAt int64, batchNumber int) string {
	if jobName == "" {
		jobName = time.Now().Format(model.ComplianceExportDirectoryFormat)
	}
	return path.Join(model.ComplianceExportPath, jobName,
		fmt.Sprintf("batch%03d-%d-%d.zip", batchNumber, prevPostUpdateAt, lastPostUpdateAt))
}
