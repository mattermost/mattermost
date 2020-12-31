// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	TopicSync                    = "sharedchannel_sync"
	TopicChannelInvite           = "sharedchannel_invite"
	MaxConcurrentUpdates         = 5
	MaxRetries                   = 3
	MaxPostsPerSync              = 50
	NotifyRemoteOfflineThreshold = time.Second * 10
	StatusDescription            = "status_description"
	ResponseLastUpdateAt         = "last_update_at"
	ResponsePostErrors           = "post_errors"
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

type AppIface interface {
	SendEphemeralPost(userId string, post *model.Post) *model.Post
	CreateChannelWithUser(channel *model.Channel, userId string) (*model.Channel, *model.AppError)
	DeleteChannel(channel *model.Channel, userId string) *model.AppError
}

// Service provides shared channel synchronization.
type Service struct {
	server       ServerIface
	app          AppIface
	changeSignal chan struct{}

	// everything below guarded by `mux`
	mux                   sync.RWMutex
	active                bool
	leaderListenerId      string
	done                  chan struct{}
	tasks                 map[string]syncTask
	syncTopicListenerId   string
	inviteTopicListenerId string
}

// NewSharedChannelService creates a RemoteClusterService instance.
func NewSharedChannelService(server ServerIface, app AppIface) (*Service, error) {
	service := &Service{
		server:       server,
		app:          app,
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

func (scs *Service) sendEphemeralPost(channelId string, userId string, text string) {
	ephemeral := &model.Post{
		ChannelId: channelId,
		Message:   text,
		CreateAt:  model.GetMillis(),
	}
	scs.app.SendEphemeralPost(userId, ephemeral)
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

	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		scs.server.GetLogger().Error("Shared Channel Service cannot activate: requires Remote Cluster Service")
		return
	}
	scs.syncTopicListenerId = rcs.AddTopicListener(TopicSync, scs.OnReceiveSyncMessage)
	scs.inviteTopicListenerId = rcs.AddTopicListener(TopicChannelInvite, scs.OnReceiveChannelInvite)

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

	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		scs.server.GetLogger().Error("Shared Channel Service activitate: requires Remote Cluster Service")
	}
	rcs.RemoveTopicListener(scs.syncTopicListenerId)
	scs.syncTopicListenerId = ""
	rcs.RemoveTopicListener(scs.inviteTopicListenerId)
	scs.inviteTopicListenerId = ""

	scs.active = false
	close(scs.done)
	scs.done = nil

	scs.server.GetLogger().Debug("Shared Channel Service inactive")
}
