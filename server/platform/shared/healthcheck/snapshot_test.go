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
