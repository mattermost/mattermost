// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"sync"

	l4g "github.com/alecthomas/log4go"
	ejobs "github.com/mattermost/mattermost-server/einterfaces/jobs"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

type Workers struct {
	startOnce sync.Once
	watcher   *Watcher

	DataRetention            model.Worker
	ElasticsearchIndexing    model.Worker
	ElasticsearchAggregation model.Worker

	listenerId string
}

func InitWorkers() *Workers {
	workers := &Workers{}
	workers.watcher = MakeWatcher(workers)

	if dataRetentionInterface := ejobs.GetDataRetentionInterface(); dataRetentionInterface != nil {
		workers.DataRetention = dataRetentionInterface.MakeWorker()
	}

	if elasticsearchIndexerInterface := ejobs.GetElasticsearchIndexerInterface(); elasticsearchIndexerInterface != nil {
		workers.ElasticsearchIndexing = elasticsearchIndexerInterface.MakeWorker()
	}

	if elasticsearchAggregatorInterface := ejobs.GetElasticsearchAggregatorInterface(); elasticsearchAggregatorInterface != nil {
		workers.ElasticsearchAggregation = elasticsearchAggregatorInterface.MakeWorker()
	}

	return workers
}

func (workers *Workers) Start() *Workers {
	l4g.Info("Starting workers")

	workers.startOnce.Do(func() {
		if workers.DataRetention != nil && (*utils.Cfg.DataRetentionSettings.EnableMessageDeletion || *utils.Cfg.DataRetentionSettings.EnableFileDeletion) {
			go workers.DataRetention.Run()
		}

		if workers.ElasticsearchIndexing != nil && *utils.Cfg.ElasticsearchSettings.EnableIndexing {
			go workers.ElasticsearchIndexing.Run()
		}

		if workers.ElasticsearchAggregation != nil && *utils.Cfg.ElasticsearchSettings.EnableIndexing {
			go workers.ElasticsearchAggregation.Run()
		}

		go workers.watcher.Start()
	})

	workers.listenerId = utils.AddConfigListener(workers.handleConfigChange)

	return workers
}

func (workers *Workers) handleConfigChange(oldConfig *model.Config, newConfig *model.Config) {
	if workers.DataRetention != nil {
		if (!*oldConfig.DataRetentionSettings.EnableMessageDeletion && !*oldConfig.DataRetentionSettings.EnableFileDeletion) && (*newConfig.DataRetentionSettings.EnableMessageDeletion || *newConfig.DataRetentionSettings.EnableFileDeletion) {
			go workers.DataRetention.Run()
		} else if (*oldConfig.DataRetentionSettings.EnableMessageDeletion || *oldConfig.DataRetentionSettings.EnableFileDeletion) && (!*newConfig.DataRetentionSettings.EnableMessageDeletion && !*newConfig.DataRetentionSettings.EnableFileDeletion) {
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

	if workers.ElasticsearchAggregation != nil {
		if !*oldConfig.ElasticsearchSettings.EnableIndexing && *newConfig.ElasticsearchSettings.EnableIndexing {
			go workers.ElasticsearchAggregation.Run()
		} else if *oldConfig.ElasticsearchSettings.EnableIndexing && !*newConfig.ElasticsearchSettings.EnableIndexing {
			workers.ElasticsearchAggregation.Stop()
		}
	}
}

func (workers *Workers) Stop() *Workers {
	utils.RemoveConfigListener(workers.listenerId)

	workers.watcher.Stop()

	if workers.DataRetention != nil && (*utils.Cfg.DataRetentionSettings.EnableMessageDeletion || *utils.Cfg.DataRetentionSettings.EnableFileDeletion) {
		workers.DataRetention.Stop()
	}

	if workers.ElasticsearchIndexing != nil && *utils.Cfg.ElasticsearchSettings.EnableIndexing {
		workers.ElasticsearchIndexing.Stop()
	}

	if workers.ElasticsearchAggregation != nil && *utils.Cfg.ElasticsearchSettings.EnableIndexing {
		workers.ElasticsearchAggregation.Stop()
	}

	l4g.Info("Stopped workers")

	return workers
}
