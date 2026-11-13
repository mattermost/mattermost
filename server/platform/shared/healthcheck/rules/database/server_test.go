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
	return typedVersionDiag(new(model.DatabaseDriverPostgres), version)
}

func typedVersionDiag(dbType, version *string) *model.SupportPacketDiagnostics {
	diag := &model.SupportPacketDiagnostics{}
	diag.Database.Type = dbType
	diag.Database.Version = version
	return diag
}

func poolDiag(inUse, replicasOnline *int) *model.SupportPacketDiagnostics {
	diag := &model.SupportPacketDiagnostics{}
	diag.Database.MasterConnectionsInUse = inUse
	diag.Database.ReplicasOnline = replicasOnline
	return onClusterLicense(diag)
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
		{"type not collected", newSnapshot(defaultConfig(), nil, typedVersionDiag(nil, new("14.9"))), unknownDiagWant},
		{"mysql type", newSnapshot(defaultConfig(), nil, typedVersionDiag(new("mysql"), new("8.0.36"))), unknownDiagWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbPostgresUnsupported, tc.snapshot, tc.want)
		})
	}

	results := dbPostgresUnsupported.Eval(newSnapshot(nil, nil, versionDiag(new("14.9"))))
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
	noReply := newSnapshot(maxOpen(new(100)), nil, nil)

	firing := firingWant("health.rule.db_pool_saturated.message")

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, nil, poolDiag(new(95), nil)), unknownConfigWant},
		{"max open unset", newSnapshot(maxOpen(nil), nil, poolDiag(new(95), nil)), unknownConfigWant},
		{"in use not collected", newSnapshot(maxOpen(new(100)), nil, poolDiag(nil, nil)), unknownDiagWant},
		{"pool section failed", failSection(newSnapshot(maxOpen(new(100)), nil, poolDiag(new(95), nil)), model.SectionDatabasePool), unknownDiagWant},
		{"95 of 100 in use", newSnapshot(maxOpen(new(100)), nil, poolDiag(new(95), nil)), firing.withValue(95)},
		{"90 of 100 in use", newSnapshot(maxOpen(new(100)), nil, poolDiag(new(90), nil)), firing.withValue(90)},
		{"89 of 100 in use", newSnapshot(maxOpen(new(100)), nil, poolDiag(new(89), nil)), resolvedWant.withValue(89)},
		{"20 of 100 in use", newSnapshot(maxOpen(new(100)), nil, poolDiag(new(20), nil)), resolvedWant.withValue(20)},
		{"unlimited pool", newSnapshot(maxOpen(new(0)), nil, poolDiag(new(500), nil)), resolvedWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, dbPoolSaturated.EvalNode(tc.snapshot, tc.snapshot.Nodes()[0]), tc.want)
		})
	}

	t.Run("node did not reply", func(t *testing.T) {
		t.Parallel()
		node := &healthcheck.NodeSnapshot{Hostname: "app-2.example.com", CollectErr: healthcheck.ErrNodeNoReply}
		assertResults(t, dbPoolSaturated.EvalNode(noReply, node), unknownDiagWant)
	})

	t.Run("fires for the saturated node only", func(t *testing.T) {
		t.Parallel()

		node := func(hostname string, inUse int) *healthcheck.NodeSnapshot {
			return &healthcheck.NodeSnapshot{Hostname: hostname, Diagnostics: &model.NodeDiagnostics{Diagnostics: poolDiag(new(inUse), nil)}}
		}
		s := healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{node("app-1.example.com", 20), node("app-2.example.com", 95), node("app-3.example.com", 40)})
		s.Config, s.Sections = noReply.Config, noReply.Sections

		registry := healthcheck.NewRegistry()
		registry.Register(dbPoolSaturated)
		states := map[string]healthcheck.State{}
		for _, evaluation := range healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry}).Evaluate(s) {
			states[evaluation.Result.Scope] = evaluation.Result.State
			if evaluation.Result.State == healthcheck.StateFiring {
				assert.Equal(t, map[string]string{"in_use": "95", "max_open": "100", "percent": "95"}, evaluation.Result.Details)
			}
		}
		assert.Equal(t, map[string]healthcheck.State{
			"app-1.example.com": healthcheck.StateResolved,
			"app-2.example.com": healthcheck.StateFiring,
			"app-3.example.com": healthcheck.StateResolved,
		}, states)
	})
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
		{"config absent", newSnapshot(nil, nil, poolDiag(nil, nil)), unknownConfigWant},
		{"no replicas configured", newSnapshot(defaultConfig(), nil, poolDiag(nil, nil)), resolvedWant},
		{"no replicas without pool diagnostics", newSnapshot(defaultConfig(), nil, onClusterLicense(&model.SupportPacketDiagnostics{})), resolvedWant},
		{"no replica online", newSnapshot(withReplica, nil, poolDiag(nil, new(0))), firingWant("health.rule.db_replica_unused.message")},
		{"idle replica online", newSnapshot(withReplica, nil, poolDiag(nil, new(1))), resolvedWant},
		{"online replicas not collected", newSnapshot(withReplica, nil, poolDiag(nil, nil)), unknownDiagWant},
		{"leader diagnostics absent", newSnapshot(withReplica, nil, nil), unknownLicenseWant},
		{"unlicensed ignores replicas", newSnapshot(withReplica, nil, withLicense(poolDiag(nil, new(0)), model.SupportPacketLicense{})), resolvedWant},
		{"entry license uses replicas", newSnapshot(withReplica, nil, withLicense(poolDiag(nil, new(0)), model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuMattermostEntry})), firingWant("health.rule.db_replica_unused.message")},
		{"license section failed", failSection(newSnapshot(withReplica, nil, poolDiag(nil, new(0))), model.SectionLicense), unknownLicenseWant},
		{"pool section failed", failSection(newSnapshot(withReplica, nil, poolDiag(nil, new(1))), model.SectionDatabasePool), unknownDiagWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbReplicaUnused, tc.snapshot, tc.want)
		})
	}
}
