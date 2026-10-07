// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNodeVersionParityLiveAndPacket(t *testing.T) {
	t.Parallel()

	liveNode := &NodeSnapshot{
		ClusterInfo: &model.ClusterInfo{
			Version: "10.4.0",
		},
		Diagnostics: &model.NodeDiagnostics{
			Diagnostics: &model.SupportPacketDiagnostics{},
			Errors:      model.SectionErrors{model.SectionServerSoftware: nil},
		},
	}
	liveNode.Diagnostics.Diagnostics.Server.Version = "10.4.0"

	packetNode := &NodeSnapshot{
		Diagnostics: &model.NodeDiagnostics{
			Diagnostics: &model.SupportPacketDiagnostics{},
			Errors:      model.SectionErrors{model.SectionServerSoftware: nil},
		},
	}
	packetNode.Diagnostics.Diagnostics.Server.Version = "10.4.0"

	liveVersion, liveOK := liveNode.NodeVersion()
	packetVersion, packetOK := packetNode.NodeVersion()

	require.True(t, liveOK)
	require.True(t, packetOK)
	require.Equal(t, liveVersion, packetVersion)
}

func TestNodeVersion(t *testing.T) {
	t.Parallel()

	diagNode := func(clusterInfo *model.ClusterInfo, version string) *NodeSnapshot {
		node := &NodeSnapshot{
			ClusterInfo: clusterInfo,
			Diagnostics: &model.NodeDiagnostics{
				Diagnostics: &model.SupportPacketDiagnostics{},
				Errors:      model.SectionErrors{model.SectionServerSoftware: nil},
			},
		}
		node.Diagnostics.Diagnostics.Server.Version = version
		return node
	}

	t.Run("live cluster answers from cluster info for every node", func(t *testing.T) {
		leader := diagNode(&model.ClusterInfo{Hostname: "node-2", Version: "11.1.0.12345"}, "11.1.0")
		leader.IsLeader = true
		snapshot := NewSnapshot([]*NodeSnapshot{
			{ClusterInfo: &model.ClusterInfo{Hostname: "node-1", Version: "11.1.0.12345"}},
			leader,
			{ClusterInfo: &model.ClusterInfo{Hostname: "node-3", Version: "11.1.0.12345"}},
		})

		for _, node := range snapshot.Nodes() {
			version, ok := node.NodeVersion()
			require.True(t, ok, node.ClusterInfo.Hostname)
			assert.Equal(t, "11.1.0.12345", version, node.ClusterInfo.Hostname)
		}
	})

	t.Run("packet node answers from diagnostics", func(t *testing.T) {
		version, ok := diagNode(nil, "11.1.0").NodeVersion()
		require.True(t, ok)
		assert.Equal(t, "11.1.0", version)
	})

	t.Run("live standalone leader answers from diagnostics", func(t *testing.T) {
		leader := diagNode(nil, "11.1.0")
		leader.IsLeader = true

		version, ok := leader.NodeVersion()
		require.True(t, ok)
		assert.Equal(t, "11.1.0", version)
	})

	t.Run("cluster info without a version falls back to diagnostics", func(t *testing.T) {
		version, ok := diagNode(&model.ClusterInfo{Hostname: "node-1"}, "11.1.0").NodeVersion()
		require.True(t, ok)
		assert.Equal(t, "11.1.0", version)
	})

	t.Run("db-only node reports nothing", func(t *testing.T) {
		node := &NodeSnapshot{ClusterInfo: &model.ClusterInfo{Id: "id-3", Hostname: "node-3"}}

		_, ok := node.NodeVersion()
		require.False(t, ok)
	})
}

func TestSchemaVersion(t *testing.T) {
	t.Parallel()

	t.Run("prefers cluster info over diagnostics", func(t *testing.T) {
		node := &NodeSnapshot{
			ClusterInfo: &model.ClusterInfo{SchemaVersion: "cluster"},
			Diagnostics: &model.NodeDiagnostics{
				Diagnostics: &model.SupportPacketDiagnostics{},
			},
		}
		node.Diagnostics.Diagnostics.Database.SchemaVersion = new("diag")

		version, ok := node.SchemaVersion()
		require.True(t, ok)
		require.Equal(t, "cluster", version)
	})

	t.Run("falls back to diagnostics when cluster info absent", func(t *testing.T) {
		node := &NodeSnapshot{
			Diagnostics: &model.NodeDiagnostics{
				Diagnostics: &model.SupportPacketDiagnostics{},
				Errors:      model.SectionErrors{model.SectionDatabaseIdentity: nil},
			},
		}
		node.Diagnostics.Diagnostics.Database.SchemaVersion = new("diag")

		version, ok := node.SchemaVersion()
		require.True(t, ok)
		require.Equal(t, "diag", version)
	})

	t.Run("skips diagnostics when database identity section errored", func(t *testing.T) {
		node := &NodeSnapshot{
			Diagnostics: &model.NodeDiagnostics{
				Diagnostics: &model.SupportPacketDiagnostics{},
				Errors:      model.SectionErrors{model.SectionDatabaseIdentity: errors.New("collect failed")},
			},
		}
		node.Diagnostics.Diagnostics.Database.SchemaVersion = new("diag")

		_, ok := node.SchemaVersion()
		require.False(t, ok)
	})

	t.Run("nil schema version in diagnostics", func(t *testing.T) {
		node := &NodeSnapshot{
			Diagnostics: &model.NodeDiagnostics{
				Diagnostics: &model.SupportPacketDiagnostics{},
				Errors:      model.SectionErrors{model.SectionDatabaseIdentity: nil},
			},
		}

		_, ok := node.SchemaVersion()
		require.False(t, ok)
	})

	t.Run("empty schema version from an older packet", func(t *testing.T) {
		node := &NodeSnapshot{
			Diagnostics: &model.NodeDiagnostics{
				Diagnostics: &model.SupportPacketDiagnostics{},
				Errors:      model.SectionErrors{model.SectionDatabaseIdentity: nil},
			},
		}
		node.Diagnostics.Diagnostics.Database.SchemaVersion = new("")

		_, ok := node.SchemaVersion()
		require.False(t, ok)
	})
}

func TestNodeSectionAvailability(t *testing.T) {
	t.Parallel()

	nodeErr := errors.New("probe failed")
	node := &NodeSnapshot{
		Diagnostics: &model.NodeDiagnostics{
			Diagnostics: &model.SupportPacketDiagnostics{},
			Errors: model.SectionErrors{
				model.SectionLDAPProbe: nil,
				model.SectionSAMLProbe: nodeErr,
			},
		},
	}

	require.True(t, node.Has(model.SectionLDAPProbe))
	require.False(t, node.Has(model.SectionSAMLProbe))
	ok, err := node.SectionErr(model.SectionSAMLProbe)
	require.True(t, ok)
	require.Equal(t, nodeErr, err)
}

func TestNodeSectionErrUncoveredNodeReportsAbsent(t *testing.T) {
	t.Parallel()

	node := &NodeSnapshot{}

	ok, err := node.SectionErr(model.SectionLDAPProbe)
	require.False(t, ok)
	require.NoError(t, err)
	require.False(t, node.Has(model.SectionLDAPProbe))
}
