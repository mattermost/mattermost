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
	// JobDataBatchStartTimestamp is the posts.updateat value from the previous batch. Posts are selected using
	// keyset pagination sorted by (posts.updateat, posts.id).
	JobDataBatchStartTimestamp = "batch_start_timestamp"

	// JobDataBatchStartId is the posts.id value from the previous batch.
	JobDataBatchStartId = "batch_start_id"

	// JobDataStartTimestamp is the point from which this job is exporting. It is JobDataBatchStartTimestamp of the
	// previous job (because that value is incremented and saved after each batch for the next batch or the next job).
	// Or the ExportFromTimestamp setting if not previous job.
	JobDataStartTimestamp = "start_timestamp"

	// JobDataEndTimestamp is the point up to which this job is exporting. It is the time the job was started,
	// i.e., we export everything from the end of previous batch to the moment this batch started.
	JobDataEndTimestamp            = "batch_end_timestamp"
	JobDataStartId                 = "start_id"
	JobDataExportType              = "export_type"
	jobDataBatchSize               = "batch_size"
	jobDataChannelBatchSize        = "channel_batch_size"
	jobDataChannelHistoryBatchSize = "channel_history_batch_size"
	JobDataMessagesExported        = "messages_exported"
	JobDataWarningCount            = "warning_count"
	JobDataIsDownloadable          = "is_downloadable"
	JobDataName                    = "job_name"
	JobDataBatchNumber             = "job_batch_number"
	TimeBetweenBatches             = 100

	estimatedPostCount = 10_000_000
)

// testEndOfBatchCb is only used for testing
var testEndOfBatchCb func(worker *MessageExportWorker)

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

func (w *MessageExportWorker) IsEnabled(cfg *model.Config) bool {
	return w.license() != nil && *w.license().Features.MessageExport && *cfg.MessageExportSettings.EnableExport
}

func (w *MessageExportWorker) Run() {
	w.stateMut.Lock()
	// We have to re-assign the stop channel again, because
	// it might happen that the job was restarted due to a config change.
	if w.stopped {
		w.stopped = false
		w.stopCh = make(chan struct{})
		w.context, w.cancel = context.WithCancel(context.Background())
	} else {
		w.stateMut.Unlock()
		return
	}
	// Run is called from a separate goroutine and doesn't return.
	// So we cannot Unlock in a defer clause.
	w.stateMut.Unlock()

	w.logger.Debug("Worker Started")

	defer func() {
		w.logger.Debug("Worker finished")
		w.stoppedCh <- struct{}{}
	}()

	for {
		select {
		case <-w.stopCh:
			w.logger.Debug("Worker: Received stop signal")
			return
		case job := <-w.jobs:
			w.DoJob(&job)
		}
	}
}

func (w *MessageExportWorker) Stop() {
	w.stateMut.Lock()
	defer w.stateMut.Unlock()

	// Set to close, and if already closed before, then return.
	if w.stopped {
		return
	}
	w.stopped = true

	w.logger.Debug("Worker: Stopping")
	w.cancel()
	close(w.stopCh)
	<-w.stoppedCh
}

func (w *MessageExportWorker) JobChannel() chan<- model.Job {
	return w.jobs
}

