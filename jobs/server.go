// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"sync"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/configservice"
	"github.com/mattermost/mattermost-server/v6/store"
)

type JobServer struct {
	ConfigService configservice.ConfigService
	Store         store.Store
	metrics       einterfaces.MetricsInterface

	// mut is used to protect the following fields from concurrent access.
	mut                   sync.Mutex
	workers               *Workers
	schedulers            *Schedulers
	initializedSchedulers bool
	initializedWorkers    bool
}

func NewJobServer(configService configservice.ConfigService, store store.Store, metrics einterfaces.MetricsInterface) *JobServer {
	return &JobServer{
		ConfigService: configService,
		Store:         store,
		metrics:       metrics,
	}
}

func (srv *JobServer) Config() *model.Config {
	return srv.ConfigService.Config()
}

func (srv *JobServer) RegisterJobType(name string, worker model.Worker, scheduler model.Scheduler) {
	srv.mut.Lock()
	defer srv.mut.Unlock()
	if worker != nil {
		srv.workers.AddWorker(name, worker)
	}
	if scheduler != nil {
		srv.schedulers.AddScheduler(name, scheduler)
	}
}

func (srv *JobServer) StartWorkers() error {
	srv.mut.Lock()
	defer srv.mut.Unlock()
	if srv.workers == nil {
		return ErrWorkersUninitialized
	} else if srv.workers.running {
		return ErrWorkersRunning
	}
	srv.workers.Start()
	return nil
}

func (srv *JobServer) StartSchedulers() error {
	srv.mut.Lock()
	defer srv.mut.Unlock()
	if srv.schedulers == nil {
		return ErrSchedulersUninitialized
	} else if srv.schedulers.running {
		return ErrSchedulersRunning
	}
	srv.schedulers.Start()
	return nil
}

func (srv *JobServer) StopWorkers() error {
	srv.mut.Lock()
	defer srv.mut.Unlock()
	if srv.workers == nil {
		return ErrWorkersUninitialized
	} else if !srv.workers.running {
		return ErrWorkersNotRunning
	}
	srv.workers.Stop()
	return nil
}

func (srv *JobServer) StopSchedulers() error {
	srv.mut.Lock()
	defer srv.mut.Unlock()
	if srv.schedulers == nil {
		return ErrSchedulersUninitialized
	} else if !srv.schedulers.running {
		return ErrSchedulersNotRunning
	}
	srv.schedulers.Stop()
	return nil
}

func (srv *JobServer) HandleClusterLeaderChange(isLeader bool) {
	srv.mut.Lock()
	defer srv.mut.Unlock()
	if srv.schedulers != nil {
		srv.schedulers.handleClusterLeaderChange(isLeader)
	}
}
