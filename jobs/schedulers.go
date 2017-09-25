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

type Schedulers struct {
	startOnce sync.Once

	DataRetention            model.Scheduler
	ElasticsearchAggregation model.Scheduler
	LdapSync                 model.Scheduler

	listenerId string
}

func InitSchedulers() *Schedulers {
	schedulers := &Schedulers{}

	if dataRetentionInterface := ejobs.GetDataRetentionInterface(); dataRetentionInterface != nil {
		schedulers.DataRetention = dataRetentionInterface.MakeScheduler()
	}

	if elasticsearchAggregatorInterface := ejobs.GetElasticsearchAggregatorInterface(); elasticsearchAggregatorInterface != nil {
		schedulers.ElasticsearchAggregation = elasticsearchAggregatorInterface.MakeScheduler()
	}

	if ldaySyncInterface := ejobs.GetLdapSyncInterface(); ldaySyncInterface != nil {
		schedulers.LdapSync = ldaySyncInterface.MakeScheduler()
	}

	return schedulers
}

func (schedulers *Schedulers) Start() *Schedulers {
	l4g.Info("Starting schedulers")

	schedulers.startOnce.Do(func() {
		if schedulers.DataRetention != nil && (*utils.Cfg.DataRetentionSettings.EnableMessageDeletion || *utils.Cfg.DataRetentionSettings.EnableFileDeletion) {
			go schedulers.DataRetention.Run()
		}

		if schedulers.ElasticsearchAggregation != nil && *utils.Cfg.ElasticsearchSettings.EnableIndexing {
			go schedulers.ElasticsearchAggregation.Run()
		}

		if schedulers.LdapSync != nil && *utils.Cfg.LdapSettings.Enable {
			go schedulers.LdapSync.Run()
		}
	})

	schedulers.listenerId = utils.AddConfigListener(schedulers.handleConfigChange)

	return schedulers
}

func (schedulers *Schedulers) handleConfigChange(oldConfig *model.Config, newConfig *model.Config) {
	if schedulers.DataRetention != nil {
		if (!*oldConfig.DataRetentionSettings.EnableMessageDeletion && !*oldConfig.DataRetentionSettings.EnableFileDeletion) && (*newConfig.DataRetentionSettings.EnableMessageDeletion || *newConfig.DataRetentionSettings.EnableFileDeletion) {
			go schedulers.DataRetention.Run()
		} else if (*oldConfig.DataRetentionSettings.EnableMessageDeletion || *oldConfig.DataRetentionSettings.EnableFileDeletion) && (!*newConfig.DataRetentionSettings.EnableMessageDeletion && !*newConfig.DataRetentionSettings.EnableFileDeletion) {
			schedulers.DataRetention.Stop()
		}
	}

	if schedulers.ElasticsearchAggregation != nil {
		if !*oldConfig.ElasticsearchSettings.EnableIndexing && *newConfig.ElasticsearchSettings.EnableIndexing {
			go schedulers.ElasticsearchAggregation.Run()
		} else if *oldConfig.ElasticsearchSettings.EnableIndexing && !*newConfig.ElasticsearchSettings.EnableIndexing {
			schedulers.ElasticsearchAggregation.Stop()
		}
	}

	if schedulers.LdapSync != nil {
		if !*oldConfig.LdapSettings.Enable && *newConfig.LdapSettings.Enable {
			go schedulers.LdapSync.Run()
		} else if *oldConfig.LdapSettings.Enable && !*newConfig.LdapSettings.Enable {
			schedulers.LdapSync.Stop()
		}
	}
}

func (schedulers *Schedulers) Stop() *Schedulers {
	utils.RemoveConfigListener(schedulers.listenerId)

	if schedulers.DataRetention != nil && (*utils.Cfg.DataRetentionSettings.EnableMessageDeletion || *utils.Cfg.DataRetentionSettings.EnableFileDeletion) {
		schedulers.DataRetention.Stop()
	}

	if schedulers.ElasticsearchAggregation != nil && *utils.Cfg.ElasticsearchSettings.EnableIndexing {
		schedulers.ElasticsearchAggregation.Stop()
	}

	if schedulers.LdapSync != nil && *utils.Cfg.LdapSettings.Enable {
		schedulers.LdapSync.Stop()
	}

	l4g.Info("Stopped schedulers")

	return schedulers
}
