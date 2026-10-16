// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const primaryDSN = "postgres://****:****@db.example.com:5432/mattermost?sslmode=require"

func clusterConfig(maxOpen int, dsn string, replicas ...string) *model.Config {
	cfg := defaultConfig()
	cfg.ClusterSettings.Enable = new(true)
	cfg.SqlSettings.MaxOpenConns = new(maxOpen)
	cfg.SqlSettings.DataSource = new(dsn)
	cfg.SqlSettings.DataSourceReplicas = replicas
	return cfg
}

func clusterDiag(nodes *int) *model.SupportPacketDiagnostics {
	diag := &model.SupportPacketDiagnostics{}
	diag.Cluster.NumberOfNodes = nodes
	return diag
}

func TestDBHAFailoverStormRisk(t *testing.T) {
	t.Parallel()

	firing := firingWant("health.rule.db_ha_failover_storm_risk.message")

	clusterOff := clusterConfig(1000, primaryDSN)
	clusterOff.ClusterSettings.Enable = new(false)

	clusterUnset := clusterConfig(1000, primaryDSN)
	clusterUnset.ClusterSettings.Enable = nil

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, nil, clusterDiag(new(3))), unknownConfigWant},
		{"cluster unset", newSnapshot(clusterUnset, nil, clusterDiag(new(3))), unknownConfigWant},
		{"cluster off", newSnapshot(clusterOff, nil, clusterDiag(new(3))), resolvedWant},
		{"cluster off without diagnostics", newSnapshot(clusterOff, nil, nil), resolvedWant},
		{"leader diagnostics absent", newSnapshot(clusterConfig(200, primaryDSN), nil, nil), unknownDiagWant},
		{"node count not collected", newSnapshot(clusterConfig(200, primaryDSN), nil, clusterDiag(nil)), unknownDiagWant},
		{"cluster section failed", failSection(newSnapshot(clusterConfig(200, primaryDSN), nil, clusterDiag(new(2))), model.SectionCluster), unknownDiagWant},
		{"single node", newSnapshot(clusterConfig(1000, primaryDSN), nil, clusterDiag(new(1))), resolvedWant},
		{"burst at 400", newSnapshot(clusterConfig(200, primaryDSN), nil, clusterDiag(new(2))), firing.withValue(400)},
		{"burst below 400", newSnapshot(clusterConfig(100, primaryDSN), nil, clusterDiag(new(3))), resolvedWant.withValue(300)},
		{"replica pools do not count", newSnapshot(clusterConfig(100, primaryDSN, replicaDSN), nil, clusterDiag(new(2))), resolvedWant.withValue(200)},
		{"redacted dsn below 400", newSnapshot(clusterConfig(100, model.FakeSetting), nil, clusterDiag(new(3))), resolvedWant.withValue(300)},
		{"redacted dsn above 400", newSnapshot(clusterConfig(200, model.FakeSetting), nil, clusterDiag(new(3))), unknownConfigWant},
		{"pgbouncer host", newSnapshot(clusterConfig(200, "postgres://****:****@pgbouncer.internal:6432/mattermost"), nil, clusterDiag(new(3))), resolvedWant.withValue(600)},
		{"keyword form dsn", newSnapshot(clusterConfig(200, "host=PGPool.example.com port=5432 dbname=mattermost"), nil, clusterDiag(new(3))), unknownConfigWant},
		{"uppercase pooler host", newSnapshot(clusterConfig(200, "postgres://****:****@PGPool.example.com:5432/mattermost"), nil, clusterDiag(new(3))), resolvedWant.withValue(600)},
		{"pooler in a host list", newSnapshot(clusterConfig(200, "postgres://****:****@pgbouncer-a.internal:6432,pgbouncer-b.internal:6432/mattermost"), nil, clusterDiag(new(3))), resolvedWant.withValue(600)},
		{"pooler on localhost", newSnapshot(clusterConfig(200, "postgres://****:****@localhost:6432/mattermost"), nil, clusterDiag(new(3))), resolvedWant.withValue(600)},
		{"pooler on ipv4 loopback", newSnapshot(clusterConfig(200, "postgres://****:****@127.0.0.1:6432/mattermost"), nil, clusterDiag(new(3))), resolvedWant.withValue(600)},
		{"pooler on ipv6 loopback", newSnapshot(clusterConfig(200, "postgres://****:****@[::1]:6432/mattermost"), nil, clusterDiag(new(3))), resolvedWant.withValue(600)},
		{"pooler on a unix socket", newSnapshot(clusterConfig(200, "postgres://****:****@/mattermost?host=/var/run/pgbouncer"), nil, clusterDiag(new(3))), resolvedWant.withValue(600)},
		{"remote ip host", newSnapshot(clusterConfig(200, "postgres://****:****@10.0.0.7:5432/mattermost"), nil, clusterDiag(new(3))), firing.withValue(600)},
		{"pooler only in the path", newSnapshot(clusterConfig(200, "postgres://****:****@db.example.com:5432/pooler"), nil, clusterDiag(new(3))), firing.withValue(600)},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbHAFailoverStormRisk, tc.snapshot, tc.want)
		})
	}
}

func TestDBHAFailoverStormRiskDetails(t *testing.T) {
	t.Parallel()

	results := evalDBHAFailoverStormRisk(newSnapshot(clusterConfig(300, primaryDSN, replicaDSN), nil, clusterDiag(new(2))))
	require.Len(t, results, 1)
	assert.Equal(t, map[string]string{"nodes": "2", "max_open": "300", "burst": "600"}, results[0].Details)
}
