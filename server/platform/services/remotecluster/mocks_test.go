// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"context"
	"slices"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

type mockServer struct {
	remotes     []*model.RemoteCluster
	logger      *mlog.Logger
	user        *model.User
	customStore store.Store // if set, GetStore() returns this instead of creating default
}

func newMockServer(t *testing.T, remotes []*model.RemoteCluster) *mockServer {
	logger := mlog.CreateConsoleTestLogger(t)

	return &mockServer{
		remotes: remotes,
		logger:  logger,
	}
}

// newMockServerWithStore creates a mockServer with a custom store for fine-grained test control.
// Use this when you need to mock specific store behaviors that aren't covered by the default.
func newMockServerWithStore(t *testing.T, customStore store.Store) *mockServer {
	logger := mlog.CreateConsoleTestLogger(t)

	return &mockServer{
		logger:      logger,
		customStore: customStore,
	}
}

func (ms *mockServer) SetUser(user *model.User) {
	ms.user = user
}

func (ms *mockServer) Config() *model.Config                                  { return nil }
func (ms *mockServer) GetMetrics() einterfaces.MetricsInterface               { return nil }
func (ms *mockServer) IsLeader() bool                                         { return true }
func (ms *mockServer) AddClusterLeaderChangedListener(listener func()) string { return model.NewId() }
func (ms *mockServer) RemoveClusterLeaderChangedListener(id string)           {}
func (ms *mockServer) Log() *mlog.Logger {
	return ms.logger
}
func (ms *mockServer) GetStore() store.Store {
	// If a custom store was provided, use it (for unit tests with fine-grained control)
	if ms.customStore != nil {
		return ms.customStore
	}

	// Otherwise, return the default pre-configured store (for integration-style tests)
	anyQueryFilter := mock.MatchedBy(func(filter model.RemoteClusterQueryFilter) bool {
		return true
	})
	anyUserId := mock.AnythingOfType("string")
	anyId := mock.AnythingOfType("string")

	remoteClusterStoreMock := &mocks.RemoteClusterStore{}
	remoteClusterStoreMock.On("GetByTopic", "share").Return(ms.remotes, nil)
	remoteClusterStoreMock.On("GetAll", 0, 999999, anyQueryFilter).Return(ms.remotes, nil)
	remoteClusterStoreMock.On("SetLastPingAt", anyId).Return(nil)

	userStoreMock := &mocks.UserStore{}
	userStoreMock.On("Get", context.Background(), anyUserId).Return(ms.user, nil)

	storeMock := &mocks.Store{}
	storeMock.On("RemoteCluster").Return(remoteClusterStoreMock)
	storeMock.On("User").Return(userStoreMock)
	return storeMock
}

type mockApp struct {
	offlinePluginIDs []string

	mux             sync.Mutex
	totalPingCount  int
	totalPingErrors int
	pingCounts      map[string]int
}

func newMockApp(_ *testing.T, offlinePluginIDs []string) *mockApp {
	return &mockApp{
		offlinePluginIDs: offlinePluginIDs,
		pingCounts:       make(map[string]int),
	}
}

func (ma *mockApp) OnSharedChannelsPing(rc *model.RemoteCluster) bool {
	ma.mux.Lock()
	defer ma.mux.Unlock()

	if slices.Contains(ma.offlinePluginIDs, rc.PluginID) {
		ma.totalPingErrors++
		return false
	}

	ma.totalPingCount++

	count := ma.pingCounts[rc.PluginID]
	ma.pingCounts[rc.PluginID] = count + 1

	return true
}

func (ma *mockApp) GetTotalPingCount() int {
	ma.mux.Lock()
	defer ma.mux.Unlock()
	return ma.totalPingCount
}

func (ma *mockApp) GetTotalPingErrorCount() int {
	ma.mux.Lock()
	defer ma.mux.Unlock()
	return ma.totalPingErrors
}

func (ma *mockApp) GetPingCount(pluginID string) int {
	ma.mux.Lock()
	defer ma.mux.Unlock()

	return ma.pingCounts[pluginID]
}
