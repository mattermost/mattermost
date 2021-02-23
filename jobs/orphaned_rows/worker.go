package orphaned_rows

import (
	"context"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/jobs"
	tjobs "github.com/mattermost/mattermost-server/v5/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	BatchSize          = 1000
	TimeBetweenBatches = 100
)

type StoreWithOrphanedRows interface {
	DeleteOrphanedRows(limit int) (deleted int64, err error)
}

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

func init() {
	app.RegisterJobsOrphanedRowsInterface(func(a *app.App) tjobs.OrphanedRowsInterface {
		return &OrphanedRowsInterfaceImpl{a}
	})
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

func (worker *OrphanedRowsWorker) JobChannel() chan<- model.Job {
	return worker.jobsChan
}

func (worker *OrphanedRowsWorker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", worker.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", worker.name))
		close(worker.doneChan)
	}()

	for {
		select {
		case <-worker.stopChan:
			mlog.Debug("Worker received stop signal", mlog.String("worker", worker.name))
			return
		case job := <-worker.jobsChan:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", worker.name))
			worker.doJob(&job)
		}
	}
}

func (worker *OrphanedRowsWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", worker.name))
	close(worker.stopChan)
	<-worker.doneChan
}

func (worker *OrphanedRowsWorker) doJob(job *model.Job) {
	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("Worker experienced an error while trying to claim job",
			mlog.String("worker", worker.name),
			mlog.String("job_id", job.Id),
			mlog.String("error", err.Error()))
		return
	} else if !claimed {
		return
	}

	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	defer cancelCancelWatcher()
	jobCancelChan := make(chan interface{}, 1)
	go worker.app.Srv().Jobs.CancellationWatcher(cancelCtx, job.Id, jobCancelChan)

	stores := []StoreWithOrphanedRows{
		worker.jobServer.Store.RetentionPolicy(),
		worker.jobServer.Store.Reaction(),
		worker.jobServer.Store.Preference(),
		worker.jobServer.Store.ChannelMemberHistory(),
		worker.jobServer.Store.Post(),
		worker.jobServer.Store.Thread(),
	}
	subworkerDoneChans := make([]chan error, len(stores))
	for i, store := range stores {
		// allocate one slot of space so that we don't have to wait for the subworkers
		// to finish if the job is cancelled
		subworkerDoneChans[i] = make(chan error, 1)
		go batchDeleter(store, worker.stopChan, jobCancelChan, subworkerDoneChans[i])
	}

	var workerErr error
	for _, ch := range subworkerDoneChans {
		select {
		case <-jobCancelChan:
			mlog.Debug("Worker: Job has been canceled via CancellationWatcher", mlog.String("workername", worker.name), mlog.String("job_id", job.Id))
			worker.setJobCanceled(job)
			return
		case <-worker.stopChan:
			mlog.Debug("Worker: Job has been canceled via Worker Stop", mlog.String("workername", worker.name), mlog.String("job_id", job.Id))
			worker.setJobCanceled(job)
			return
		case err := <-ch:
			// just report the error from the first subworker which fails
			if err != nil && workerErr == nil {
				workerErr = err
			}
		}
	}

	if workerErr == nil {
		mlog.Info("Worker: Job is complete", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
		worker.setJobSuccess(job)
	} else {
		appError := model.NewAppError("doJob", "jobs.orphaned_rows.delete_batch.internal_error", nil, workerErr.Error(), http.StatusInternalServerError)
		worker.setJobError(job, appError)
	}
}

func batchDeleter(store StoreWithOrphanedRows, workerStopChan <-chan bool, jobCancelChan <-chan interface{}, jobDoneChan chan<- error) {
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
		case <-time.After(TimeBetweenBatches * time.Millisecond):
		}
		var deleted int64
		deleted, err = store.DeleteOrphanedRows(BatchSize)
		if err != nil || deleted == 0 {
			return
		}
	}
}

func (worker *OrphanedRowsWorker) setJobSuccess(job *model.Job) {
	if err := worker.app.Srv().Jobs.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		worker.setJobError(job, err)
	}
}

func (worker *OrphanedRowsWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := worker.app.Srv().Jobs.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}

func (worker *OrphanedRowsWorker) setJobCanceled(job *model.Job) {
	if err := worker.app.Srv().Jobs.SetJobCanceled(job); err != nil {
		mlog.Error("Worker: Failed to mark job as canceled", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
	}
}
