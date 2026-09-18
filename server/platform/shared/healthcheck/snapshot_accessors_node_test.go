// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"errors"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestConfigStringAndDataSourceFakeSettingGuard(t *testing.T) {
	t.Parallel()

	t.Run("mysql sanitization yields unavailable config string", func(t *testing.T) {
		cfg := &model.Config{}
		cfg.SqlSettings.DriverName = new("mysql")
		cfg.SqlSettings.DataSource = new("mysql://mmuser:secret@tcp(db.example.com:3306)/mattermost")
		cfg.Sanitize(nil, &model.SanitizeOptions{PartiallyRedactDataSources: true})

		snapshot := &Snapshot{
			Config:   &model.SupportPacketConfig{Config: cfg},
			Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
		}

		_, ok := snapshot.ConfigString(func(config *model.Config) *string { return config.SqlSettings.DataSource })
		require.False(t, ok)

		_, ok = snapshot.DataSource()
		require.False(t, ok)
	})

	t.Run("postgres partial redact keeps host and remains readable", func(t *testing.T) {
		cfg := &model.Config{}
		cfg.SqlSettings.DriverName = new(model.DatabaseDriverPostgres)
		cfg.SqlSettings.DataSource = new("postgres://mmuser:secret@db.example.com:5432/mattermost?sslmode=disable&connect_timeout=10")
		cfg.Sanitize(nil, &model.SanitizeOptions{PartiallyRedactDataSources: true})

		snapshot := &Snapshot{
			Config:   &model.SupportPacketConfig{Config: cfg},
			Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
		}

		dsn, ok := snapshot.DataSource()
		require.True(t, ok)
		require.Contains(t, dsn, "****:****")
		require.Contains(t, dsn, "db.example.com:5432")
	})
}

func TestJobsForOutsideCollectedSetReturnsUnavailable(t *testing.T) {
	t.Parallel()

	snapshot := &Snapshot{
		Jobs:     &model.SupportPacketJobList{},
		Sections: map[model.WorkspaceSection]error{model.SectionJobs: nil},
	}

	jobs, ok := snapshot.JobsFor(model.JobTypeExpiryNotify)
	require.False(t, ok)
	require.Nil(t, jobs)
}

func TestAccessorsReturnFalseWhenSectionAbsent(t *testing.T) {
	t.Parallel()

	cfg := &model.Config{}
	cfg.SqlSettings.Trace = new(true)
	cfg.SqlSettings.MaxOpenConns = new(25)

	snapshot := &Snapshot{
		Config:   &model.SupportPacketConfig{Config: cfg},
		Jobs:     &model.SupportPacketJobList{},
		Plugins:  &model.SupportPacketPluginList{},
		Sections: map[model.WorkspaceSection]error{},
	}

	_, ok := snapshot.ConfigString(func(config *model.Config) *string { return config.SqlSettings.DriverName })
	require.False(t, ok)
	_, ok = snapshot.ConfigBool(func(config *model.Config) *bool { return config.SqlSettings.Trace })
	require.False(t, ok)
	_, ok = snapshot.ConfigInt(func(config *model.Config) *int { return config.SqlSettings.MaxOpenConns })
	require.False(t, ok)
	_, ok = snapshot.DataSource()
	require.False(t, ok)
	_, ok = snapshot.JobsFor(model.JobTypeLdapSync)
	require.False(t, ok)
	_, ok = snapshot.PluginEnabled("com.mattermost.calls")
	require.False(t, ok)
}

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
				},
				Sections: model.SectionErrors{model.SectionServerSoftware: nil},
			},
		},
	}

	nodes := standalone.Nodes()
	require.Len(t, nodes, 1)
	require.Nil(t, nodes[0].ClusterInfo)

	cluster := &Snapshot{
		nodes: []*NodeSnapshot{
			{Hostname: "node-1", IsLeader: true, ClusterInfo: &model.ClusterInfo{Hostname: "node-1"}, Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}}, Sections: model.SectionErrors{model.SectionServerSoftware: nil}},
			{Hostname: "node-2", IsLeader: false, ClusterInfo: &model.ClusterInfo{Hostname: "node-2"}, Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}}, Sections: model.SectionErrors{model.SectionServerSoftware: nil}},
			{Hostname: "node-3", IsLeader: false, ClusterInfo: &model.ClusterInfo{Hostname: "node-3"}, Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}}, Sections: model.SectionErrors{model.SectionServerSoftware: nil}},
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

func TestNodeVersionParityLiveAndPacket(t *testing.T) {
	t.Parallel()

	liveNode := &NodeSnapshot{
		ClusterInfo: &model.ClusterInfo{
			Version: "10.4.0",
		},
		Diagnostics: &model.NodeDiagnostics{
			Diagnostics: &model.SupportPacketDiagnostics{},
		},
		Sections: model.SectionErrors{model.SectionServerSoftware: nil},
	}
	liveNode.Diagnostics.Diagnostics.Server.Version = "10.4.0"

	packetNode := &NodeSnapshot{
		Diagnostics: &model.NodeDiagnostics{
			Diagnostics: &model.SupportPacketDiagnostics{},
		},
		Sections: model.SectionErrors{model.SectionServerSoftware: nil},
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
		},
		Sections: model.SectionErrors{model.SectionServerSoftware: nil},
	}

	_, ok := packetNode.ConfigHash()
	require.False(t, ok)
}

func TestSectionAvailabilityMethods(t *testing.T) {
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

	nodeErr := errors.New("probe failed")
	node := &NodeSnapshot{
		Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}},
		Sections: model.SectionErrors{
			model.SectionLDAPProbe: nil,
			model.SectionSAMLProbe: nodeErr,
		},
	}

	require.True(t, node.Has(model.SectionLDAPProbe))
	require.False(t, node.Has(model.SectionSAMLProbe))
	ok, err = node.SectionErr(model.SectionSAMLProbe)
	require.True(t, ok)
	require.Equal(t, nodeErr, err)
}

func TestCollectedJobTypes(t *testing.T) {
	t.Parallel()

	jobTypes := CollectedJobTypes()
	require.Len(t, jobTypes, 6)
	require.Contains(t, strings.Join(jobTypes, ","), model.JobTypeLdapSync)
	require.Contains(t, strings.Join(jobTypes, ","), model.JobTypeDataRetention)
	require.Contains(t, strings.Join(jobTypes, ","), model.JobTypeMessageExport)
	require.Contains(t, strings.Join(jobTypes, ","), model.JobTypeElasticsearchPostIndexing)
	require.Contains(t, strings.Join(jobTypes, ","), model.JobTypeElasticsearchPostAggregation)
	require.Contains(t, strings.Join(jobTypes, ","), model.JobTypeMigrations)
}
