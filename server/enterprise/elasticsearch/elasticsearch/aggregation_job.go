// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/elastic/go-elasticsearch/v8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	aggregatorJobPollingInterval = 15 * time.Second
	indexDeletionBatchSize       = 20
)

type ElasticsearchAggregatorInterfaceImpl struct {
	Server *app.Server
}

type ElasticsearchAggregatorWorker struct {
	name string
	// stateMut protects stopCh and stopped and helps enforce
	// ordering in case subsequent Run or Stop calls are made.
	stateMut    sync.Mutex
	stopCh      chan struct{}
	stopped     bool
	stoppedCh   chan bool
	jobs        chan model.Job
	jobServer   *jobs.JobServer
	logger      mlog.LoggerIFace
	fileBackend filestore.FileBackend

	client  *elasticsearch.TypedClient
	license func() *model.License
}

func (esi *ElasticsearchAggregatorInterfaceImpl) MakeWorker() model.Worker {
	const workerName = "EnterpriseElasticsearchAggregator"
	worker := ElasticsearchAggregatorWorker{
		name:        workerName,
		stoppedCh:   make(chan bool, 1),
		jobs:        make(chan model.Job),
		jobServer:   esi.Server.Jobs,
		logger:      esi.Server.Jobs.Logger().With(mlog.String("worker_name", workerName)),
		fileBackend: esi.Server.Platform().FileBackend(),
		license:     esi.Server.License,
		stopped:     true,
	}

	return &worker
}

func (worker *ElasticsearchAggregatorWorker) Run() {
	worker.stateMut.Lock()
	// We have to re-assign the stop channel again, because
	// it might happen that the job was restarted due to a config change.
	if worker.stopped {
		worker.stopped = false
		worker.stopCh = make(chan struct{})
	} else {
		worker.stateMut.Unlock()
		return
	}
	// Run is called from a separate goroutine and doesn't return.
	// So we cannot Unlock in a defer clause.
	worker.stateMut.Unlock()

	worker.logger.Debug("Worker Started")

	defer func() {
		worker.logger.Debug("Worker Finished")
		worker.stoppedCh <- true
	}()

	client, err := createTypedClient(worker.logger, worker.jobServer.Config(), worker.fileBackend, false)
	if err != nil {
		worker.logger.Error("Worker Failed to Create Client", mlog.Err(err))
		return
	}

	worker.client = client

	for {
		select {
		case <-worker.stopCh:
			worker.logger.Debug("Worker Received stop signal")
			return
		case job := <-worker.jobs:
			worker.DoJob(&job)
		}
	}
}

func (worker *ElasticsearchAggregatorWorker) IsEnabled(cfg *model.Config) bool {
	if license := worker.license(); license == nil || !*license.Features.Elasticsearch {
		return false
	}

	if *cfg.ElasticsearchSettings.EnableIndexing {
		return true
	}

	return false
}

func (worker *ElasticsearchAggregatorWorker) Stop() {
	worker.stateMut.Lock()
	defer worker.stateMut.Unlock()

	// Set to close, and if already closed before, then return.
	if worker.stopped {
		return
	}
	worker.stopped = true

	worker.logger.Debug("Worker Stopping")
	close(worker.stopCh)
	<-worker.stoppedCh
}

func (worker *ElasticsearchAggregatorWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *ElasticsearchAggregatorWorker) DoJob(job *model.Job) {
	logger := worker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")
	defer worker.jobServer.HandleJobPanic(logger, job)

	var appErr *model.AppError
	job, appErr = worker.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn("Worker: Error occurred while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	logger.Info("Worker: Aggregation job claimed by worker")

	var cancelContext request.CTX = request.EmptyContext(worker.logger)
	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	cancelContext = cancelContext.WithContext(cancelCtx)
	go worker.jobServer.CancellationWatcher(cancelContext, job.Id, cancelWatcherChan)
	defer cancelCancelWatcher()

	rctx := request.EmptyContext(worker.logger)
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	cutoff := today.AddDate(0, 0, -*worker.jobServer.Config().ElasticsearchSettings.AggregatePostsAfterDays+1)

	// Get all the daily Elasticsearch post indexes to work out which days aren't aggregated yet.
	dateFormat := *worker.jobServer.Config().ElasticsearchSettings.IndexPrefix + common.IndexBasePosts + "_2006_01_02"
	datedIndexes := []time.Time{}

	postIndexesResult, err := worker.client.API.Indices.
		Get(*worker.jobServer.Config().ElasticsearchSettings.IndexPrefix + common.IndexBasePosts + "_*").
		Do(rctx.Context())
	if err != nil {
		appError := model.NewAppError("ElasticsearchAggregatorWorker", "ent.elasticsearch.aggregator_worker.get_indexes.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
		worker.setJobError(logger, job, appError)
		return
	}

	for index := range postIndexesResult {
		var indexDate time.Time
		indexDate, err = time.Parse(dateFormat, index)
		if err != nil {
			logger.Warn("Failed to parse date from posts index. Ignoring index.", mlog.String("index", index))
		} else {
			datedIndexes = append(datedIndexes, indexDate)
		}
	}

	// Work out how far back the reindexing (and index deletion) needs to go.
	var oldestDay time.Time
	oldestDayFound := false
	indexesToPurge := []string{}
	for _, date := range datedIndexes {
		if date.Before(cutoff) {
			logger.Debug("Worker: Post index identified for purging", mlog.Time("date", date))
			indexesToPurge = append(indexesToPurge, date.Format(dateFormat))
			if !oldestDayFound || oldestDay.After(date) {
				oldestDay = date
				oldestDayFound = true
			}
		} else {
			logger.Debug("Worker: Post index is within the range to keep", mlog.Time("date", date))
		}
	}

	if !oldestDayFound {
		// Nothing to purge.
		logger.Info("Worker: Aggregation job completed. Nothing to aggregate.")
		worker.setJobSuccess(logger, job)
		return
	}

	// Trigger a reindexing job with the appropriate dates.
	reindexingStartDate := oldestDay
	reindexingEndDate := cutoff

	logger.Info("Worker: Aggregation job reindexing", mlog.String("start_date", reindexingStartDate.Format("2006-01-02")), mlog.String("end_date", reindexingEndDate.Format("2006-01-02")))

	var indexJob *model.Job
	if indexJob, appErr = worker.jobServer.CreateJob(
		rctx,
		model.JobTypeElasticsearchPostIndexing,
		map[string]string{
			"start_time": strconv.FormatInt(reindexingStartDate.UnixNano()/int64(time.Millisecond), 10),
			"end_time":   strconv.FormatInt(reindexingEndDate.UnixNano()/int64(time.Millisecond), 10),
		},
	); appErr != nil {
		logger.Error("Worker: Failed to create indexing job.", mlog.Err(appErr))
		appError := model.NewAppError("ElasticsearchAggregatorWorker", "ent.elasticsearch.aggregator_worker.create_index_job.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(appErr)
		worker.setJobError(logger, job, appError)
		return
	}

	for {
		select {
		case <-cancelWatcherChan:
			logger.Info("Worker: Aggregation job has been canceled via CancellationWatcher")
			worker.setJobCanceled(logger, job)
			return

		case <-worker.stopCh:
			logger.Info("Worker: Aggregation job has been canceled via Worker Stop")
			worker.setJobCanceled(logger, job)
			return

		case <-time.After(aggregatorJobPollingInterval):
			// Get the details of the indexing job we are waiting on.
			indexJob, err = worker.jobServer.Store.Job().Get(rctx, indexJob.Id)
			if err != nil {
				var appErr *model.AppError
				var nfErr *store.ErrNotFound
				switch {
				case errors.As(err, &nfErr):
					appErr = model.NewAppError("DoJob", "app.job.get.app_error", nil, "", http.StatusNotFound).Wrap(nfErr)
				default:
					appErr = model.NewAppError("DoJob", "app.job.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
				worker.setJobError(logger, job, appErr)
				return
			}

			// Wait for the aggregation job to finish.
			// On success, we delete the old indexes.
			// Otherwise, fail the job.
			switch indexJob.Status {
			case model.JobStatusSuccess:
				// We limit the number of indexes to delete at one shot.
				// A minor side-effect of this is that the aggregation job status
				// will be redundantly queried multiple times, but that's not a major bottleneck.
				curWindow := indexesToPurge
				deleteMore := false
				if len(indexesToPurge) > indexDeletionBatchSize {
					curWindow = indexesToPurge[:indexDeletionBatchSize]
					indexesToPurge = indexesToPurge[indexDeletionBatchSize:]
					deleteMore = true
				}
				// Delete indexes
				if _, err = worker.client.Indices.Delete(strings.Join(curWindow, ",")).Do(rctx.Context()); err != nil {
					appError := model.NewAppError("ElasticsearchAggregatorWorker", "ent.elasticsearch.aggregator_worker.delete_indexes.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
					logger.Error("Worker: Failed to delete indexes for job", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(appError))
					worker.setJobError(logger, job, appError)
					return
				}

				if !deleteMore {
					// Job done. Set the status to success.
					logger.Info("Worker: Aggregation job finished successfully")
					worker.setJobSuccess(logger, job)
					return
				}
			case model.JobStatusPending, model.JobStatusInProgress:
				// Indexing job is in progress or pending. Update the progress of this job.
				if err := worker.jobServer.SetJobProgress(job, indexJob.Progress); err != nil {
					logger.Error("Worker: Failed to set progress for job", mlog.Err(err))
					worker.setJobError(logger, job, err)
					return
				}
			default:
				// error case
				appError := model.NewAppError("ElasticsearchAggregatorWorker", "ent.elasticsearch.aggregator_worker.index_job_failed.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
				logger.Error("Worker: Index aggregation job failed", mlog.Err(appError))
				worker.setJobError(logger, job, appError)
				return
			}
		}
	}
}

func (worker *ElasticsearchAggregatorWorker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("Worker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
}

func (worker *ElasticsearchAggregatorWorker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("Worker: Failed to set job error", mlog.Err(err))
	}
}

func (worker *ElasticsearchAggregatorWorker) setJobCanceled(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobCanceled(job); err != nil {
		logger.Error("Worker: Failed to mark job as canceled", mlog.Err(err))
	}
}
