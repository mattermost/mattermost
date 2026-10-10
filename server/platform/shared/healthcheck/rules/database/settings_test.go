// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const replicaDSN = "postgres://****:****@replica.example.com:5432/mattermost"

func withStats(users, posts int64) *model.SupportPacketStats {
	return &model.SupportPacketStats{RegisteredUsers: new(users), Posts: new(posts)}
}

func TestDBNoReadReplica(t *testing.T) {
	t.Parallel()

	withReplica := defaultConfig()
	withReplica.SqlSettings.DataSourceReplicas = []string{replicaDSN}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, withStats(5000, 0), nil), unknownConfigWant},
		{"config section failed", &healthcheck.Snapshot{
			Config:   &model.SupportPacketConfig{Config: defaultConfig()},
			Sections: map[model.WorkspaceSection]error{model.SectionConfig: errors.New("boom")},
		}, unknownConfigWant},
		{"no replica at 2000 users", newSnapshot(defaultConfig(), withStats(2000, 0), nil), firingWant("health.rule.db_no_read_replica.message").withValue(2000)},
		{"no replica below 2000 users", newSnapshot(defaultConfig(), withStats(1999, 0), nil), resolvedWant.withValue(1999)},
		{"replica configured", newSnapshot(withReplica, withStats(5000, 0), nil), resolvedWant},
		{"stats absent with replica configured", newSnapshot(withReplica, nil, nil), resolvedWant},
		{"stats absent without replica", newSnapshot(defaultConfig(), nil, nil), unknownStatsWant},
		{"user count not collected", newSnapshot(defaultConfig(), &model.SupportPacketStats{}, nil), unknownStatsWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbNoReadReplica, tc.snapshot, tc.want)
		})
	}
}

func TestDBNoSearchReplica(t *testing.T) {
	t.Parallel()

	withSearchReplica := defaultConfig()
	withSearchReplica.SqlSettings.DataSourceSearchReplicas = []string{replicaDSN}

	searching := defaultConfig()
	searching.ElasticsearchSettings.EnableIndexing = new(true)
	searching.ElasticsearchSettings.EnableSearching = new(true)

	indexingOnly := defaultConfig()
	indexingOnly.ElasticsearchSettings.EnableIndexing = new(true)
	indexingOnly.ElasticsearchSettings.EnableSearching = new(false)

	searchingUnset := defaultConfig()
	searchingUnset.ElasticsearchSettings.EnableSearching = nil

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, withStats(0, 2_000_000), nil), unknownConfigWant},
		{"database search at 1M posts", newSnapshot(defaultConfig(), withStats(0, 1_000_000), nil), firingWant("health.rule.db_no_search_replica.message").withValue(1_000_000)},
		{"database search below 1M posts", newSnapshot(defaultConfig(), withStats(0, 999_999), nil), resolvedWant.withValue(999_999)},
		{"indexing without searching at 2M posts", newSnapshot(indexingOnly, withStats(0, 2_000_000), nil), firingWant("health.rule.db_no_search_replica.message").withValue(2_000_000)},
		{"elasticsearch searching", newSnapshot(searching, withStats(0, 2_000_000), nil), resolvedWant},
		{"search replica configured", newSnapshot(withSearchReplica, withStats(0, 2_000_000), nil), resolvedWant},
		{"searching unreadable", newSnapshot(searchingUnset, withStats(0, 2_000_000), nil), unknownConfigWant},
		{"stats absent", newSnapshot(defaultConfig(), nil, nil), unknownStatsWant},
		{"stats absent while searching", newSnapshot(searching, nil, nil), resolvedWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbNoSearchReplica, tc.snapshot, tc.want)
		})
	}
}

func TestDBTraceOn(t *testing.T) {
	t.Parallel()

	trace := defaultConfig()
	trace.SqlSettings.Trace = new(true)

	unset := defaultConfig()
	unset.SqlSettings.Trace = nil

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, nil, nil), unknownConfigWant},
		{"trace unset", newSnapshot(unset, nil, nil), unknownConfigWant},
		{"trace on", newSnapshot(trace, nil, nil), firingWant("health.rule.db_trace_on.message")},
		{"trace off", newSnapshot(defaultConfig(), nil, nil), resolvedWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbTraceOn, tc.snapshot, tc.want)
		})
	}
}

