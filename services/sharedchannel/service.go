// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"sync"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	MaxConcurrentUpdates = 5
	MaxRetries           = 3
	MaxPostsPerSync      = 50
)

type ServerIface interface {
	Config() *model.Config
	IsLeader() bool
	AddClusterLeaderChangedListener(listener func()) string
	RemoveClusterLeaderChangedListener(id string)
	GetStore() store.Store
	GetLogger() mlog.LoggerIFace
	GetRemoteClusterService() *remotecluster.Service
}

// Service provides shared channel synchronization.
type Service struct {
	server       ServerIface
	changeSignal chan struct{}

	// everything below guarded by `mux`
	mux              sync.RWMutex
	active           bool
	leaderListenerId string
	done             chan struct{}
	tasks            map[string]syncTask
}

// NewSharedChannelService creates a RemoteClusterService instance.
func NewSharedChannelService(server ServerIface) (*Service, error) {
	service := &Service{
		server:       server,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}
	return service, nil
}

// Start is called by the server on server start-up.
func (scs *Service) Start() error {
	scs.mux.Lock()
	scs.leaderListenerId = scs.server.AddClusterLeaderChangedListener(scs.onClusterLeaderChange)
	scs.mux.Unlock()

	scs.onClusterLeaderChange()

	return nil
}

// Shutdown is called by the server on server shutdown.
func (scs *Service) Shutdown() error {
	scs.server.RemoveClusterLeaderChangedListener(scs.leaderListenerId)
	scs.pause()
	return nil
}

// onClusterLeaderChange is called whenever the cluster leader may have changed.
func (scs *Service) onClusterLeaderChange() {
	if scs.server.IsLeader() {
		scs.resume()
	} else {
		scs.pause()
	}
}

func (scs *Service) resume() {
	scs.mux.Lock()
	defer scs.mux.Unlock()

	if scs.active {
		return // already active
	}
	scs.active = true
	scs.done = make(chan struct{})

	scs.syncLoop(scs.done)

	scs.server.GetLogger().Debug("Shared Channel Service active")
}

func (scs *Service) pause() {
	scs.mux.Lock()
	defer scs.mux.Unlock()

	if !scs.active {
		return // already inactive
	}
	scs.active = false
	close(scs.done)
	scs.done = nil

	scs.server.GetLogger().Debug("Shared Channel Service inactive")
}
