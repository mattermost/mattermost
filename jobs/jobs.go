// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"sync"

	l4g "github.com/alecthomas/log4go"
	ejobs "github.com/mattermost/platform/einterfaces/jobs"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
)

type Jobs struct {
	startOnce sync.Once

	DataRetention  model.Job
	SearchIndexing model.Job
}

func InitJobs(s store.Store) *Jobs {
	jobs := &Jobs{
		SearchIndexing: MakeTestJob(s, "SearchIndexing"),
	}

	if dataRetentionInterface := ejobs.GetDataRetentionInterface(); dataRetentionInterface != nil {
		jobs.DataRetention = dataRetentionInterface.MakeJob(s)
	}

	return jobs
}

func (jobs *Jobs) StartAll() *Jobs {
	l4g.Info("Starting jobs")

	jobs.startOnce.Do(func() {
		if jobs.DataRetention != nil {
			go jobs.DataRetention.Run()
		}

		go jobs.SearchIndexing.Run()
	})

	return jobs
}

func (jobs *Jobs) StopAll() *Jobs {
	l4g.Info("Stopping jobs")

	if jobs.DataRetention != nil {
		jobs.DataRetention.Stop()
	}
	jobs.SearchIndexing.Stop()

	l4g.Info("Stopped jobs")

	return jobs
}
