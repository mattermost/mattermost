// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package job

import (
	"sync"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/store"
)

type Jobs struct {
	startOnce sync.Once

	DataRetention  Job
	SearchIndexing Job
}

func InitJobs(s store.Store) *Jobs {
	return &Jobs{
		DataRetention:  MakeTestJob(s, "DataRetention"),
		SearchIndexing: MakeTestJob(s, "SearchIndexing"),
	}
}

func (jobs *Jobs) StartAll() *Jobs {
	l4g.Info("Starting jobs")

	jobs.startOnce.Do(func() {
		go jobs.DataRetention.Run()
		go jobs.SearchIndexing.Run()
	})

	return jobs
}

func (jobs *Jobs) StopAll() *Jobs {
	l4g.Info("Stopping jobs")

	jobs.DataRetention.Stop()
	jobs.SearchIndexing.Stop()

	l4g.Info("Stopped jobs")

	return jobs
}
