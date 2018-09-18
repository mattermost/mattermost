// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	ejobs "github.com/mattermost/mattermost-server/einterfaces/jobs"
	tjobs "github.com/mattermost/mattermost-server/jobs/interfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/configservice"
	"github.com/mattermost/mattermost-server/store"
)

type JobServer struct {
	ConfigService configservice.ConfigService
	Store         store.Store
	Workers       *Workers
	Schedulers    *Schedulers

	DataRetentionJob        ejobs.DataRetentionJobInterface
	MessageExportJob        ejobs.MessageExportJobInterface
	ElasticsearchAggregator ejobs.ElasticsearchAggregatorInterface
	ElasticsearchIndexer    ejobs.ElasticsearchIndexerInterface
	LdapSync                ejobs.LdapSyncInterface
	Migrations              tjobs.MigrationsJobInterface
}

func NewJobServer(configService configservice.ConfigService, store store.Store) *JobServer {
	return &JobServer{
		ConfigService: configService,
		Store:         store,
	}
}

func (srv *JobServer) Config() *model.Config {
	return srv.ConfigService.Config()
}

func (srv *JobServer) StartWorkers() {
	srv.Workers = srv.Workers.Start()
}

func (srv *JobServer) StartSchedulers() {
	srv.Schedulers = srv.Schedulers.Start()
}

func (srv *JobServer) StopWorkers() {
	if srv.Workers != nil {
		srv.Workers.Stop()
	}
}

func (srv *JobServer) StopSchedulers() {
	if srv.Schedulers != nil {
		srv.Schedulers.Stop()
	}
}
