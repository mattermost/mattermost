// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delivery_tracking_content_review

import (
	"context"
	"errors"
	"maps"
	"net/http"
	"strconv"
	"sync/atomic"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const defaultBatchSize = 2000

type sourceReader interface {
	GetByPost(ctx context.Context, postID string, after model.UserPostDeliveryCursor, limit int) ([]model.UserPostDelivery, error)
}

type reviewWriter interface {
	SaveBatch(ctx context.Context, reviewPostID string, records []model.UserPostDelivery, jobID string) error
}

type AppIface interface {
	NotifyDeliveryTrackingContentReviewRequesters(rctx request.CTX, job *model.Job, succeeded bool) *model.AppError
}

// Worker copies a flagged post's delivery-tracking rows from the source
// UserPostDelivery table (which may live in a dedicated second DB) into the
// primary-DB UserPostDeliveryContentReview table so content reviewers can read
// them locally. It is triggered on demand (one job per post) and is a pure
// copier: eligibility (feature enabled, post under review) is enforced by the
// app-layer trigger before the job is created.
type Worker struct {
	name      string
	stop      chan struct{}
	stopped   chan bool
	jobs      chan model.Job
	jobServer *jobs.JobServer
	logger    mlog.LoggerIFace
	store     store.Store
	app       AppIface
	closed    atomic.Int32
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store, app AppIface) *Worker {
	const workerName = "DeliveryTrackingContentReview"
	worker := Worker{
		name:      workerName,
		stop:      make(chan struct{}),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: jobServer,
		logger:    jobServer.Logger().With(mlog.String("worker_name", workerName)),
		store:     store,
		app:       app,
	}

	return &worker
}

func (worker *Worker) Run() {
	// Set to open if closed before. We are not bothered about multiple opens.
	if worker.closed.CompareAndSwap(1, 0) {
		worker.stop = make(chan struct{})
	}
	worker.logger.Debug("Worker started")

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

func (worker *Worker) Stop() {
	// Set to close, and if already closed before, then return.
	if !worker.closed.CompareAndSwap(0, 1) {
		return
	}
	worker.logger.Debug("Worker stopping")
	close(worker.stop)
	<-worker.stopped
}

func (worker *Worker) JobChannel() chan<- model.Job {
	return worker.jobs
}

// IsEnabled always returns true: the worker is registered unconditionally and
// the feature gate is enforced at job-creation time. This ensures a runtime
// enable (without a restart) does not leave the job type unregistered.
func (worker *Worker) IsEnabled(_ *model.Config) bool {
	return true
}

func (worker *Worker) DoJob(job *model.Job) {
	logger := worker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")

	defer worker.jobServer.HandleJobPanic(logger, job)

	var appErr *model.AppError
	job, appErr = worker.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn("Worker experienced an error while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	postID := job.Data["post_id"]
	if postID == "" {
		worker.setJobError(logger, job, model.NewAppError("DeliveryTrackingContentReviewWorker", "app.job.error", nil, "missing post_id in job data", http.StatusBadRequest))
		return
	}

	previewIDs, previewErr := worker.store.Post().GetPostPreviews(request.EmptyContext(worker.logger), postID)
	if previewErr != nil {
		logger.Error("Worker: failed to load previewing posts", mlog.Err(previewErr))
		worker.setJobError(logger, job, model.NewAppError("DeliveryTrackingContentReviewWorker", "app.job.error", nil, "", http.StatusInternalServerError).Wrap(previewErr))
		return
	}
	postIDs := append([]string{postID}, previewIDs...)

	batchSize := defaultBatchSize
	configuredBatchSize := model.SafeDereference(worker.jobServer.Config().DeliveryTrackingSettings.ContentReviewDeliveryReceiptCopyBatchSize)
	if configuredBatchSize > 0 {
		batchSize = configuredBatchSize
	}

	var cancelContext request.CTX = request.EmptyContext(worker.logger)
	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	cancelContext = cancelContext.WithContext(cancelCtx)
	go worker.jobServer.CancellationWatcher(cancelContext, job.Id, cancelWatcherChan)
	defer cancelCancelWatcher()

	shouldStop := func() bool {
		select {
		case <-cancelWatcherChan:
			return true
		case <-worker.stop:
			return true
		default:
			return false
		}
	}

	// onProgress persists the running count. SetJobSuccess only writes status (not
	// Data), so PatchJobData is what makes records_copied durable. Unlike a full-Data
	// overwrite (UpdateInProgressJobData), PatchJobData merges under a serializable
	// transaction, so a reviewer appended to requested_by concurrently is preserved
	// rather than clobbered. The returned map refreshes our snapshot with any such
	// concurrent additions.
	onProgress := func(copied int) error {
		merged, err := worker.store.Job().PatchJobData(job.Id, model.StringMap{"records_copied": strconv.Itoa(copied)}, overwriteJobData)
		if err != nil {
			return err
		}
		if merged != nil {
			job.Data = merged
		}
		return nil
	}

	copied, canceled, err := copyPostDeliveries(context.Background(), worker.store.UserPostDelivery(), worker.store.UserPostDeliveryContentReview(), postID, postIDs, job.Id, batchSize, shouldStop, onProgress)
	if err != nil {
		if errors.Is(err, store.ErrUserPostDeliverySourceUnavailable) {
			// The feature was enabled at runtime without a restart, so the source
			// pool was never created. Fail loudly rather than report a misleading
			// empty receipt list.
			logger.Error("Worker: delivery-tracking source pool is unavailable; a server restart is required after enabling the feature")
			worker.setJobError(logger, job, model.NewAppError("DeliveryTrackingContentReviewWorker", "app.job.error", nil, "delivery tracking source pool unavailable; server restart required", http.StatusServiceUnavailable))
			return
		}
		logger.Error("Worker: failed to copy delivery records", mlog.Err(err))
		worker.setJobError(logger, job, model.NewAppError("DeliveryTrackingContentReviewWorker", "app.job.error", nil, "", http.StatusInternalServerError).Wrap(err))
		return
	}

	if canceled {
		logger.Debug("Worker: Job has been canceled")
		worker.setJobCanceled(logger, job)
		return
	}

	// Persist the final count (also covers the zero-rows case).
	if progressErr := onProgress(copied); progressErr != nil {
		logger.Error("Worker: failed to persist final job data", mlog.Err(progressErr))
		worker.setJobError(logger, job, model.NewAppError("DeliveryTrackingContentReviewWorker", "app.job.error", nil, "", http.StatusInternalServerError).Wrap(progressErr))
		return
	}

	logger.Info("Worker: Job is complete", mlog.Int("records_copied", copied))
	worker.setJobSuccess(logger, job)
}

// overwriteJobData is the merge used for progress updates: it copies every key of
// patch onto existing, leaving all other keys (e.g. requested_by) untouched. It is a
// pure function of its inputs, so PatchJobData may safely re-run it on a
// serializable-transaction retry.
func overwriteJobData(existing, patch model.StringMap) model.StringMap {
	if existing == nil {
		existing = model.StringMap{}
	}
	maps.Copy(existing, patch)
	return existing
}

// copyPostDeliveries copies the source delivery rows for every post in postIDs (the
// reviewed post plus the posts that preview it) into the review of reviewPostID, in
// keyset-paginated batches. Each row keeps its own post_id (provenance) while
// review_post_id is stamped to reviewPostID. It polls shouldStop between batches (for
// cancellation/shutdown) and calls onProgress with the running total after each
// written batch. It returns the number of rows copied, whether it stopped early due
// to shouldStop, and the first error encountered (e.g.
// store.ErrUserPostDeliverySourceUnavailable when the source pool is not configured).
func copyPostDeliveries(ctx context.Context, source sourceReader, target reviewWriter, reviewPostID string, postIDs []string, jobID string, batchSize int, shouldStop func() bool, onProgress func(copied int) error) (int, bool, error) {
	if batchSize <= 0 {
		batchSize = defaultBatchSize
	}

	copied := 0
	for _, postID := range postIDs {
		var cursor model.UserPostDeliveryCursor
		for {
			if shouldStop != nil && shouldStop() {
				return copied, true, nil
			}

			batch, err := source.GetByPost(ctx, postID, cursor, batchSize)
			if err != nil {
				return copied, false, err
			}

			if len(batch) > 0 {
				if err := target.SaveBatch(ctx, reviewPostID, batch, jobID); err != nil {
					return copied, false, err
				}
				copied += len(batch)

				last := batch[len(batch)-1]
				cursor = model.UserPostDeliveryCursor{TargetID: last.TargetID, TargetType: last.TargetType, Mechanism: last.Mechanism}

				if onProgress != nil {
					if err := onProgress(copied); err != nil {
						return copied, false, err
					}
				}
			}

			// A short page means this post's source rows are exhausted.
			if len(batch) < batchSize {
				break
			}
		}
	}
	return copied, false, nil
}

func (worker *Worker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("Worker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
		return
	}
	worker.notifyRequesters(logger, job, true)
}

func (worker *Worker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("Worker: Failed to set job error", mlog.Err(err))
	}
	worker.notifyRequesters(logger, job, false)
}

// Canceled jobs are transient (shutdown/redeploy) and will rerun, so requesters are not notified.
func (worker *Worker) setJobCanceled(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobCanceled(job); err != nil {
		logger.Error("Worker: Failed to mark job as canceled", mlog.Err(err))
	}
}

func (worker *Worker) notifyRequesters(logger mlog.LoggerIFace, job *model.Job, succeeded bool) {
	if worker.app == nil {
		return
	}

	rctx := request.EmptyContext(worker.logger)
	if appErr := worker.app.NotifyDeliveryTrackingContentReviewRequesters(rctx, job, succeeded); appErr != nil {
		logger.Error("Worker: Failed to notify delivery-tracking requesters of job completion", mlog.Err(appErr), mlog.Bool("succeeded", succeeded))
	}
}
