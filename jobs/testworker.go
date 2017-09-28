// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"context"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
)

type TestWorker struct {
	srv     *JobServer
	name    string
	stop    chan bool
	stopped chan bool
	jobs    chan model.Job
}

func (srv *JobServer) MakeTestWorker(name string) *TestWorker {
	return &TestWorker{
		srv:     srv,
		name:    name,
		stop:    make(chan bool, 1),
		stopped: make(chan bool, 1),
		jobs:    make(chan model.Job),
	}
}

func (worker *TestWorker) Run() {
	l4g.Debug("Worker %v: Started", worker.name)

	defer func() {
		l4g.Debug("Worker %v: Finished", worker.name)
		worker.stopped <- true
	}()

	for {
		select {
		case <-worker.stop:
			l4g.Debug("Worker %v: Received stop signal", worker.name)
			return
		case job := <-worker.jobs:
			l4g.Debug("Worker %v: Received a new candidate job.", worker.name)
			worker.DoJob(&job)
		}
	}
}

func (worker *TestWorker) DoJob(job *model.Job) {
	if claimed, err := worker.srv.ClaimJob(job); err != nil {
		l4g.Error("Job: %v: Error occurred while trying to claim job: %v", job.Id, err.Error())
		return
	} else if !claimed {
		return
	}

	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan interface{}, 1)
	go worker.srv.CancellationWatcher(cancelCtx, job.Id, cancelWatcherChan)

	defer cancelCancelWatcher()

	counter := 0
	for {
		select {
		case <-cancelWatcherChan:
			l4g.Debug("Job %v: Job has been canceled via CancellationWatcher.", job.Id)
			if err := worker.srv.SetJobCanceled(job); err != nil {
				l4g.Error("Failed to mark job: %v as canceled. Error: %v", job.Id, err.Error())
			}
			return
		case <-worker.stop:
			l4g.Debug("Job %v: Job has been canceled via Worker Stop.", job.Id)
			if err := worker.srv.SetJobCanceled(job); err != nil {
				l4g.Error("Failed to mark job: %v as canceled. Error: %v", job.Id, err.Error())
			}
			return
		case <-time.After(5 * time.Second):
			counter++
			if counter > 10 {
				l4g.Debug("Job %v: Job completed.", job.Id)
				if err := worker.srv.SetJobSuccess(job); err != nil {
					l4g.Error("Failed to mark job: %v as succeeded. Error: %v", job.Id, err.Error())
				}
				return
			} else {
				if err := worker.srv.SetJobProgress(job, int64(counter*10)); err != nil {
					l4g.Error("Job: %v: an error occured while trying to set job progress: %v", job.Id, err.Error())
				}
			}
		}
	}
}

func (worker *TestWorker) Stop() {
	l4g.Debug("Worker %v: Stopping", worker.name)
	worker.stop <- true
	<-worker.stopped
}

func (worker *TestWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}
