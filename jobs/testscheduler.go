// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"time"

	l4g "github.com/alecthomas/log4go"
)

type TestScheduler struct {
	name    string
	jobType string
	stop    chan bool
	stopped chan bool
}

func MakeTestScheduler(name string, jobType string) *TestScheduler {
	return &TestScheduler{
		name:    name,
		jobType: jobType,
		stop:    make(chan bool, 1),
		stopped: make(chan bool, 1),
	}
}

func (scheduler *TestScheduler) Run() {
	l4g.Debug("Scheduler %v: Started", scheduler.name)

	defer func() {
		l4g.Debug("Scheduler %v: Finished", scheduler.name)
		scheduler.stopped <- true
	}()

	for {
		select {
		case <-scheduler.stop:
			l4g.Debug("Scheduler %v: Received stop signal", scheduler.name)
			return
		case <-time.After(86400 * time.Second):
			l4g.Debug("Scheduler: %v: Scheduling new job", scheduler.name)
			scheduler.AddJob()
		}
	}
}

func (scheduler *TestScheduler) AddJob() {
	if _, err := CreateJob(scheduler.jobType, nil); err != nil {
		l4g.Error("Scheduler %v: failed to create job: %v", scheduler.name, err)
	}
}

func (scheduler *TestScheduler) Stop() {
	l4g.Debug("Scheduler %v: Stopping", scheduler.name)
	scheduler.stop <- true
	<-scheduler.stopped
}