func (w *MessageExportWorker) getFileBackend(rctx request.CTX) (filestore.FileBackend, *model.AppError) {
	config := w.jobServer.Config()
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

func (w *MessageExportWorker) DoJob(job *model.Job) {
	logger := w.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")
	defer w.jobServer.HandleJobPanic(logger, job)

	claimed, appErr := w.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Info("Worker: Error occurred while trying to claim job", mlog.Err(appErr))
		return
	}

	if !claimed {
		return
	}

	var cancelContext request.CTX = request.EmptyContext(w.logger)
	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	cancelContext = cancelContext.WithContext(cancelCtx)
	go w.jobServer.CancellationWatcher(cancelContext, job.Id, cancelWatcherChan)
	defer cancelCancelWatcher()

	// if job data is missing, we'll do our best to recover
	w.initJobData(logger, job)

	// the initJobData call above populates the JobDataBatchStartTimestamp in the case of job resumption or a new job
	batchStartTime, err := strconv.ParseInt(job.Data[JobDataBatchStartTimestamp], 10, 64)
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}
	batchStartId := job.Data[JobDataBatchStartId]

	// exportPeriodStartTime is initialized to batchStartTime because this is where we will start exporting. But unlike
	// batchStartTime, it won't change as we process the batches.
	// If this is the first time this job has run, batchStartTime will be the start of the entire job. If this job has
	// been resumed, then batchStartTime will be the start of the newest batch. This is expected--the channel activity
	// and total posts will be calculated from exportPeriodStartTime (anything earlier has already been exported in
	// previous batches).
	exportPeriodStartTime := batchStartTime

	jobEndTime, err := strconv.ParseInt(job.Data[JobDataEndTimestamp], 10, 64)
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}

	jobStartId := job.Data[JobDataStartId]

	batchSize, err := strconv.Atoi(job.Data[jobDataBatchSize])
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}
	channelBatchSize, err := strconv.Atoi(job.Data[jobDataChannelBatchSize])
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}
	channelHistoryBatchSize, err := strconv.Atoi(job.Data[jobDataChannelHistoryBatchSize])
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}

	batchNumber, err := strconv.Atoi(job.Data[JobDataBatchNumber])
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}

	totalPostsExported, err := strconv.ParseInt(job.Data[JobDataMessagesExported], 10, 64)
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("Job.DoJob", model.NoTranslation, nil, "", http.StatusBadRequest).Wrap((err)))
		return
	}

	logger.Info("Worker: initial job variables set",
		mlog.Int("batch_start_time", batchStartTime),
		mlog.Int("export_period_start_time", exportPeriodStartTime),
		mlog.Int("job_end_time", jobEndTime),
		mlog.String("job_start_id", jobStartId),
		mlog.Int("batch_size", batchSize),
		mlog.Int("channel_batch_size", channelBatchSize),
		mlog.Int("channel_history_batch_size", channelHistoryBatchSize),
		mlog.Int("batch_number", batchNumber),
		mlog.Int("total_posts_exported", totalPostsExported))

	// Counting all posts may fail or timeout when the posts table is large. If this happens, log a warning, but carry
	// on with the job anyway. The only issue is that the progress % reporting will be inaccurate.
	// Note: we're not using jobEndTime here because totalPosts is an estimate.
	var totalPosts int64
	count, err := w.jobServer.Store.Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: jobStartId, SinceUpdateAt: exportPeriodStartTime})
	if err != nil {
		logger.Warn("Worker: Failed to fetch total post count for job. An estimated value will be used for progress reporting.", mlog.Err(err))
		totalPosts = estimatedPostCount
	} else {
		totalPosts = count
	}

	// For Actiance: Every time we claim the job, we need to gather the membership data that every batch will use.
	// If we're here, then either this is the start of the job, or the job was stopped (e.g., the worker stopped)
	// and we've claimed it again. Either way, we need to recalculate channel and member history data.
	// TODO: MM-60693 refactor so that all export types use the fixed code path
	var channelMetadata map[string]*common_export.MetadataChannel
	var channelMemberHistories map[string][]*model.ChannelMemberHistoryResult
	if job.Data[JobDataExportType] == model.ComplianceExportTypeActiance {
		rctx := request.EmptyContext(logger).WithContext(w.context)
		reportProgress := func(message string) {
			rctx.Logger().Debug(message)
			// Don't fail because we couldn't update progress.
			_ = w.setJobProgressMessage(0, message, rctx.Logger(), job)
		}
		channelMetadata, channelMemberHistories, err = common_export.CalculateChannelExports(rctx,
			common_export.ChannelExportsParams{
				Store:                   w.jobServer.Store,
				ExportPeriodStartTime:   exportPeriodStartTime,
				ExportPeriodEndTime:     jobEndTime,
				ChannelBatchSize:        channelBatchSize,
				ChannelHistoryBatchSize: channelHistoryBatchSize,
				ReportProgressMessage:   reportProgress,
			})
		if err != nil {
			w.setJobError(logger, job, model.NewAppError("DoJob", "ent.message_export.calculate_channel_exports.app_error", nil, "", http.StatusInternalServerError).Wrap(err))
		}
	}

	var totalWarningCount int64
	cursor := model.MessageExportCursor{LastPostUpdateAt: batchStartTime, LastPostId: batchStartId}
	for {
		select {
		case <-cancelWatcherChan:
			logger.Debug("Worker: Job has been canceled via CancellationWatcher")
			w.setJobCanceled(logger, job)
			return

		case <-w.stopCh:
			logger.Debug("Worker: Job has been canceled via Worker Stop. Setting the job back to pending")
			w.SetJobPending(logger, job)
			return

		case <-time.After(TimeBetweenBatches * time.Millisecond):
			logger.Debug("Starting batch export", mlog.Int("last_post_update_at", cursor.LastPostUpdateAt))
			rctx := request.EmptyContext(logger).WithContext(w.context)

			var postsExported []*model.MessageExport
			var nErr error

			// Using batchSize+1 is a trick to test whether or not we've reached the final batch.
			postsExported, cursor, nErr = w.jobServer.Store.Compliance().MessageExport(rctx, cursor, batchSize+1)
			if nErr != nil {
				// We ignore error if the job was explicitly cancelled
				if w.context.Err() == context.Canceled {
					logger.Debug("Worker: Job has been canceled via worker's context. Setting the job back to pending")
					w.SetJobPending(logger, job)
				} else {
					w.setJobError(logger, job, model.NewAppError("DoJob", "ent.message_export.run_export.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr))
				}
				return
			}

			var batchEndTime int64
			// If we've reached the final batch, we need to include all join/leave events that occur after the lastpost.
			if len(postsExported) == batchSize+1 {
				// remove the last post, we have to leave it for the next batch
				postsExported = postsExported[:len(postsExported)-1]
				cursor.LastPostUpdateAt = *postsExported[len(postsExported)-1].PostUpdateAt
				cursor.LastPostId = *postsExported[len(postsExported)-1].PostId
				batchEndTime = cursor.LastPostUpdateAt
			} else {
				// This will let us pick up the joins/leaves that occur after the lastPostUpdateAt but before jobEndTime
				batchEndTime = jobEndTime
			}

			logger.Debug("Found posts to export", mlog.Int("num_posts", len(postsExported)))
			totalPostsExported += int64(len(postsExported))
			job.Data[JobDataMessagesExported] = strconv.FormatInt(totalPostsExported, 10)

			// batchEndTime will be the jobEndTime if this is the lastBatch (see above)
			job.Data[JobDataBatchStartTimestamp] = strconv.FormatInt(batchEndTime, 10)
			job.Data[JobDataBatchStartId] = cursor.LastPostId

			if len(postsExported) == 0 {
				w.finishExport(rctx, logger, job, totalWarningCount)
				return
			}

			fileBackend, err := w.getFileBackend(rctx)
			if err != nil {
				w.setJobError(logger, job, err)
				return
			}

			batchNumber++
			batchPath := getBatchPath(job.Data[JobDataName], batchStartTime, batchEndTime, batchNumber)
			warningCount, err := runExportByType(rctx, exportParams{
				exportType:             job.Data[JobDataExportType],
				channelMetadata:        channelMetadata,
				channelMemberHistories: channelMemberHistories,
				postsToExport:          postsExported,
				batchPath:              batchPath,
				batchStartTime:         batchStartTime,
				batchEndTime:           batchEndTime,
				db:                     w.jobServer.Store,
				fileBackend:            fileBackend,
				htmlTemplates:          w.htmlTemplateWatcher,
				config:                 w.jobServer.Config(),
			})
			if err != nil {
				w.setJobError(logger, job, err)
				return
			}

			totalWarningCount += warningCount
			job.Data[JobDataBatchNumber] = strconv.Itoa(batchNumber)
			batchStartTime = cursor.LastPostUpdateAt
			job.Data[JobDataBatchStartTimestamp] = strconv.FormatInt(batchStartTime, 10)

			// also saves job.Data
			if err := w.setJobProgress(logger, job, getJobProgress(totalPostsExported, totalPosts)); err != nil {
				// TODO: MM-59093 handle job errors (robust, recoverable)
				return
			}

			// testEndOfBatchCb is only used by tests.
			if testEndOfBatchCb != nil {
				testEndOfBatchCb(w)
			}
		}
	}
}

func (w *MessageExportWorker) finishExport(rctx request.CTX, logger *mlog.Logger, job *model.Job, totalWarningCount int64) {
	job.Data[JobDataWarningCount] = strconv.FormatInt(totalWarningCount, 10)
	// we've exported everything up to the current time
	logger.Debug("FormatExport complete")

	job.Data[JobDataIsDownloadable] = "false"

	if totalWarningCount > 0 {
		w.setJobWarning(logger, job)
	} else {
		w.setJobSuccess(logger, job)
	}
}

// initializes job data if it's missing, allows us to recover from failed or improperly configured jobs
func (w *MessageExportWorker) initJobData(logger mlog.LoggerIFace, job *model.Job) {
	if job.Data == nil {
		job.Data = make(map[string]string)
	}
	if _, exists := job.Data[JobDataMessagesExported]; !exists {
		logger.Info("Worker: JobDataMessagesExported does not exist, starting at 0")
		job.Data[JobDataMessagesExported] = "0"
	}
	if _, exists := job.Data[JobDataExportType]; !exists {
		exportFormat := *w.jobServer.Config().MessageExportSettings.ExportFormat
		logger.Info("Worker: Defaulting to configured export format", mlog.String("export_format", exportFormat))
		job.Data[JobDataExportType] = exportFormat
	}
	if _, exists := job.Data[jobDataBatchSize]; !exists {
		batchSize := strconv.Itoa(*w.jobServer.Config().MessageExportSettings.BatchSize)
		logger.Info("Worker: Defaulting to configured batch size", mlog.String("batch_size", batchSize))
		job.Data[jobDataBatchSize] = batchSize
	}
	if _, exists := job.Data[jobDataChannelBatchSize]; !exists {
		channelBatchSize := strconv.Itoa(*w.jobServer.Config().MessageExportSettings.ChannelBatchSize)
		logger.Info("Worker: Defaulting to configured channel batch size", mlog.String("channel_batch_size", channelBatchSize))
		job.Data[jobDataChannelBatchSize] = channelBatchSize
	}
	if _, exists := job.Data[jobDataChannelHistoryBatchSize]; !exists {
		channelHistoryBatchSize := strconv.Itoa(*w.jobServer.Config().MessageExportSettings.ChannelHistoryBatchSize)
		logger.Info("Worker: Defaulting to configured channel history batch size", mlog.String("channel_history_batch_size", channelHistoryBatchSize))
		job.Data[jobDataChannelHistoryBatchSize] = channelHistoryBatchSize
	}
	if _, exists := job.Data[JobDataName]; !exists {
		jobDataName := time.Now().Format(model.ComplianceExportDirectoryFormat)
		logger.Info("Worker: JobDataName does not exist, using current datetime", mlog.String("job_data_name", jobDataName))
		job.Data[JobDataName] = jobDataName
	}
	if _, exists := job.Data[JobDataBatchNumber]; !exists {
		logger.Info("Worker: JobDataBatchNumber does not exist, starting at 0")
		job.Data[JobDataBatchNumber] = "0"
	}

	// jobEndTime will be now, because this is when the job has been picked up. The logic, for now, is that a job exports
	// messages up to the moment the job was run. If the job was picked up after failure, we run until when this new job
	// was started. This is intentional (for now) because failed jobs do not get rescheduled properly yet, and when they
	// are run again it means that new day's worth of messages need to be exported.
	// TODO: test this on restarted batch -- does it change for restarted job? Which means the job end will shift
	job.Data[JobDataEndTimestamp] = strconv.FormatInt(model.GetMillis(), 10)

	if _, exists := job.Data[JobDataBatchStartTimestamp]; !exists {
		previousJob, err := w.jobServer.Store.Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
		if err != nil {
			exportFromTimestamp := strconv.FormatInt(*w.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10)
			logger.Info("Worker: No previously successful job found, falling back to configured MessageExportSettings.ExportFromTimestamp", mlog.String("export_from_timestamp", exportFromTimestamp))
			job.Data[JobDataBatchStartTimestamp] = exportFromTimestamp
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
			exportFromTimestamp := strconv.FormatInt(*w.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10)
			logger.Info("Worker: Previously successful job lacks job data, falling back to configured MessageExportSettings.ExportFromTimestamp", mlog.String("export_from_timestamp", exportFromTimestamp))
			job.Data[JobDataBatchStartTimestamp] = exportFromTimestamp
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
		logger.Info("Worker: JobDataBatchStartTimestamp start time was already set", mlog.String("batch_start_timestamp", job.Data[JobDataBatchStartTimestamp]))
	}
}

func getJobProgress(totalExportedPosts, totalPosts int64) int64 {
	return totalExportedPosts * 100 / totalPosts
}

func (w *MessageExportWorker) setJobProgressMessage(progress int64, message string, logger mlog.LoggerIFace, job *model.Job) error {
	job.Status = model.JobStatusInProgress
	job.Progress = progress
	if job.Data == nil {
		job.Data = make(map[string]string)
	}
	job.Data["progress_message"] = message

	if _, err := w.jobServer.Store.Job().UpdateOptimistically(job, model.JobStatusInProgress); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		return err
	}
	return nil
}

func (w *MessageExportWorker) setJobProgress(logger mlog.LoggerIFace, job *model.Job, progress int64) error {
	if job.Data != nil {
		job.Data["progress_message"] = ""
	}

	if err := w.jobServer.SetJobProgress(job, progress); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		w.setJobError(logger, job, err)
		return err
	}

	return nil
}

