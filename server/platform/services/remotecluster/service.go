// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"context"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	SendChanBuffer                = 50
	RecvChanBuffer                = 50
	ResultsChanBuffer             = 50
	ResultQueueDrainTimeoutMillis = 10000
	MaxConcurrentSends            = 10
	SendMsgURL                    = "api/v4/remotecluster/msg"
	SendTimeout                   = time.Minute
	SendFileTimeout               = time.Minute * 5
	PingURL                       = "api/v4/remotecluster/ping"
	PingFreq                      = time.Minute
	PingTimeout                   = time.Second * 15
	ConfirmInviteURL              = "api/v4/remotecluster/confirm_invite"
	InvitationTopic               = "invitation"
	PingTopic                     = "ping"
	ResponseStatusOK              = model.StatusOk
	ResponseStatusFail            = model.StatusFail
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
	Log() *mlog.Logger
	GetMetrics() einterfaces.MetricsInterface
}

type AppIface interface {
	OnSharedChannelsPing(rc *model.RemoteCluster) bool
}

// RemoteClusterServiceIFace is used to allow mocking where a remote cluster service is used (for testing).
// Unfortunately it lives here because the shared channel service, app layer, and server interface all need it.
// Putting it in app layer means shared channel service must import app package.
type RemoteClusterServiceIFace interface {
	Shutdown() error
	Start() error
	Active() bool
	AddTopicListener(topic string, listener TopicListener) string
	RemoveTopicListener(listenerId string)
	AddConnectionStateListener(listener ConnectionStateListener) string
	RemoveConnectionStateListener(listenerId string)
	SendMsg(ctx context.Context, msg model.RemoteClusterMsg, rc *model.RemoteCluster, f SendMsgResultFunc) error
	SendFile(ctx context.Context, us *model.UploadSession, fi *model.FileInfo, rc *model.RemoteCluster, rp ReaderProvider, f SendFileResultFunc) error
	SendProfileImage(ctx context.Context, userID string, rc *model.RemoteCluster, provider ProfileImageProvider, f SendProfileImageResultFunc) error
	AcceptInvitation(invite *model.RemoteClusterInvite, name string, displayName string, creatorId string, siteURL string, defaultTeamId string) (*model.RemoteCluster, error)
	ReceiveIncomingMsg(rc *model.RemoteCluster, msg model.RemoteClusterMsg) Response
	ReceiveInviteConfirmation(invite model.RemoteClusterInvite) (*model.RemoteCluster, error)
	PingNow(rc *model.RemoteCluster)
}

// TopicListener is a callback signature used to listen for incoming messages for
// a specific topic.
type TopicListener func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) error

// ConnectionStateListener is used to listen to remote cluster connection state changes.
type ConnectionStateListener func(rc *model.RemoteCluster, online bool)

// Service provides inter-cluster communication via topic based messages. In product these are called "Secured Connections".
type Service struct {
	server     ServerIface
	app        AppIface
	httpClient *http.Client
	send       []chan any

	// everything below guarded by `mux`
	mux                      sync.RWMutex
	active                   bool
	leaderListenerId         string
	topicListeners           map[string]map[string]TopicListener // maps topic id to a map of listenerid->listener
	connectionStateListeners map[string]ConnectionStateListener  // maps listener id to listener
	done                     chan struct{}
	pingFreq                 time.Duration
}

// NewRemoteClusterService creates a RemoteClusterService instance. In product this is called a "Secured Connection".
func NewRemoteClusterService(server ServerIface, app AppIface) (*Service, error) {
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
		server:                   server,
		app:                      app,
		httpClient:               client,
		topicListeners:           make(map[string]map[string]TopicListener),
		connectionStateListeners: make(map[string]ConnectionStateListener),
	}

	service.send = make([]chan any, MaxConcurrentSends)
	for i := range service.send {
		service.send[i] = make(chan any, SendChanBuffer)
	}
	service.pingFreq = PingFreq

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

// Active returns true if this instance of the remote cluster service is active.
// The active instance is responsible for pinging and sending messages to remotes.
func (rcs *Service) Active() bool {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()
	return rcs.active
}

// GetPingFreq gets the frequency of pings to each remote.
func (rcs *Service) GetPingFreq() time.Duration {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()
	return rcs.pingFreq
}

// SetPingFreq sets the frequency of pings to each remote. Defaults to `PingFreq`.
// This is typically used to set a higher frequency for testing.
func (rcs *Service) SetPingFreq(freq time.Duration) {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()
	rcs.pingFreq = freq
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

func (rcs *Service) AddConnectionStateListener(listener ConnectionStateListener) string {
	id := model.NewId()

	rcs.mux.Lock()
	defer rcs.mux.Unlock()

	rcs.connectionStateListeners[id] = listener
	return id
}

func (rcs *Service) RemoveConnectionStateListener(listenerId string) {
	rcs.mux.Lock()
	defer rcs.mux.Unlock()
	delete(rcs.connectionStateListeners, listenerId)
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
		// first ping all the plugin remotes immediately, synchronously.
		rcs.pingAllNow(model.RemoteClusterQueryFilter{OnlyPlugins: true})

		// start the async ping loop
		rcs.pingLoop(rcs.done)
	}

	// create thread pool for concurrent message sending.
	for i := range rcs.send {
		go rcs.sendLoop(i, rcs.done)
	}

	rcs.server.Log().Debug("Remote Cluster Service active")
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

	rcs.server.Log().Debug("Remote Cluster Service inactive")
}
