// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// PoolWorker is a worker that processes up to poolSize jobs of its job type
// concurrently on a single node. It behaves like SimpleWorker in every other
// respect: jobs are received over an unbuffered channel from the jobs
// watcher, claimed via the cluster-safe optimistic status update, and their
// results recorded through the JobServer.
//
// The pool size is evaluated once per Run from the current config; config
// changes take effect the next time the worker is restarted.
type PoolWorker struct {
	name      string
	jobServer *JobServer
	logger    mlog.LoggerIFace
	execute   func(logger mlog.LoggerIFace, job *model.Job) error
	isEnabled func(cfg *model.Config) bool
	poolSize  func(cfg *model.Config) int
	jobs      chan model.Job

	// stateMut protects stop/stopped and enforces ordering in case
	// subsequent Run or Stop calls are made.
	stateMut  sync.Mutex
	stopped   bool
	stop      chan struct{}
	stoppedCh chan struct{}
}

func NewPoolWorker(name string, jobServer *JobServer, execute func(logger mlog.LoggerIFace, job *model.Job) error, isEnabled func(cfg *model.Config) bool, poolSize func(cfg *model.Config) int) *PoolWorker {
	return &PoolWorker{
		name:      name,
		jobServer: jobServer,
		logger:    jobServer.Logger().With(mlog.String("worker_name", name)),
		execute:   execute,
		isEnabled: isEnabled,
		poolSize:  poolSize,
		jobs:      make(chan model.Job),
		stopped:   true,
		stoppedCh: make(chan struct{}, 1),
	}
}

// Run starts the worker pool. It blocks until Stop is called and all
// in-flight jobs have finished. Calling Run while already running is a no-op.
func (worker *PoolWorker) Run() {
	worker.stateMut.Lock()
	// Re-create the stop channel in case the worker was previously stopped
	// and is now being restarted (e.g. via a config change).
	if worker.stopped {
		worker.stopped = false
		worker.stop = make(chan struct{})
	} else {
		worker.stateMut.Unlock()
		return
	}
	// Run blocks until the pool drains, so we cannot Unlock in a defer.
	worker.stateMut.Unlock()

	size := worker.poolSize(worker.jobServer.Config())
	if size < 1 {
		worker.logger.Warn("PoolWorker: pool size must be at least 1", mlog.Int("configured_pool_size", size))
		size = 1
	}

	worker.logger.Debug("Worker started", mlog.Int("pool_size", size))

	var wg sync.WaitGroup
	wg.Add(size)
	for range size {
		go func() {
			defer wg.Done()
			for {
				select {
				case <-worker.stop:
					return
				case job := <-worker.jobs:
					worker.DoJob(&job)
				}
			}
		}()
	}

	wg.Wait()
	worker.logger.Debug("Worker finished")
	worker.stoppedCh <- struct{}{}
}

// Stop signals the pool to stop and waits for all in-flight jobs to finish.
// Calling Stop when not running is a no-op.
func (worker *PoolWorker) Stop() {
	worker.stateMut.Lock()
	defer worker.stateMut.Unlock()

	if worker.stopped {
		return
	}
	worker.stopped = true

	worker.logger.Debug("Worker stopping")
	close(worker.stop)
	<-worker.stoppedCh
}

func (worker *PoolWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *PoolWorker) IsEnabled(cfg *model.Config) bool {
	return worker.isEnabled(cfg)
}

func (worker *PoolWorker) DoJob(job *model.Job) {
	claimAndExecuteJob(worker.jobServer, worker.logger, "PoolWorker", job, worker.execute)
}
