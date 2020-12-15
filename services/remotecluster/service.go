// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"net"
	"net/http"
	"sync"
	"time"

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
	SendTimeout                   = time.Minute
	PingURL                       = "api/v4/remotecluster/ping"
	PingFreq                      = time.Minute
	PingTimeout                   = time.Second * 15
	ConfirmInviteURL              = "api/v4/remotecluster/confirm_invite"
	InvitationTopic               = "invitation"
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
	OnReceiveMessage(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp Response) error
}

type Response map[string]interface{}

// Service provides inter-cluster communication via topic based messages.
type Service struct {
	server     ServerIface
	send       chan sendTask
	httpClient *http.Client

	// everything below guarded by `mux`
	mux              sync.RWMutex
	active           bool
	leaderListenerId string
	topicListeners   map[string][]TopicListener
	done             chan struct{}
}

// NewRemoteClusterService creates a RemoteClusterService instance.
func NewRemoteClusterService(server ServerIface) (*Service, error) {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          200,
		MaxIdleConnsPerHost:   2,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   SendTimeout,
	}

	service := &Service{
		server:         server,
		send:           make(chan sendTask, SendChanBuffer),
		httpClient:     client,
		topicListeners: make(map[string][]TopicListener),
	}
	return service, nil
}

// Start is called by the server on server start-up.
func (rcs *Service) Start() error {
	rcs.mux.Lock()
	rcs.leaderListenerId = rcs.server.AddClusterLeaderChangedListener(rcs.onClusterLeaderChange)
	rcs.mux.Unlock()

	rcs.onClusterLeaderChange()

	return nil
}

// Shutdown is called by the server on server shutdown.
func (rcs *Service) Shutdown() error {
	rcs.server.RemoveClusterLeaderChangedListener(rcs.leaderListenerId)
	rcs.pause()
	return nil
}

func (rcs *Service) AddTopicListener(topic string, listener TopicListener) {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	listeners, ok := rcs.topicListeners[topic]
	if !ok {
		rcs.topicListeners[topic] = []TopicListener{listener}
		return
	}

	for _, l := range listeners { // avoid duplicates
		if l == listener {
			return
		}
	}
	rcs.topicListeners[topic] = append(listeners, listener)
}

func (rcs *Service) RemoveTopicListener(topic string, listener TopicListener) {
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

func (rcs *Service) getTopicListeners(topic string) []TopicListener {
	rcs.mux.RLock()
	defer rcs.mux.RUnlock()

	listeners, ok := rcs.topicListeners[topic]
	if !ok {
		return nil
	}

	cpListeners := make([]TopicListener, len(listeners))
	copy(cpListeners, listeners)
	return cpListeners
}

// onClusterLeaderChange is called whenever the cluster leader may have changed.
func (rcs *Service) onClusterLeaderChange() {
	if rcs.server.IsLeader() {
		rcs.resume()
	} else {
		rcs.pause()
	}
}

func (rcs *Service) resume() {
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

func (rcs *Service) pause() {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	if !rcs.active {
		return // already inactive
	}
	rcs.active = false
	close(rcs.done)
	rcs.done = nil

	rcs.server.GetLogger().Debug("Remote Cluster Service inactive")
}
