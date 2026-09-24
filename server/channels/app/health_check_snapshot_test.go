// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	emocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotStandaloneLeaderDiagnostics(t *testing.T) {
	th := Setup(t)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	snapshot, buildErr := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, latestVersionServer(t).URL)
	require.NoError(t, buildErr)
	require.NotNil(t, snapshot)

	nodes := snapshot.Nodes()
	require.Len(t, nodes, 1)
	require.True(t, nodes[0].IsLeader)
	require.Nil(t, nodes[0].ClusterInfo)
	require.NotNil(t, nodes[0].Diagnostics)
	require.NotNil(t, nodes[0].Diagnostics.Diagnostics)
	for _, section := range model.AllNodeSections() {
		assert.True(t, nodes[0].Has(section), "section %q", section)
	}
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotOnlyLeaderHasDiagnostics(t *testing.T) {
	th := Setup(t)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	cluster := &emocks.ClusterInterface{}
	cluster.On("GetClusterId").Return("id-2")
	cluster.On("GetClusterInfos").Return([]*model.ClusterInfo{
		{Id: "id-1", Hostname: "node-1"},
		{Id: "id-2", Hostname: "node-2"},
		{Id: "id-3", Hostname: "node-3"},
	}, nil)
	originalCluster := th.Server.Platform().Cluster()
	t.Cleanup(func() {
		th.Server.Platform().SetCluster(originalCluster)
	})
	th.Server.Platform().SetCluster(cluster)

	snapshot, buildErr := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, latestVersionServer(t).URL)
	require.NoError(t, buildErr)
	require.NotNil(t, snapshot)

	nodes := snapshot.Nodes()
	require.Len(t, nodes, 3)
	for _, node := range nodes {
		if node.IsLeader {
			assert.Equal(t, "id-2", node.ClusterInfo.Id)
			require.NotNil(t, node.Diagnostics)
			assert.Equal(t, 3, node.Diagnostics.Diagnostics.Cluster.NumberOfNodes)
		} else {
			assert.Nil(t, node.Diagnostics, "follower %q", node.ClusterInfo.Id)
		}
	}
	leader, ok := snapshot.Leader()
	require.True(t, ok)
	assert.Equal(t, "id-2", leader.ClusterInfo.Id)
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotSectionFailureIsolationWithPartialStats(t *testing.T) {
	th := Setup(t)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	storeMock := mocks.Store{}
	channelStore := &mocks.ChannelStore{}
	channelStore.On("AnalyticsTypeCount", "", model.ChannelTypeOpen).Return(int64(2), nil)
	channelStore.On("AnalyticsTypeCount", "", model.ChannelTypePrivate).Return(int64(0), errors.New("private query failed"))

	originalStore := th.App.Srv().Store()
	t.Cleanup(func() {
		th.App.Srv().SetStore(originalStore)
	})

	storeMock.On("User").Return(originalStore.User())
	storeMock.On("Post").Return(originalStore.Post())
	storeMock.On("Channel").Return(channelStore)
	storeMock.On("Team").Return(originalStore.Team())
	storeMock.On("Command").Return(originalStore.Command())
	storeMock.On("Webhook").Return(originalStore.Webhook())
	storeMock.On("Job").Return(originalStore.Job())
	storeMock.On("GetDBSchemaVersion").Return(originalStore.GetDBSchemaVersion())
	storeMock.On("GetDbVersion", false).Return(originalStore.GetDbVersion(false))
	storeMock.On("TotalMasterDbConnections").Return(originalStore.TotalMasterDbConnections())
	storeMock.On("TotalReadDbConnections").Return(originalStore.TotalReadDbConnections())
	storeMock.On("TotalSearchDbConnections").Return(originalStore.TotalSearchDbConnections())
	storeMock.On("GetDiagnostics", mock.Anything).Return(originalStore.GetDiagnostics(th.Context))
	storeMock.On("ClearCaches")
	storeMock.On("Close").Return(nil)

	th.App.Srv().SetStore(&storeMock)

	snapshot, buildErr := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, latestVersionServer(t).URL)
	require.NoError(t, buildErr)
	require.NotNil(t, snapshot)

	ok, sectionErr := snapshot.SectionErr(model.SectionStats)
	require.True(t, ok)
	require.ErrorContains(t, sectionErr, "failed to get channel count")

	require.NotNil(t, snapshot.Stats)
	assert.Nil(t, snapshot.Stats.Channels)
	assert.NotNil(t, snapshot.Stats.Posts)

	require.NotNil(t, snapshot.Config)
	require.NotNil(t, snapshot.Jobs)
	require.NotNil(t, snapshot.Plugins)
	ok, sectionErr = snapshot.SectionErr(model.SectionConfig)
	require.True(t, ok)
	require.NoError(t, sectionErr)
	ok, sectionErr = snapshot.SectionErr(model.SectionJobs)
	require.True(t, ok)
	require.NoError(t, sectionErr)
	ok, sectionErr = snapshot.SectionErr(model.SectionPlugins)
	require.True(t, ok)
	require.NoError(t, sectionErr)
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotLatestVersionTimeout(t *testing.T) {
	th := Setup(t)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	stalled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	t.Cleanup(stalled.Close)

	ctx, cancel := context.WithTimeout(th.Context.Context(), 150*time.Millisecond)
	t.Cleanup(cancel)

	start := time.Now()
	snapshot, buildErr := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context.WithContext(ctx), stalled.URL)
	elapsed := time.Since(start)

	require.NoError(t, buildErr)
	require.NotNil(t, snapshot)
	assert.Less(t, elapsed, 2*time.Second)
	assert.Empty(t, snapshot.Version.Latest)

	ok, sectionErr := snapshot.SectionErr(model.SectionVersion)
	require.True(t, ok)
	require.Error(t, sectionErr)
}

