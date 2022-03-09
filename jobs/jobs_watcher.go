// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"math/rand"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// Default polling interval for jobs termination.
// (Defining as `var` rather than `const` allows tests to lower the interval.)
var DefaultWatcherPollingInterval = 15000

type Watcher struct {
	srv     *JobServer
	workers *Workers

	stop            chan struct{}
	stopped         chan struct{}
	pollingInterval int
	mut             sync.Mutex
}

func (srv *JobServer) MakeWatcher(workers *Workers, pollingInterval int) *Watcher {
	return &Watcher{
		pollingInterval: pollingInterval,
		workers:         workers,
		srv:             srv,
	}
}

func (watcher *Watcher) Start() {
	mlog.Debug("Watcher Started")
	watcher.mut.Lock()
	watcher.stop = make(chan struct{})
	watcher.stopped = make(chan struct{})
	watcher.mut.Unlock()
	// Delay for some random number of milliseconds before starting to ensure that multiple
	// instances of the jobserver  don't poll at a time too close to each other.
	rand.Seed(time.Now().UTC().UnixNano())
	<-time.After(time.Duration(rand.Intn(watcher.pollingInterval)) * time.Millisecond)

	defer func() {
		mlog.Debug("Watcher Finished")
		close(watcher.stopped)
	}()

	for {
		select {
		case <-watcher.stop:
			mlog.Debug("Watcher: Received stop signal")
			return
		case <-time.After(time.Duration(watcher.pollingInterval) * time.Millisecond):
			watcher.PollAndNotify()
		}
	}
}

func (watcher *Watcher) Stop() {
	mlog.Debug("Watcher Stopping")
	watcher.mut.Lock()
	close(watcher.stop)
	<-watcher.stopped
	watcher.mut.Unlock()
}

func (watcher *Watcher) PollAndNotify() {
	jobs, err := watcher.srv.Store.Job().GetAllByStatus(model.JobStatusPending)
	if err != nil {
		mlog.Error("Error occurred getting all pending statuses.", mlog.Err(err))
		return
	}

	for _, job := range jobs {
		worker := watcher.workers.Get(job.Type)
		if worker != nil {
			select {
			case worker.JobChannel() <- *job:
			default:
			}
		}
	}
}
