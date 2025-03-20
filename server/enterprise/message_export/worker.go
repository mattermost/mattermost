// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"context"
	"errors"
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
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

const TimeBetweenBatchesMs = 100

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

func (w *MessageExportWorker) DoJob(job *model.Job) {
	logger := w.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")
	defer w.jobServer.HandleJobPanic(logger, job)

	var appErr *model.AppError
	job, appErr = w.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn("Worker: Error occurred while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	var cancelContext request.CTX = request.EmptyContext(w.logger)
	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	cancelContext = cancelContext.WithContext(cancelCtx)
	go w.jobServer.CancellationWatcher(cancelContext, job.Id, cancelWatcherChan)
	defer cancelCancelWatcher()

	// if job data is missing, we'll do our best to recover
	w.initJobData(logger, job, time.Now())
	data, err := extractJobData(logger, job.Data)
	if err != nil {
		// Error in conversion. Not much we can do about that. But it shouldn't happen, unless someone edited the db.
		w.setJobError(logger, job, model.NewAppError("Job.DoJob", "ent.message_export.job_data_conversion.app_error", nil, "", http.StatusBadRequest).Wrap(err))
		return
	}

	rctx := request.EmptyContext(logger).WithContext(w.context)
	reportProgress := func(message string) {
		logger.Debug(message)
		// Don't fail because we couldn't update progress.
		w.setJobProgressMessage(0, message, rctx.Logger(), job)
	}

	jobParams := shared.BackendParams{
		Config:        w.jobServer.Config(),
		Store:         shared.NewMessageExportStore(w.jobServer.Store),
		HtmlTemplates: w.htmlTemplateWatcher,
	}
	jobParams.FileAttachmentBackend, err = shared.GetFileAttachmentBackend(rctx, w.jobServer.Config())
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("GetFileAttachmentBackend", "api.file.no_driver.app_error", nil, "", http.StatusInternalServerError).Wrap(err))
		return
	}
	jobParams.ExportBackend, err = shared.GetExportBackend(rctx, w.jobServer.Config())
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("GetExportBackend", "api.file.no_driver.app_error", nil, "", http.StatusInternalServerError).Wrap(err))
		return
	}

	data, err = shared.GetInitialExportPeriodData(rctx, jobParams.Store, data, reportProgress)
	if err != nil {
		w.setJobError(logger, job, model.NewAppError("DoJob", "ent.message_export.calculate_channel_exports.app_error", nil, "", http.StatusInternalServerError).Wrap(err))
		return
	}
	job.Data[shared.JobDataTotalPostsExpected] = strconv.Itoa(data.TotalPostsExpected)

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

		case <-time.After(TimeBetweenBatchesMs * time.Millisecond):
			logger.Debug("Starting batch export", mlog.Int("last_post_update_at", data.Cursor.LastPostUpdateAt))

			_, data, err = RunBatch(rctx, data, jobParams)
			if err != nil {
				// We ignore error if the job was explicitly cancelled
				if errors.Is(w.context.Err(), context.Canceled) {
					logger.Debug("Worker: Job has been canceled via worker's context. Setting the job back to pending")
					w.SetJobPending(logger, job)
				} else {
					w.setJobError(logger, job, model.NewAppError("DoJob", "ent.message_export.run_export.app_error", nil, "", http.StatusInternalServerError).Wrap(err))
				}
				return
			}

			setJobDataEndOfBatch(job, data)

			if data.Finished {
				w.finishExport(rctx, logger, job, data.WarningCount)
				return
			}

			// also saves job.Data
			if err := w.setJobProgress(logger, job, getJobProgress(data.MessagesExported, data.TotalPostsExpected)); err != nil {
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

func (w *MessageExportWorker) finishExport(rctx request.CTX, logger *mlog.Logger, job *model.Job, totalWarningCount int) {
	job.Data[shared.JobDataWarningCount] = strconv.Itoa(totalWarningCount)
	// we've exported everything up to the current time
	logger.Debug("FormatExport complete")

	job.Data[shared.JobDataIsDownloadable] = "true"

	if totalWarningCount > 0 {
		w.setJobWarning(logger, job)
	} else {
		w.setJobSuccess(logger, job)
	}
}

// initializes job data if it's missing, allows us to recover from failed or improperly configured jobs
func (w *MessageExportWorker) initJobData(logger mlog.LoggerIFace, job *model.Job, now time.Time) {
	if job.Data == nil {
		job.Data = make(map[string]string)
	}
	if _, exists := job.Data[shared.JobDataMessagesExported]; !exists {
		logger.Info("Worker: JobDataMessagesExported does not exist, starting at 0")
		job.Data[shared.JobDataMessagesExported] = "0"
	}
	if _, exists := job.Data[shared.JobDataExportType]; !exists {
		exportFormat := *w.jobServer.Config().MessageExportSettings.ExportFormat
		logger.Info("Worker: Defaulting to configured export format", mlog.String("export_format", exportFormat))
		job.Data[shared.JobDataExportType] = exportFormat
	}
	if _, exists := job.Data[shared.JobDataBatchSize]; !exists {
		batchSize := strconv.Itoa(*w.jobServer.Config().MessageExportSettings.BatchSize)
		logger.Info("Worker: Defaulting to configured batch size", mlog.String("batch_size", batchSize))
		job.Data[shared.JobDataBatchSize] = batchSize
	}
	if _, exists := job.Data[shared.JobDataChannelBatchSize]; !exists {
		channelBatchSize := strconv.Itoa(*w.jobServer.Config().MessageExportSettings.ChannelBatchSize)
		logger.Info("Worker: Defaulting to configured channel batch size", mlog.String("channel_batch_size", channelBatchSize))
		job.Data[shared.JobDataChannelBatchSize] = channelBatchSize
	}
	if _, exists := job.Data[shared.JobDataChannelHistoryBatchSize]; !exists {
		channelHistoryBatchSize := strconv.Itoa(*w.jobServer.Config().MessageExportSettings.ChannelHistoryBatchSize)
		logger.Info("Worker: Defaulting to configured channel history batch size", mlog.String("channel_history_batch_size", channelHistoryBatchSize))
		job.Data[shared.JobDataChannelHistoryBatchSize] = channelHistoryBatchSize
	}
	if _, exists := job.Data[shared.JobDataBatchNumber]; !exists {
		logger.Info("Worker: JobDataBatchNumber does not exist, starting at 0")
		job.Data[shared.JobDataBatchNumber] = "0"
	}

	// If this is a new job (JobEndTime doesn't exist), set it to now, because this is when the job has first started.
	// The logic is that a job exports messages up to the moment the job was started. If the job was picked up after
	// gracefully stopping, then run it until that original initial endTime.
	// However, if the job was cancelled or errored out, that job will not be picked up again, so this will be a new job
	// starting from the last successful batchStartTimestamp up until now. This is intentional (for now) because failed
	// jobs do not get rescheduled properly yet, and when they are run again it means that new day's worth of messages
	// need to be exported.
	if _, exists := job.Data[shared.JobDataJobEndTime]; !exists {
		millis := strconv.FormatInt(model.GetMillisForTime(now), 10)
		logger.Info("Worker: JobDataJobEndTime not found in previous job, using now", mlog.String("job_data_job_end_time", millis))
		job.Data[shared.JobDataJobEndTime] = millis
	}

	if _, exists := job.Data[shared.JobDataBatchStartTime]; !exists {
		previousJob, err := w.jobServer.Store.Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
		if err != nil {
			exportFromTimestamp := strconv.FormatInt(*w.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10)
			logger.Info("Worker: No previously successful job found, falling back to configured MessageExportSettings.ExportFromTimestamp", mlog.String("export_from_timestamp", exportFromTimestamp))
			job.Data[shared.JobDataBatchStartTime] = exportFromTimestamp
			job.Data[shared.JobDataJobStartTime] = exportFromTimestamp
			job.Data[shared.JobDataBatchStartId] = ""
			job.Data[shared.JobDataJobStartId] = job.Data[shared.JobDataBatchStartId]
			job.Data[shared.JobDataExportDir] = getJobExportDir(logger, job.Data, exportFromTimestamp, job.Data[shared.JobDataJobEndTime])
			return
		}

		logger.Info("Worker: Implicitly resuming export from where previously successful job left off")
		if previousJob == nil {
			previousJob = &model.Job{}
		}
		if previousJob.Data == nil {
			previousJob.Data = make(map[string]string)
		}

		// Backwards compatibility for <10.5:
		if batchStartTimestamp, prevExists := previousJob.Data["batch_start_timestamp"]; prevExists {
			previousJob.Data[shared.JobDataBatchStartTime] = batchStartTimestamp
		}

		if _, prevExists := previousJob.Data[shared.JobDataBatchStartTime]; !prevExists {
			exportFromTimestamp := strconv.FormatInt(*w.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10)
			logger.Info("Worker: Previously successful job lacks job data, falling back to configured MessageExportSettings.ExportFromTimestamp", mlog.String("export_from_timestamp", exportFromTimestamp))
			job.Data[shared.JobDataBatchStartTime] = exportFromTimestamp
			job.Data[shared.JobDataJobStartTime] = exportFromTimestamp
		} else {
			job.Data[shared.JobDataBatchStartTime] = previousJob.Data[shared.JobDataBatchStartTime]
		}
		if _, prevExists := previousJob.Data[shared.JobDataBatchStartId]; !prevExists {
			logger.Info("Worker: Previously successful job lacks post ID, falling back to empty string")
			job.Data[shared.JobDataBatchStartId] = ""
		} else {
			job.Data[shared.JobDataBatchStartId] = previousJob.Data[shared.JobDataBatchStartId]
		}
		job.Data[shared.JobDataJobStartId] = job.Data[shared.JobDataBatchStartId]
	} else {
		logger.Info("Worker: JobDataBatchStartTime start time was already set",
			mlog.String(shared.JobDataBatchStartTime, job.Data[shared.JobDataBatchStartTime]))
	}

	if _, exists := job.Data[shared.JobDataJobStartTime]; !exists {
		// Just in case, if we don't have this (JobDataBatchStartTime was already set, but this wasn't) set it:
		job.Data[shared.JobDataJobStartTime] = job.Data[shared.JobDataBatchStartTime]
		logger.Info("Worker: JobDataJobStartTime start time was not set, using batch startTimestamp",
			mlog.String(shared.JobDataJobStartTime, job.Data[shared.JobDataJobStartTime]))
	}

	job.Data[shared.JobDataExportDir] = getJobExportDir(logger, job.Data, job.Data[shared.JobDataJobStartTime], job.Data[shared.JobDataJobEndTime])
}

func extractJobData(logger *mlog.Logger, strmap map[string]string) (shared.JobData, error) {
	data, err := shared.StringMapToJobDataWithZeroValues(strmap)
	if err != nil {
		return data, err
	}

	// ExportPeriodStartTime is initialized to BatchStartTime because this is where we will start exporting. But unlike
	// BatchStartTime, it won't change as we process the batches.
	// If this is the first time this job has run, BatchStartTime will be the start of the entire job. If this job has
	// been resumed, then BatchStartTime will be the start of the newest batch. This is expected--the channel activity
	// and total posts will be calculated from ExportPeriodStartTime (anything earlier has already been exported in
	// previous batches).
	// Note: ExportPeriodStartTime is different from JobStartTime because JobStartTime won't change
	//	     if the job processes some batches, is stopped, and picked up again.
	data.ExportPeriodStartTime = data.BatchStartTime

	logger.Info("Worker: initial job variables set",
		mlog.String("export_type", data.ExportType),
		mlog.String("export_dir", data.ExportDir),
		mlog.Int("job_start_time", data.JobStartTime),
		mlog.Int("batch_start_time", data.BatchStartTime),
		mlog.Int("export_period_start_time", data.ExportPeriodStartTime),
		mlog.Int("job_end_time", data.JobEndTime),
		mlog.String("job_start_id", data.JobStartId),
		mlog.Int("batch_size", data.BatchSize),
		mlog.Int("channel_batch_size", data.ChannelBatchSize),
		mlog.Int("channel_history_batch_size", data.ChannelHistoryBatchSize),
		mlog.Int("batch_number", data.BatchNumber),
		mlog.Int("total_posts_exported", data.MessagesExported))

	return data, err
}

func setJobDataEndOfBatch(job *model.Job, data shared.JobData) {
	job.Data[shared.JobDataBatchStartTime] = strconv.FormatInt(data.BatchStartTime, 10)
	job.Data[shared.JobDataBatchStartId] = data.Cursor.LastPostId
	job.Data[shared.JobDataMessagesExported] = strconv.Itoa(data.MessagesExported)
	job.Data[shared.JobDataBatchNumber] = strconv.Itoa(data.BatchNumber)
}

// getJobExportDir will use the existing JobDataExportDir if available. If it's not available, this is the first run
// for the job, so we use the startTime and endTime passed in.
func getJobExportDir(logger mlog.LoggerIFace, data model.StringMap, startTime string, endTime string) string {
	exportDir, exists := data[shared.JobDataExportDir]
	if !exists {
		// If we don't have a jobDataExportDir, this is the first run for the job, so we use the batch startTime
		exportDir = path.Join(model.ComplianceExportPath, fmt.Sprintf("%s-%s-%s", time.Now().Format(model.ComplianceExportDirectoryFormat), startTime, endTime))
		logger.Info("Worker: JobDataExportDir does not exist, using current datetime", mlog.String("job_data_export_dir", exportDir))
	}

	return exportDir
}

func getJobProgress(totalExportedPosts, totalPostsExpected int) int {
	return totalExportedPosts * 100 / totalPostsExpected
}

func (w *MessageExportWorker) setJobProgressMessage(progress int64, message string, logger mlog.LoggerIFace, job *model.Job) {
	job.Status = model.JobStatusInProgress
	job.Progress = progress
	if job.Data == nil {
		job.Data = make(map[string]string)
	}
	job.Data["progress_message"] = message

	if _, err := w.jobServer.Store.Job().UpdateOptimistically(job, model.JobStatusInProgress); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
	}
}

func (w *MessageExportWorker) setJobProgress(logger mlog.LoggerIFace, job *model.Job, progress int) error {
	if job.Data != nil {
		job.Data["progress_message"] = ""
	}

	if err := w.jobServer.SetJobProgress(job, int64(progress)); err != nil {
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
		logger.Error("Worker: Failed to set job error", mlog.Err(err), mlog.NamedErr("set_error", appError))
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
