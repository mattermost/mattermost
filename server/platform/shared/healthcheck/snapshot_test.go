// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestNodesStandaloneAndClusterShapes(t *testing.T) {
	t.Parallel()

	standalone := &Snapshot{
		nodes: []*NodeSnapshot{
			{
				Hostname:    "standalone",
				IsLeader:    true,
				ClusterInfo: nil,
				Diagnostics: &model.NodeDiagnostics{
					Diagnostics: &model.SupportPacketDiagnostics{},
					Errors:      model.SectionErrors{model.SectionServerSoftware: nil},
				},
			},
		},
	}

	nodes := standalone.Nodes()
	require.Len(t, nodes, 1)
	require.Nil(t, nodes[0].ClusterInfo)

	cluster := &Snapshot{
		nodes: []*NodeSnapshot{
			{Hostname: "node-1", IsLeader: true, ClusterInfo: &model.ClusterInfo{Hostname: "node-1"}, Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}, Errors: model.SectionErrors{model.SectionServerSoftware: nil}}},
			{Hostname: "node-2", IsLeader: false, ClusterInfo: &model.ClusterInfo{Hostname: "node-2"}, Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}, Errors: model.SectionErrors{model.SectionServerSoftware: nil}}},
			{Hostname: "node-3", IsLeader: false, ClusterInfo: &model.ClusterInfo{Hostname: "node-3"}, Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}, Errors: model.SectionErrors{model.SectionServerSoftware: nil}}},
		},
	}

	clusterNodes := cluster.Nodes()
	require.Len(t, clusterNodes, 3)
	leaderCount := 0
	for _, node := range clusterNodes {
		if node.IsLeader {
			leaderCount++
		}
	}
	require.Equal(t, 1, leaderCount)
}

func TestSnapshotSectionAvailability(t *testing.T) {
	t.Parallel()

	workspaceErr := errors.New("jobs failed")
	snapshot := &Snapshot{
		Sections: map[model.WorkspaceSection]error{
			model.SectionConfig: nil,
			model.SectionJobs:   workspaceErr,
		},
	}

	require.True(t, snapshot.Has(model.SectionConfig))
	require.False(t, snapshot.Has(model.SectionJobs))
	ok, err := snapshot.SectionErr(model.SectionJobs)
	require.True(t, ok)
	require.Equal(t, workspaceErr, err)
}

func TestLeader(t *testing.T) {
	t.Parallel()

	t.Run("returns the leader node", func(t *testing.T) {
		leader := &NodeSnapshot{Hostname: "node-2", IsLeader: true}
		snapshot := &Snapshot{nodes: []*NodeSnapshot{
			{Hostname: "node-1"},
			leader,
			{Hostname: "node-3"},
		}}

		got, ok := snapshot.Leader()
		require.True(t, ok)
		require.Same(t, leader, got)
	})

	t.Run("no leader", func(t *testing.T) {
		snapshot := &Snapshot{nodes: []*NodeSnapshot{{Hostname: "node-1"}}}
		_, ok := snapshot.Leader()
		require.False(t, ok)
	})
}

func TestNewSnapshotCopiesNodes(t *testing.T) {
	t.Parallel()

	leader := &NodeSnapshot{Hostname: "node-1", IsLeader: true}
	original := []*NodeSnapshot{
		leader,
		{Hostname: "node-2"},
	}

	snapshot := NewSnapshot(original)
	nodes := snapshot.Nodes()
	require.Len(t, nodes, 2)
	gotLeader, ok := snapshot.Leader()
	require.True(t, ok)
	require.Same(t, leader, gotLeader)

	original[0] = &NodeSnapshot{Hostname: "mutated", IsLeader: false}

	nodes = snapshot.Nodes()
	require.Len(t, nodes, 2)
	require.Equal(t, "node-1", nodes[0].Hostname)
	gotLeader, ok = snapshot.Leader()
	require.True(t, ok)
	require.Equal(t, "node-1", gotLeader.Hostname)
}

func TestNewSnapshotSortsNodesByHostname(t *testing.T) {
	t.Parallel()

	original := []*NodeSnapshot{
		{Hostname: "node-3"},
		{Hostname: "node-1", IsLeader: true},
		{Hostname: "node-2"},
	}

	snapshot := NewSnapshot(original)
	hostnames := make([]string, 0, len(original))
	for _, node := range snapshot.Nodes() {
		hostnames = append(hostnames, node.Hostname)
	}
	require.Equal(t, []string{"node-1", "node-2", "node-3"}, hostnames)
	require.Equal(t, "node-3", original[0].Hostname, "the caller's slice is left as it was")

	leader, ok := snapshot.Leader()
	require.True(t, ok)
	require.Equal(t, "node-1", leader.Hostname)
}

func TestSnapshotHostnames(t *testing.T) {
	t.Parallel()

	replied := &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}}
	clusterConfig := func(enabled bool) *model.SupportPacketConfig {
		cfg := &model.Config{}
		cfg.ClusterSettings.Enable = model.NewPointer(enabled)
		return &model.SupportPacketConfig{Config: cfg}
	}

	testCases := []struct {
		name     string
		config   *model.SupportPacketConfig
		nodes    []*NodeSnapshot
		expected []string
	}{
		{
			name:     "standalone node",
			config:   clusterConfig(false),
			nodes:    []*NodeSnapshot{{Hostname: "mm.example.com", Diagnostics: replied}},
			expected: []string{"mm.example.com"},
		},
		{
			name:   "every cluster node replied",
			config: clusterConfig(true),
			nodes: []*NodeSnapshot{
				{Hostname: "app-2", ClusterInfo: &model.ClusterInfo{Hostname: "app-2"}, Diagnostics: replied},
				{Hostname: "app-1", ClusterInfo: &model.ClusterInfo{Hostname: "app-1"}, Diagnostics: replied},
			},
			expected: []string{"app-1", "app-2"},
		},
		{
			name:   "a node that did not reply may be listed by its discovery address",
			config: clusterConfig(true),
			nodes: []*NodeSnapshot{
				{Hostname: "app-1", ClusterInfo: &model.ClusterInfo{Hostname: "app-1"}, Diagnostics: replied},
				{Hostname: "10.0.0.5:8075", ClusterInfo: &model.ClusterInfo{Hostname: "10.0.0.5:8075"}, CollectErr: ErrNodeNoReply},
			},
		},
		{
			name:  "a node without a hostname",
			nodes: []*NodeSnapshot{{Diagnostics: replied}},
		},
		{
			name:   "clustering on but the cluster could not be listed",
			config: clusterConfig(true),
			nodes:  []*NodeSnapshot{{Hostname: "app-1", Diagnostics: replied}},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := NewSnapshot(tc.nodes)
			s.Config = tc.config
			s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
			require.Equal(t, tc.expected, s.Hostnames())
		})
	}

	require.Empty(t, (*Snapshot)(nil).Hostnames())
}
