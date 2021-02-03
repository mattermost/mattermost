// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	SendChanBuffer                = 50
	RecvChanBuffer                = 50
	ResultsChanBuffer             = 50
	ResultQueueDrainTimeoutMillis = 10000
	MaxConcurrentSends            = 1 // TODO: increase when threading issue fixed
	SendMsgURL                    = "api/v4/remotecluster/msg"
	SendTimeout                   = time.Minute
	SendFileTimeout               = time.Minute * 5
	SendFileMaxQueue              = 100
	PingURL                       = "api/v4/remotecluster/ping"
	PingFreq                      = time.Minute
	PingTimeout                   = time.Second * 15
	ConfirmInviteURL              = "api/v4/remotecluster/confirm_invite"
	InvitationTopic               = "invitation"
	PingTopic                     = "ping"
	ResponseStatusOK              = model.STATUS_OK
	ResponseStatusFail            = model.STATUS_FAIL
	InviteExpiresAfter            = time.Hour * 48
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
	GetMetrics() einterfaces.MetricsInterface
}

// TopicListener is a callback signature used to listen for incoming messages for
// a specific topic.
type TopicListener func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) error

// Service provides inter-cluster communication via topic based messages.
type Service struct {
	server     ServerIface
	send       chan sendTask
	httpClient *http.Client
	sendFiles  []chan sendFileTask

	// everything below guarded by `mux`
	mux              sync.RWMutex
	active           bool
	leaderListenerId string
	topicListeners   map[string]map[string]TopicListener // maps topic id to a map of listenerid->listener
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
		DisableCompression:    false,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   SendTimeout,
	}

	service := &Service{
		server:         server,
		send:           make(chan sendTask, SendChanBuffer),
		httpClient:     client,
		topicListeners: make(map[string]map[string]TopicListener),
	}

	service.sendFiles = make([]chan sendFileTask, MaxConcurrentSends)
	for i := range service.sendFiles {
		service.sendFiles[i] = make(chan sendFileTask, SendFileMaxQueue)
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

// AddTopicListener registers a callback
func (rcs *Service) AddTopicListener(topic string, listener TopicListener) string {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	id := model.NewId()

	listeners, ok := rcs.topicListeners[topic]
	if !ok || listeners == nil {
		rcs.topicListeners[topic] = make(map[string]TopicListener)
	}
	rcs.topicListeners[topic][id] = listener
	return id
}

func (rcs *Service) RemoveTopicListener(listenerId string) {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	for topic, listeners := range rcs.topicListeners {
		if _, ok := listeners[listenerId]; ok {
			delete(listeners, listenerId)
			if len(listeners) == 0 {
				delete(rcs.topicListeners, topic)
			}
			break
		}
	}
}

func (rcs *Service) getTopicListeners(topic string) []TopicListener {
	rcs.mux.RLock()
	defer rcs.mux.RUnlock()

	listeners, ok := rcs.topicListeners[topic]
	if !ok {
		return nil
	}

	listenersCopy := make([]TopicListener, 0, len(listeners))
	for _, l := range listeners {
		listenersCopy = append(listenersCopy, l)
	}
	return listenersCopy
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

	// create thread pool for concurrent message sending.
	for i := 0; i < MaxConcurrentSends; i++ {
		go rcs.sendLoop(rcs.done)
	}

	// create thread pool for concurrent file sending.
	for i := range rcs.sendFiles {
		go rcs.sendFileLoop(i, rcs.done)
	}

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
