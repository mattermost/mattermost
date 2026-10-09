// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	gossipMessage         = "health.rule.cluster_gossip_unencrypted.message"
	lruMessage            = "health.rule.cluster_lru_cache.message"
	singleNodeMessage     = "health.rule.cluster_single_node.message"
	badAdvertiseMessage   = "health.rule.cluster_bad_advertise.message"
	configWritableMessage = "health.rule.cluster_config_writable.message"
)

func gossipOff(cfg *model.Config) { cfg.ClusterSettings.EnableGossipEncryption = new(false) }

func configWritable(cfg *model.Config) { cfg.ClusterSettings.ReadOnlyConfig = new(false) }

func advertise(address string) func(*model.Config) {
	return func(cfg *model.Config) { cfg.ClusterSettings.AdvertiseAddress = new(address) }
}

func fileSource(diag *model.SupportPacketDiagnostics) {
	diag.Config.Source = "file:///opt/mattermost/config/config.json"
}

func nodes(n int) func(*model.SupportPacketDiagnostics) {
	return func(diag *model.SupportPacketDiagnostics) { diag.Cluster.NumberOfNodes = new(n) }
}

func TestHARules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{clusterGossipUnencrypted, clusterLRUCache, clusterSingleNode, clusterBadAdvertise, clusterConfigWritable}
	everythingWrong := all(gossipOff, configWritable, advertise("127.0.0.1"))
	fileSingleNode := func(diag *model.SupportPacketDiagnostics) {
		fileSource(diag)
		diag.Cluster.NumberOfNodes = new(1)
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "config section absent",
			snapshot: healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{leaderNode(nil)}),
			want: map[string]want{
				"CLUSTER_GOSSIP_UNENCRYPTED": configUnknown,
				"CLUSTER_LRU_CACHE":          configUnknown,
				"CLUSTER_SINGLE_NODE":        configUnknown,
				"CLUSTER_BAD_ADVERTISE":      configUnknown,
				"CLUSTER_CONFIG_WRITABLE":    configUnknown,
			},
		},
		{
			name: "config section failed",
			snapshot: func() *healthcheck.Snapshot {
				s := configSnapshot(all(haEnabled, everythingWrong), leaderNode(fileSingleNode))
				s.Sections[model.SectionConfig] = errors.New("boom")
				return s
			}(),
			want: map[string]want{
				"CLUSTER_GOSSIP_UNENCRYPTED": configUnknown,
				"CLUSTER_LRU_CACHE":          configUnknown,
				"CLUSTER_SINGLE_NODE":        configUnknown,
				"CLUSTER_BAD_ADVERTISE":      configUnknown,
				"CLUSTER_CONFIG_WRITABLE":    configUnknown,
			},
		},
		{
			name:     "cluster disabled closes every gate",
			snapshot: withUsers(configSnapshot(everythingWrong, leaderNode(fileSingleNode)), 200_000),
			want: map[string]want{
				"CLUSTER_GOSSIP_UNENCRYPTED": resolved,
				"CLUSTER_LRU_CACHE":          resolved,
				"CLUSTER_SINGLE_NODE":        resolved,
				"CLUSTER_BAD_ADVERTISE":      resolved,
				"CLUSTER_CONFIG_WRITABLE":    resolved,
			},
		},
		{
			name: "empty cluster name closes the HA gate but a single node still fires",
			snapshot: withUsers(configSnapshot(all(everythingWrong, func(cfg *model.Config) {
				cfg.ClusterSettings.Enable = new(true)
			}), leaderNode(fileSingleNode)), 200_000),
			want: map[string]want{
				"CLUSTER_GOSSIP_UNENCRYPTED": resolved,
				"CLUSTER_LRU_CACHE":          resolved,
				"CLUSTER_SINGLE_NODE":        firing(singleNodeMessage, nil),
				"CLUSTER_BAD_ADVERTISE":      resolved,
				"CLUSTER_CONFIG_WRITABLE":    resolved,
			},
		},
		{
			name:     "healthy cluster with defaults",
			snapshot: withUsers(configSnapshot(haEnabled, leaderNode(nil)), 312),
			want: map[string]want{
				"CLUSTER_GOSSIP_UNENCRYPTED": resolved,
				"CLUSTER_LRU_CACHE":          resolved.withValue(312),
				"CLUSTER_SINGLE_NODE":        resolved,
				"CLUSTER_BAD_ADVERTISE":      resolved,
				"CLUSTER_CONFIG_WRITABLE":    resolved,
			},
		},
		{
			name:     "everything wrong on a running cluster",
			snapshot: withUsers(configSnapshot(all(haEnabled, everythingWrong), leaderNode(fileSingleNode)), 200_000),
			want: map[string]want{
				"CLUSTER_GOSSIP_UNENCRYPTED": firing(gossipMessage, nil),
				"CLUSTER_LRU_CACHE":          firing(lruMessage, map[string]string{"users": "200000"}).withValue(200_000),
				"CLUSTER_SINGLE_NODE":        firing(singleNodeMessage, nil),
				"CLUSTER_BAD_ADVERTISE":      firing(badAdvertiseMessage, map[string]string{"address": "127.0.0.1"}),
				"CLUSTER_CONFIG_WRITABLE":    firing(configWritableMessage, nil),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertRules(t, rules, tc.snapshot, tc.want)
		})
	}
}

