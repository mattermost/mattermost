// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/store"
)

type TestJob struct {
	store store.Store

	name    string
	stop    chan bool
	stopped chan bool
}

func MakeTestJob(s store.Store, name string) *TestJob {
	return &TestJob{
		store:   s,
		name:    name,
		stop:    make(chan bool, 1),
		stopped: make(chan bool, 1),
	}
}

func (job *TestJob) Run() {
	l4g.Debug("Job %v: Started", job.name)

	running := true
	for running {
		l4g.Debug("Job %v: Tick", job.name)

		select {
		case <-job.stop:
			l4g.Debug("Job %v: Received stop signal", job.name)
			running = false
		case <-time.After(10 * time.Second):
			continue
		}
	}

	l4g.Debug("Job %v: Finished", job.name)
	job.stopped <- true
}

func (job *TestJob) Stop() {
	l4g.Debug("Job %v: Stopping", job.name)
	job.stop <- true
	<-job.stopped
}
