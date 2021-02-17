package orphaned_rows

import (
	"context"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	BatchSize          = 1000
	TimeBetweenBatches = 100
)

type OrphanedRowsInterfaceImpl struct {
	app *app.App
}

type OrphanedRowsWorker struct {
	name      string
	stopChan  chan bool
	doneChan  chan bool
	jobsChan  chan model.Job
	jobServer *jobs.JobServer
	app       *app.App
}

func (i *OrphanedRowsInterfaceImpl) MakeWorker() model.Worker {
	return &OrphanedRowsWorker{
		name:      jobName,
		stopChan:  make(chan bool),
		doneChan:  make(chan bool),
		jobsChan:  make(chan model.Job),
		jobServer: i.app.Srv().Jobs,
		app:       i.app,
	}
}

func (w *OrphanedRowsWorker) JobChannel() chan<- model.Job {
	return w.jobsChan
}

func (w *OrphanedRowsWorker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", w.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", w.name))
		close(w.doneChan)
	}()

	for {
		select {
		case <-w.stopChan:
			mlog.Debug("Worker received stop signal", mlog.String("worker", w.name))
			return
		case job := <-w.jobsChan:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", w.name))
			w.doJob(&job)
		}
	}
}

func (w *OrphanedRowsWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", w.name))
	close(w.stopChan)
	<-w.doneChan
}

func (w *OrphanedRowsWorker) doJob(job *model.Job) {
	if claimed, err := w.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("Worker experienced an error while trying to claim job",
			mlog.String("worker", w.name),
			mlog.String("job_id", job.Id),
			mlog.String("error", err.Error()))
		return
	} else if !claimed {
		return
	}

	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan interface{}, 1)
	go w.app.Srv().Jobs.CancellationWatcher(cancelCtx, job.Id, cancelWatcherChan)

	defer func() {
		cancelCancelWatcher()
	}()

	subworkerDoneChans := make([]chan error, 0)
	{
		doneChan := make(chan error)
		subworkerDoneChans = append(subworkerDoneChans, doneChan)
		deleteFunc := func() (int64, error) {
			return w.jobServer.Store.RetentionPolicy().RemoveOrphanedRows(BatchSize)
		}
		go batchDeleter(deleteFunc, w.stopChan, cancelWatcherChan, doneChan)
	}

	// just report the error from the first subworker which fails
	var workerErr error
	for _, ch := range subworkerDoneChans {
		err := <-ch
		if err != nil && workerErr == nil {
			workerErr = err
		}
	}

	if workerErr == nil {
		mlog.Info("Worker: Job is complete", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
		w.setJobSuccess(job)
	} else {
		appError := model.NewAppError("DoPostsBatch", "ent.data_retention.posts_permanent_delete_batch.internal_error", nil, err.Error(), http.StatusInternalServerError)
		w.setJobError()
	}
}

func batchDeleter(deleteFunc func() (int64, error), workerStopChan <-chan bool,
	jobCancelChan <-chan interface{}, jobDoneChan chan<- error) {
	var err error
	defer func() {
		jobDoneChan <- err
	}()
	for {
		select {
		case <-workerStopChan:
			return
		case <-jobCancelChan:
			return
		default:
		}
		var deleted int64
		deleted, err = deleteFunc()
		if err != nil || deleted == 0 {
			return
		}
	}
}

func (w *OrphanedRowsWorker) setJobSuccess(job *model.Job) {
	if err := w.app.Srv().Jobs.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		w.setJobError(job, err)
	}
}

func (w *OrphanedRowsWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := w.app.Srv().Jobs.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}
