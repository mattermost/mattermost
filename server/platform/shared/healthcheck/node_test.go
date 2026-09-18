// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
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

func TestPacketNodeConfigHashUnavailable(t *testing.T) {
	t.Parallel()

	packetNode := &NodeSnapshot{
		Diagnostics: &model.NodeDiagnostics{
			Diagnostics: &model.SupportPacketDiagnostics{},
			Errors:      model.SectionErrors{model.SectionServerSoftware: nil},
		},
	}

	_, ok := packetNode.ConfigHash()
	require.False(t, ok)
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