func (w *MessageExportWorker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	// setting progress causes the job data to be saved, which is necessary if we want the next job to pick up where this one left off
	if job.Data != nil {
		job.Data["progress_message"] = ""
	}
	if err := w.jobServer.SetJobProgress(job, 100); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		w.setJobError(logger, job, err)
	}
	if err := w.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("Worker: Failed to set success for job", mlog.Err(err))
		w.setJobError(logger, job, err)
	}
}

func (w *MessageExportWorker) setJobWarning(logger mlog.LoggerIFace, job *model.Job) {
	// setting progress causes the job data to be saved, which is necessary if we want the next job to pick up where this one left off
	if job.Data != nil {
		job.Data["progress_message"] = ""
	}
	if err := w.jobServer.SetJobProgress(job, 100); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		w.setJobError(logger, job, err)
	}
	if err := w.jobServer.SetJobWarning(job); err != nil {
		logger.Error("Worker: Failed to set warning for job", mlog.Err(err))
		w.setJobError(logger, job, err)
	}
}

func (w *MessageExportWorker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if job.Data != nil {
		job.Data["progress_message"] = ""
	}
	logger.Error("Worker: Job error", mlog.Err(appError))
	if err := w.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("Worker: Failed to set job errorv", mlog.Err(err), mlog.NamedErr("set_error", appError))
	}
}

func (w *MessageExportWorker) setJobCanceled(logger mlog.LoggerIFace, job *model.Job) {
	if job.Data != nil {
		job.Data["progress_message"] = ""
	}
	if err := w.jobServer.SetJobCanceled(job); err != nil {
		logger.Error("Worker: Failed to mark job as canceled", mlog.Err(err))
	}
}

func (w *MessageExportWorker) SetJobPending(logger mlog.LoggerIFace, job *model.Job) {
	if job.Data != nil {
		job.Data["progress_message"] = ""
	}
	if err := w.jobServer.SetJobPending(job); err != nil {
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
