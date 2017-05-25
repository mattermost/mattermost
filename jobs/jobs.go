// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"sync"

	l4g "github.com/alecthomas/log4go"
	ejobs "github.com/mattermost/platform/einterfaces/jobs"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

type Jobs struct {
	startOnce sync.Once

	DataRetention model.Job
	// SearchIndexing model.Job

	listenerId string
}

func InitJobs(s store.Store) *Jobs {
	jobs := &Jobs{
	// 	SearchIndexing: MakeTestJob(s, "SearchIndexing"),
	}

	if dataRetentionInterface := ejobs.GetDataRetentionInterface(); dataRetentionInterface != nil {
		jobs.DataRetention = dataRetentionInterface.MakeJob(s)
	}

	return jobs
}

func (jobs *Jobs) Start() *Jobs {
	l4g.Info("Starting jobs")

	jobs.startOnce.Do(func() {
		if jobs.DataRetention != nil && *utils.Cfg.DataRetentionSettings.Enable {
			go jobs.DataRetention.Run()
		}

		// go jobs.SearchIndexing.Run()
	})

	jobs.listenerId = utils.AddConfigListener(jobs.handleConfigChange)

	return jobs
}

func (jobs *Jobs) handleConfigChange(oldConfig *model.Config, newConfig *model.Config) {
	if jobs.DataRetention != nil {
		if !*oldConfig.DataRetentionSettings.Enable && *newConfig.DataRetentionSettings.Enable {
			go jobs.DataRetention.Run()
		} else if *oldConfig.DataRetentionSettings.Enable && !*newConfig.DataRetentionSettings.Enable {
			jobs.DataRetention.Stop()
		}
	}
}

func (jobs *Jobs) Stop() *Jobs {
	utils.RemoveConfigListener(jobs.listenerId)

	if jobs.DataRetention != nil && *utils.Cfg.DataRetentionSettings.Enable {
		jobs.DataRetention.Stop()
	}
	// jobs.SearchIndexing.Stop()

	l4g.Info("Stopped jobs")

	return jobs
}