func TestClusterNodes(t *testing.T) {
	t.Parallel()

	t.Run("nil cluster creates standalone leader", func(t *testing.T) {
		nodes, err := clusterNodes(nil)
		require.NoError(t, err)
		require.Len(t, nodes, 1)
		require.True(t, nodes[0].IsLeader)
		require.Nil(t, nodes[0].ClusterInfo)
		require.Nil(t, nodes[0].Diagnostics)
	})

	t.Run("empty cluster infos creates standalone leader", func(t *testing.T) {
		cluster := emocks.NewClusterInterface(t)
		cluster.On("GetClusterInfos").Return([]*model.ClusterInfo{}, nil)

		nodes, err := clusterNodes(cluster)
		require.NoError(t, err)
		require.Len(t, nodes, 1)
		require.True(t, nodes[0].IsLeader)
		require.Nil(t, nodes[0].ClusterInfo)
		require.Nil(t, nodes[0].Diagnostics)
	})

	t.Run("leader selection and db-only entry", func(t *testing.T) {
		cluster := emocks.NewClusterInterface(t)
		cluster.On("GetClusterId").Return("id-2")
		cluster.On("GetClusterInfos").Return([]*model.ClusterInfo{
			{Id: "id-1", Hostname: "node-1", Version: "10.0.0"},
			{Id: "id-2", Hostname: "node-2", Version: "10.0.0"},
			{Id: "id-3", Hostname: "node-3"},
		}, nil)

		nodes, err := clusterNodes(cluster)
		require.NoError(t, err)
		require.Len(t, nodes, 3)
		require.Nil(t, nodes[0].Diagnostics)
		require.Nil(t, nodes[1].Diagnostics)
		require.Nil(t, nodes[2].Diagnostics)

		leaders := 0
		var dbOnlyNode *model.ClusterInfo
		for _, node := range nodes {
			if node.IsLeader {
				leaders++
				assert.Equal(t, "id-2", node.ClusterInfo.Id)
			}
			if node.ClusterInfo != nil && node.ClusterInfo.Id == "id-3" {
				dbOnlyNode = node.ClusterInfo
				_, ok := node.NodeVersion()
				require.False(t, ok)
			}
		}
		require.Equal(t, 1, leaders)
		require.NotNil(t, dbOnlyNode)
	})

	t.Run("cluster info failure returns error", func(t *testing.T) {
		cluster := emocks.NewClusterInterface(t)
		cluster.On("GetClusterInfos").Return(nil, assert.AnError)

		nodes, err := clusterNodes(cluster)
		require.Error(t, err)
		require.Nil(t, nodes)
	})
}

func latestVersionServer(t *testing.T) *httptest.Server {
	t.Helper()

	release := &model.GithubReleaseInfo{
		Id:          1,
		TagName:     "v11.0.0",
		Name:        "v11.0.0",
		CreatedAt:   "2022-01-13T14:19:44Z",
		PublishedAt: "2022-01-14T13:45:09Z",
		Body:        "Mattermost Platform Release",
		Url:         "https://github.com/mattermost/mattermost-server/releases/tag/v11.0.0",
	}

	body, err := json.Marshal(release)
	require.NoError(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, writeErr := w.Write(body)
		assert.NoError(t, writeErr)
	}))
	t.Cleanup(server.Close)

	return server
}