func TestClusterGossipUnencrypted(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"encryption on", configSnapshot(haEnabled), resolved},
		{"encryption off", configSnapshot(all(haEnabled, gossipOff)), firing(gossipMessage, nil)},
		{"encryption unset", configSnapshot(all(haEnabled, func(cfg *model.Config) { cfg.ClusterSettings.EnableGossipEncryption = nil })), configUnknown},
		{"cluster name unset", configSnapshot(all(haEnabled, gossipOff, func(cfg *model.Config) { cfg.ClusterSettings.ClusterName = nil })), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, evalClusterGossipUnencrypted(tc.snapshot))
		})
	}
}

func TestClusterLRUCache(t *testing.T) {
	t.Parallel()

	redis := func(cfg *model.Config) { cfg.CacheSettings.CacheType = new(model.CacheTypeRedis) }

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"redis without stats", configSnapshot(all(haEnabled, redis)), resolved},
		{"lru without stats", configSnapshot(haEnabled), statsUnknown},
		{"lru with the users stat missing", func() *healthcheck.Snapshot {
			s := configSnapshot(haEnabled)
			s.Stats = &model.SupportPacketStats{}
			return s
		}(), statsUnknown},
		{"lru below the threshold", withUsers(configSnapshot(haEnabled), 99_999), resolved.withValue(99_999)},
		{"lru at the threshold", withUsers(configSnapshot(haEnabled), 100_000), firing(lruMessage, map[string]string{"users": "100000"}).withValue(100_000)},
		{"cache type unset", withUsers(configSnapshot(all(haEnabled, func(cfg *model.Config) { cfg.CacheSettings.CacheType = nil })), 200_000), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, evalClusterLRUCache(tc.snapshot))
		})
	}
}

func TestClusterSingleNode(t *testing.T) {
	t.Parallel()

	enabled := func(cfg *model.Config) { cfg.ClusterSettings.Enable = new(true) }
	clusterFailed := func() *healthcheck.NodeSnapshot {
		node := leaderNode(nodes(1))
		node.Diagnostics.Errors[model.SectionCluster] = errors.New("error while getting cluster infos")
		return node
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"cluster disabled", configSnapshot(nil, leaderNode(nodes(1))), resolved},
		{"empty cluster name and one node", configSnapshot(enabled, leaderNode(nodes(1))), firing(singleNodeMessage, nil)},
		{"no cluster interface reports one node", configSnapshot(haEnabled, leaderNode(nodes(1))), firing(singleNodeMessage, nil)},
		{"two nodes", configSnapshot(haEnabled, leaderNode(nodes(2))), resolved},
		{"node count not collected", configSnapshot(haEnabled, leaderNode(func(diag *model.SupportPacketDiagnostics) {
			diag.Cluster.NumberOfNodes = nil
		})), diagUnknown},
		{"cluster section failed", configSnapshot(haEnabled, clusterFailed()), diagUnknown},
		{"cluster section absent", configSnapshot(haEnabled, func() *healthcheck.NodeSnapshot {
			node := leaderNode(nodes(1))
			delete(node.Diagnostics.Errors, model.SectionCluster)
			return node
		}()), diagUnknown},
		{"no leader", configSnapshot(haEnabled, diagNode("app-2.example.com", false, nodes(1))), diagUnknown},
		{"leader without diagnostics", configSnapshot(haEnabled, &healthcheck.NodeSnapshot{IsLeader: true}), diagUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, evalClusterSingleNode(tc.snapshot))
		})
	}
}

func TestClusterBadAdvertise(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		address string
		fires   bool
	}{
		{"", false},
		{"10.0.0.5", false},
		{"app-1.example.com", false},
		{"fd00::5", false},
		{"localhost.example.com", false},
		{"127.0.0.1", true},
		{"127.0.1.1", true},
		{"::1", true},
		{"0.0.0.0", true},
		{"::", true},
		{"localhost", true},
		{"LOCALHOST", true},
	}

	for _, tc := range testCases {
		t.Run(tc.address, func(t *testing.T) {
			t.Parallel()

			expected := resolved
			if tc.fires {
				expected = firing(badAdvertiseMessage, map[string]string{"address": tc.address})
			}
			assertResult(t, expected, evalClusterBadAdvertise(configSnapshot(all(haEnabled, advertise(tc.address)))))
		})
	}

	t.Run("address unset", func(t *testing.T) {
		t.Parallel()
		assertResult(t, configUnknown, evalClusterBadAdvertise(configSnapshot(all(haEnabled, func(cfg *model.Config) { cfg.ClusterSettings.AdvertiseAddress = nil }))))
	})
}

func TestClusterConfigWritable(t *testing.T) {
	t.Parallel()

	writable := all(haEnabled, configWritable)
	source := func(source string) func(*model.SupportPacketDiagnostics) {
		return func(diag *model.SupportPacketDiagnostics) { diag.Config.Source = source }
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"read-only does not read the source", configSnapshot(haEnabled), resolved},
		{"file store", configSnapshot(writable, leaderNode(fileSource)), firing(configWritableMessage, nil)},
		{"database store", configSnapshot(writable, leaderNode(nil)), resolved},
		{"config source absent", configSnapshot(writable, func() *healthcheck.NodeSnapshot {
			node := leaderNode(fileSource)
			delete(node.Diagnostics.Errors, model.SectionConfigSource)
			return node
		}()), diagUnknown},
		{"empty source from an older packet", configSnapshot(writable, leaderNode(source(""))), diagUnknown},
		{"no leader", configSnapshot(writable), diagUnknown},
		{"read-only unset", configSnapshot(all(haEnabled, func(cfg *model.Config) { cfg.ClusterSettings.ReadOnlyConfig = nil }), leaderNode(fileSource)), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, evalClusterConfigWritable(tc.snapshot))
		})
	}
}