func TestDBMaxOpenConnsLow(t *testing.T) {
	t.Parallel()

	low := defaultConfig()
	low.SqlSettings.MaxOpenConns = new(74)

	atThreshold := defaultConfig()
	atThreshold.SqlSettings.MaxOpenConns = new(75)

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, withStats(5000, 0), nil), unknownConfigWant},
		{"low at 1000 users", newSnapshot(low, withStats(1000, 0), nil), firingWant("health.rule.db_max_open_conns_low.message").withValue(1000)},
		{"low below 1000 users", newSnapshot(low, withStats(999, 0), nil), resolvedWant.withValue(999)},
		{"at 75", newSnapshot(atThreshold, withStats(5000, 0), nil), resolvedWant},
		{"default with stats absent", newSnapshot(defaultConfig(), nil, nil), resolvedWant},
		{"low with stats absent", newSnapshot(low, nil, nil), unknownStatsWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbMaxOpenConnsLow, tc.snapshot, tc.want)
		})
	}
}

func TestDBQueryTimeoutHigh(t *testing.T) {
	t.Parallel()

	timeout := func(seconds int) *model.Config {
		cfg := defaultConfig()
		cfg.SqlSettings.QueryTimeout = new(seconds)
		return cfg
	}

	unset := defaultConfig()
	unset.SqlSettings.QueryTimeout = nil

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, nil, nil), unknownConfigWant},
		{"timeout unset", newSnapshot(unset, nil, nil), unknownConfigWant},
		{"60 seconds", newSnapshot(timeout(60), nil, nil), firingWant("health.rule.db_query_timeout_high.message")},
		{"59 seconds", newSnapshot(timeout(59), nil, nil), resolvedWant},
		{"default", newSnapshot(defaultConfig(), nil, nil), resolvedWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbQueryTimeoutHigh, tc.snapshot, tc.want)
		})
	}
}

func TestDBReplicaLagUnmonitored(t *testing.T) {
	t.Parallel()

	replicas := func(metrics *bool, lag []*model.ReplicaLagSettings) *model.Config {
		cfg := defaultConfig()
		cfg.SqlSettings.DataSourceReplicas = []string{replicaDSN}
		cfg.SqlSettings.ReplicaLagSettings = lag
		cfg.MetricsSettings.Enable = metrics
		return cfg
	}

	noReplicas := defaultConfig()
	noReplicas.MetricsSettings.Enable = new(true)

	lag := []*model.ReplicaLagSettings{{DataSource: new(model.FakeSetting), QueryAbsoluteLag: new("select 1")}}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, nil, nil), unknownConfigWant},
		{"replicas, metrics on, no lag settings", newSnapshot(replicas(new(true), nil), nil, nil), firingWant("health.rule.db_replica_lag_unmonitored.message")},
		{"replicas, metrics on, redacted lag settings", newSnapshot(replicas(new(true), lag), nil, nil), resolvedWant},
		{"replicas, metrics off", newSnapshot(replicas(new(false), nil), nil, nil), resolvedWant},
		{"replicas, metrics unset", newSnapshot(replicas(nil, nil), nil, nil), unknownConfigWant},
		{"no replicas", newSnapshot(noReplicas, nil, nil), resolvedWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbReplicaLagUnmonitored, tc.snapshot, tc.want)
		})
	}
}

func TestDBIdleExceedsOpen(t *testing.T) {
	t.Parallel()

	pool := func(maxOpen, maxIdle *int) *model.Config {
		cfg := defaultConfig()
		cfg.SqlSettings.MaxOpenConns = maxOpen
		cfg.SqlSettings.MaxIdleConns = maxIdle
		return cfg
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, nil, nil), unknownConfigWant},
		{"max open unset", newSnapshot(pool(nil, new(50)), nil, nil), unknownConfigWant},
		{"max idle unset", newSnapshot(pool(new(100), nil), nil, nil), unknownConfigWant},
		{"idle above open", newSnapshot(pool(new(100), new(101)), nil, nil), firingWant("health.rule.db_idle_exceeds_open.message")},
		{"idle equals open", newSnapshot(pool(new(100), new(100)), nil, nil), resolvedWant},
		{"default", newSnapshot(defaultConfig(), nil, nil), resolvedWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbIdleExceedsOpen, tc.snapshot, tc.want)
		})
	}
}
