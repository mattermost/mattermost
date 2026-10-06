// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func versionDiag(version *string) *model.SupportPacketDiagnostics {
	diag := &model.SupportPacketDiagnostics{}
	diag.Database.Version = version
	return diag
}

func poolDiag(inUse, idle *int, replicaConnections int) *model.SupportPacketDiagnostics {
	diag := &model.SupportPacketDiagnostics{}
	diag.Database.MasterConnectionsInUse = inUse
	diag.Database.MasterConnectionsIdle = idle
	diag.Database.ReplicaConnections = replicaConnections
	return diag
}

func failSection(s *healthcheck.Snapshot, section model.NodeSection) *healthcheck.Snapshot {
	s.Nodes()[0].Diagnostics.Errors = map[model.NodeSection]error{section: errors.New("boom")}
	return s
}

func TestDBPostgresUnsupported(t *testing.T) {
	t.Parallel()

	firing := firingWant("health.rule.db_postgres_unsupported.message")

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"leader diagnostics absent", newSnapshot(defaultConfig(), nil, nil), unknownDiagWant},
		{"version not collected", newSnapshot(defaultConfig(), nil, versionDiag(nil)), unknownDiagWant},
		{"identity section failed", failSection(newSnapshot(defaultConfig(), nil, versionDiag(new("14.9"))), model.SectionDatabaseIdentity), unknownDiagWant},
		{"14.9", newSnapshot(defaultConfig(), nil, versionDiag(new("14.9"))), firing},
		{"15.4 with distribution suffix", newSnapshot(defaultConfig(), nil, versionDiag(new("15.4 (Debian 15.4-1.pgdg120+1)"))), resolvedWant},
		{"16", newSnapshot(defaultConfig(), nil, versionDiag(new("16"))), resolvedWant},
		{"garbage", newSnapshot(defaultConfig(), nil, versionDiag(new("garbage"))), unknownDiagWant},
		{"empty", newSnapshot(defaultConfig(), nil, versionDiag(new(""))), unknownDiagWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbPostgresUnsupported, tc.snapshot, tc.want)
		})
	}

	results := evalDBPostgresUnsupported(newSnapshot(nil, nil, versionDiag(new("14.9"))))
	require.Len(t, results, 1)
	assert.Equal(t, map[string]string{"version": "14.9", "minimum": "15"}, results[0].Details)
}

func TestDBPoolSaturated(t *testing.T) {
	t.Parallel()

	maxOpen := func(n *int) *model.Config {
		cfg := defaultConfig()
		cfg.SqlSettings.MaxOpenConns = n
		return cfg
	}

	firing := firingWant("health.rule.db_pool_saturated.message")

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, nil, poolDiag(new(95), new(5), 0)), unknownConfigWant},
		{"max open unset", newSnapshot(maxOpen(nil), nil, poolDiag(new(95), new(5), 0)), unknownConfigWant},
		{"leader diagnostics absent", newSnapshot(maxOpen(new(100)), nil, nil), unknownDiagWant},
		{"in use not collected", newSnapshot(maxOpen(new(100)), nil, poolDiag(nil, nil, 0)), unknownDiagWant},
		{"pool section failed", failSection(newSnapshot(maxOpen(new(100)), nil, poolDiag(new(95), new(5), 0)), model.SectionDatabasePool), unknownDiagWant},
		{"95 of 100 in use", newSnapshot(maxOpen(new(100)), nil, poolDiag(new(95), new(5), 0)), firing.withValue(95)},
		{"90 of 100 in use", newSnapshot(maxOpen(new(100)), nil, poolDiag(new(90), new(0), 0)), firing.withValue(90)},
		{"89 of 100 in use", newSnapshot(maxOpen(new(100)), nil, poolDiag(new(89), new(0), 0)), resolvedWant.withValue(89)},
		{"20 in use and 80 idle", newSnapshot(maxOpen(new(100)), nil, poolDiag(new(20), new(80), 0)), resolvedWant.withValue(20)},
		{"unlimited pool", newSnapshot(maxOpen(new(0)), nil, poolDiag(new(500), new(0), 0)), resolvedWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbPoolSaturated, tc.snapshot, tc.want)
		})
	}

	results := evalDBPoolSaturated(newSnapshot(maxOpen(new(100)), nil, poolDiag(new(95), new(5), 0)))
	require.Len(t, results, 1)
	assert.Equal(t, map[string]string{"in_use": "95", "max_open": "100", "percent": "95"}, results[0].Details)
}

func TestDBReplicaUnused(t *testing.T) {
	t.Parallel()

	withReplica := defaultConfig()
	withReplica.SqlSettings.DataSourceReplicas = []string{replicaDSN}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, nil, poolDiag(nil, nil, 0)), unknownConfigWant},
		{"no replicas configured", newSnapshot(defaultConfig(), nil, poolDiag(nil, nil, 0)), resolvedWant},
		{"no replicas without diagnostics", newSnapshot(defaultConfig(), nil, nil), resolvedWant},
		{"replica without connections", newSnapshot(withReplica, nil, poolDiag(nil, nil, 0)), firingWant("health.rule.db_replica_unused.message")},
		{"replica connected", newSnapshot(withReplica, nil, poolDiag(nil, nil, 1)), resolvedWant},
		{"leader diagnostics absent", newSnapshot(withReplica, nil, nil), unknownDiagWant},
		{"pool section failed", failSection(newSnapshot(withReplica, nil, poolDiag(nil, nil, 0)), model.SectionDatabasePool), unknownDiagWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbReplicaUnused, tc.snapshot, tc.want)
		})
	}
}
