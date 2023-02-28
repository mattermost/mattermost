// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/services/configservice"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

type Workers struct {
	ConfigService configservice.ConfigService
	Watcher       *Watcher

	workers map[string]model.Worker

	listenerId string
	running    bool
}

var (
	ErrWorkersNotRunning    = errors.New("job workers are not running")
	ErrWorkersRunning       = errors.New("job workers are running")
	ErrWorkersUninitialized = errors.New("job workers are not initialized")
)

func NewWorkers(configService configservice.ConfigService) *Workers {
	return &Workers{
		ConfigService: configService,
		workers:       make(map[string]model.Worker),
	}
}

func (workers *Workers) AddWorker(name string, worker model.Worker) {
	workers.workers[name] = worker
}

func (workers *Workers) Get(name string) model.Worker {
	return workers.workers[name]
}

// Start starts the workers. This call is not safe for concurrent use.
// Synchronization should be implemented by the caller.
func (workers *Workers) Start() {
	mlog.Info("Starting workers")

	for _, w := range workers.workers {
		if w.IsEnabled(workers.ConfigService.Config()) {
			go w.Run()
		}
	}

	go workers.Watcher.Start()

	workers.listenerId = workers.ConfigService.AddConfigListener(workers.handleConfigChange)
	workers.running = true
}

func (workers *Workers) handleConfigChange(oldConfig *model.Config, newConfig *model.Config) {
	mlog.Debug("Workers received config change.")

	for _, w := range workers.workers {
		if w.IsEnabled(oldConfig) && !w.IsEnabled(newConfig) {
			w.Stop()
		}
		if !w.IsEnabled(oldConfig) && w.IsEnabled(newConfig) {
			go w.Run()
		}
	}
}

// Stop stops the workers. This call is not safe for concurrent use.
// Synchronization should be implemented by the caller.
func (workers *Workers) Stop() {
	workers.ConfigService.RemoveConfigListener(workers.listenerId)

	workers.Watcher.Stop()

	for _, w := range workers.workers {
		if w.IsEnabled(workers.ConfigService.Config()) {
			w.Stop()
		}
	}

	workers.running = false

	mlog.Info("Stopped workers")
}
