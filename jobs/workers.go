// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"sync"

	l4g "github.com/alecthomas/log4go"
	ejobs "github.com/mattermost/platform/einterfaces/jobs"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type Workers struct {
	startOnce sync.Once
	watcher   *Watcher

	DataRetention         model.Worker
	ElasticsearchIndexing model.Worker

	listenerId string
}

func InitWorkers() *Workers {
	workers := &Workers{
	// 	SearchIndexing: MakeTestJob(s, "SearchIndexing"),
	}
	workers.watcher = MakeWatcher(workers)

	if dataRetentionInterface := ejobs.GetDataRetentionInterface(); dataRetentionInterface != nil {
		workers.DataRetention = dataRetentionInterface.MakeWorker()
	}

	if elasticsearchIndexerInterface := ejobs.GetElasticsearchIndexerInterface(); elasticsearchIndexerInterface != nil {
		workers.ElasticsearchIndexing = elasticsearchIndexerInterface.MakeWorker()
	}

	return workers
}

func (workers *Workers) Start() *Workers {
	l4g.Info("Starting workers")

	workers.startOnce.Do(func() {
		if workers.DataRetention != nil && *utils.Cfg.DataRetentionSettings.Enable {
			go workers.DataRetention.Run()
		}

		if workers.ElasticsearchIndexing != nil && *utils.Cfg.ElasticsearchSettings.EnableIndexing {
			go workers.ElasticsearchIndexing.Run()
		}

		go workers.watcher.Start()
	})

	workers.listenerId = utils.AddConfigListener(workers.handleConfigChange)

	return workers
}

func (workers *Workers) handleConfigChange(oldConfig *model.Config, newConfig *model.Config) {
	if workers.DataRetention != nil {
		if !*oldConfig.DataRetentionSettings.Enable && *newConfig.DataRetentionSettings.Enable {
			go workers.DataRetention.Run()
		} else if *oldConfig.DataRetentionSettings.Enable && !*newConfig.DataRetentionSettings.Enable {
			workers.DataRetention.Stop()
		}
	}

	if workers.ElasticsearchIndexing != nil {
		if !*oldConfig.ElasticsearchSettings.EnableIndexing && *newConfig.ElasticsearchSettings.EnableIndexing {
			go workers.ElasticsearchIndexing.Run()
		} else if *oldConfig.ElasticsearchSettings.EnableIndexing && !*newConfig.ElasticsearchSettings.EnableIndexing {
			workers.ElasticsearchIndexing.Stop()
		}
	}
}

func (workers *Workers) Stop() *Workers {
	utils.RemoveConfigListener(workers.listenerId)

	workers.watcher.Stop()

	if workers.DataRetention != nil && *utils.Cfg.DataRetentionSettings.Enable {
		workers.DataRetention.Stop()
	}

	if workers.ElasticsearchIndexing != nil && *utils.Cfg.ElasticsearchSettings.EnableIndexing {
		workers.ElasticsearchIndexing.Stop()
	}

	l4g.Info("Stopped workers")

	return workers
}
