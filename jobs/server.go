// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	ejobs "github.com/mattermost/mattermost-server/einterfaces/jobs"
	tjobs "github.com/mattermost/mattermost-server/jobs/interfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type ConfigService interface {
	Config() *model.Config
	AddConfigListener(func(old, current *model.Config)) string
	RemoveConfigListener(string)
}

type StaticConfigService struct {
	Cfg *model.Config
}

func (s StaticConfigService) Config() *model.Config                                   { return s.Cfg }
func (StaticConfigService) AddConfigListener(func(old, current *model.Config)) string { return "" }
func (StaticConfigService) RemoveConfigListener(string)                               {}

type JobServer struct {
	ConfigService ConfigService
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

func NewJobServer(configService ConfigService, store store.Store) *JobServer {
	return &JobServer{
		ConfigService: configService,
		Store:         store,
	}
}

func (srv *JobServer) Config() *model.Config {
	return srv.ConfigService.Config()
}

func (srv *JobServer) StartWorkers() {
	srv.Workers = srv.InitWorkers().Start()
}

func (srv *JobServer) StartSchedulers() {
	srv.Schedulers = srv.InitSchedulers().Start()
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
