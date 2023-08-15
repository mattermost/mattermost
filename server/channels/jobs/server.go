// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/configservice"
)

type JobServer struct {
	ConfigService configservice.ConfigService
	Store         store.Store
	metrics       einterfaces.MetricsInterface
	logger        mlog.LoggerIFace

	// mut is used to protect the following fields from concurrent access.
	mut        sync.Mutex
	workers    *Workers
	schedulers *Schedulers
}

func NewJobServer(configService configservice.ConfigService, store store.Store, metrics einterfaces.MetricsInterface, logger mlog.LoggerIFace) *JobServer {
	srv := &JobServer{
		ConfigService: configService,
		Store:         store,
		metrics:       metrics,
	}
	srv.initWorkers()
	srv.initSchedulers()
	return srv
}

func (srv *JobServer) initWorkers() {
	workers := NewWorkers(srv.ConfigService)
	workers.Watcher = srv.MakeWatcher(workers, DefaultWatcherPollingInterval)
	srv.workers = workers
}

func (srv *JobServer) initSchedulers() {
	schedulers := &Schedulers{
		configChanged:        make(chan *model.Config),
		clusterLeaderChanged: make(chan bool, 1),
		jobs:                 srv,
		isLeader:             true,
		schedulers:           make(map[string]Scheduler),
		nextRunTimes:         make(map[string]*time.Time),
	}

	srv.schedulers = schedulers
}

func (srv *JobServer) Config() *model.Config {
	return srv.ConfigService.Config()
}

func (srv *JobServer) RegisterJobType(name string, worker model.Worker, scheduler Scheduler) {
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
