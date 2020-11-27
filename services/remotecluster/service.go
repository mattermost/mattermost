// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"sync"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	SendChanBuffer                = 50
	RecvChanBuffer                = 50
	ResultsChanBuffer             = 50
	ResultQueueDrainTimeoutMillis = 10000
	MaxConcurrentSends            = 5
	SendMsgURL                    = "api/v4/remotecluster/msg"
	SendTimeoutMillis             = 60000
	PingURL                       = "api/v4/remotecluster/ping"
	PingFreqMillis                = 60000 // once per minute
	PingTimeoutMillis             = 15000
	ConfirmInviteURL              = "api/v4/remotecluster/confirm_invite"
)

var (
	disablePing bool // override for testing
)

type ServerIface interface {
	Config() *model.Config
	IsLeader() bool
	AddClusterLeaderChangedListener(listener func()) string
	RemoveClusterLeaderChangedListener(id string)
	GetStore() store.Store
	GetLogger() mlog.LoggerIFace
}

type TopicListener interface {
	OnReceiveMessage(msg *model.RemoteClusterMsg) error
}

// RemoteClusterService
type RemoteClusterService struct {
	server ServerIface

	send chan sendTask

	// everything below guarded by `mux`
	mux              sync.Mutex
	active           bool
	leaderListenerId string
	remotes          []*model.RemoteCluster
	topicListeners   map[string][]TopicListener
	done             chan struct{}
}

// NewRemoteClusterService creates a RemoteClusterService instance.
func NewRemoteClusterService(server ServerIface) (*RemoteClusterService, error) {
	service := &RemoteClusterService{
		server: server,
		send:   make(chan sendTask, SendChanBuffer),
	}
	return service, nil
}

// Start is called by the server on server start-up.
func (rcs *RemoteClusterService) Start() error {
	defer rcs.onClusterLeaderChange()

	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	rcs.leaderListenerId = rcs.server.AddClusterLeaderChangedListener(rcs.onClusterLeaderChange)

	return nil
}

// Shutdown is called by the server on server shutdown.
func (rcs *RemoteClusterService) Shutdown() error {
	rcs.server.RemoveClusterLeaderChangedListener(rcs.leaderListenerId)
	rcs.pause()
	return nil
}

// NotifyRemoteClusterChange is called whenever a remote cluster is added or removed from
// the database.
func (rcs *RemoteClusterService) NotifyRemoteClusterChange() {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	rcs.remotes = nil // force reload
}

func (rcs *RemoteClusterService) AddTopicListener(topic string, listener TopicListener) {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	listeners, ok := rcs.topicListeners[topic]
	if !ok {
		rcs.topicListeners[topic] = []TopicListener{listener}
		return
	}

	var found bool
	for _, l := range listeners { // avoid duplicates
		if l == listener {
			found = true
			break
		}
	}
	if !found {
		rcs.topicListeners[topic] = append(listeners, listener)
	}
}

func (rcs *RemoteClusterService) RemoveTopicListener(topic string, listener TopicListener) {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	listeners, ok := rcs.topicListeners[topic]
	if !ok {
		return
	}

	newList := make([]TopicListener, 0, len(listeners))
	for _, l := range listeners {
		if l != listener {
			newList = append(newList, l)
		}
	}
	rcs.topicListeners[topic] = newList
}

// onClusterLeaderChange is called whenever the cluster leader may have changed.
func (rcs *RemoteClusterService) onClusterLeaderChange() {
	if rcs.server.IsLeader() {
		rcs.resume()
	} else {
		rcs.pause()
	}
}

func (rcs *RemoteClusterService) resume() {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	if rcs.active {
		return // already active
	}
	rcs.active = true
	rcs.done = make(chan struct{})

	if !disablePing {
		rcs.pingLoop(rcs.done)
	}
	rcs.sendLoop(rcs.done)

	rcs.server.GetLogger().Debug("Remote Cluster Service active")
}

func (rcs *RemoteClusterService) pause() {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	rcs.remotes = nil // force reload

	if !rcs.active {
		return // already inactive
	}
	rcs.active = false
	close(rcs.done)
	rcs.done = nil

	rcs.server.GetLogger().Debug("Remote Cluster Service inactive")
}
