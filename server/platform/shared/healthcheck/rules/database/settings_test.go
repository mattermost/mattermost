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

// professional is a license without Elasticsearch; any license makes the store use replicas.
func professional() *model.SupportPacketDiagnostics {
	return withLicense(&model.SupportPacketDiagnostics{}, model.SupportPacketLicense{
		SkuShortName: model.LicenseShortSkuProfessional,
		Features:     &model.Features{Elasticsearch: new(false)},
	})
}

func enterprise() *model.SupportPacketDiagnostics {
	return withLicense(&model.SupportPacketDiagnostics{}, model.SupportPacketLicense{
		SkuShortName: model.LicenseShortSkuEnterprise,
		Features:     &model.Features{Elasticsearch: new(true)},
	})
}

func unlicensed() *model.SupportPacketDiagnostics {
	return &model.SupportPacketDiagnostics{}
}

func TestDBNoReadReplica(t *testing.T) {
	t.Parallel()

	withReplica := defaultConfig()
	withReplica.SqlSettings.DataSourceReplicas = []string{replicaDSN}

	configFailed := newSnapshot(defaultConfig(), withStats(5000, 0), professional())
	configFailed.Sections[model.SectionConfig] = errors.New("boom")

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, withStats(5000, 0), professional()), unknownConfigWant},
		{"config section failed", configFailed, unknownConfigWant},
		{"no replica at 2000 users", newSnapshot(defaultConfig(), withStats(2000, 0), professional()), firingWant("health.rule.db_no_read_replica.message").withValue(2000)},
		{"no replica below 2000 users", newSnapshot(defaultConfig(), withStats(1999, 0), professional()), resolvedWant.withValue(1999)},
		{"replica configured", newSnapshot(withReplica, withStats(5000, 0), professional()), resolvedWant},
		{"stats absent with replica configured", newSnapshot(withReplica, nil, professional()), resolvedWant},
		{"stats absent without replica", newSnapshot(defaultConfig(), nil, professional()), unknownStatsWant},
		{"user count not collected", newSnapshot(defaultConfig(), &model.SupportPacketStats{}, professional()), unknownStatsWant},
		{"unlicensed at 2000 users", newSnapshot(defaultConfig(), withStats(2000, 0), unlicensed()), resolvedWant},
		{"license unavailable at 2000 users", newSnapshot(defaultConfig(), withStats(2000, 0), nil), unknownLicenseWant},
		{"license unavailable below 2000 users", newSnapshot(defaultConfig(), withStats(1999, 0), nil), resolvedWant.withValue(1999)},
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

	dbSearchDisabled := defaultConfig()
	dbSearchDisabled.SqlSettings.DisableDatabaseSearch = new(true)

	dbSearchUnset := defaultConfig()
	dbSearchUnset.SqlSettings.DisableDatabaseSearch = nil

	const message = "health.rule.db_no_search_replica.message"
	const esMessage = "health.rule.db_no_search_replica.message.elasticsearch"

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"config absent", newSnapshot(nil, withStats(0, 2_000_000), professional()), unknownConfigWant},
		{"database search at 2M posts", newSnapshot(defaultConfig(), withStats(0, 2_000_000), professional()), firingWant(message).withValue(2_000_000)},
		{"database search below 2M posts", newSnapshot(defaultConfig(), withStats(0, 1_999_999), professional()), resolvedWant.withValue(1_999_999)},
		{"elasticsearch licensed but not searching", newSnapshot(indexingOnly, withStats(0, 2_000_000), enterprise()), firingWant(esMessage).withValue(2_000_000)},
		{"elasticsearch searching", newSnapshot(searching, withStats(0, 2_000_000), enterprise()), resolvedWant},
		{"searching without the elasticsearch license", newSnapshot(searching, withStats(0, 2_000_000), professional()), firingWant(message).withValue(2_000_000)},
		{"search replica configured", newSnapshot(withSearchReplica, withStats(0, 2_000_000), professional()), resolvedWant},
		{"searching unreadable", newSnapshot(searchingUnset, withStats(0, 2_000_000), professional()), unknownConfigWant},
		{"database search disabled", newSnapshot(dbSearchDisabled, withStats(0, 2_000_000), professional()), resolvedWant},
		{"database search setting unreadable", newSnapshot(dbSearchUnset, withStats(0, 2_000_000), professional()), unknownConfigWant},
		{"stats absent", newSnapshot(defaultConfig(), nil, professional()), unknownStatsWant},
		{"stats absent while searching", newSnapshot(searching, nil, enterprise()), resolvedWant},
		{"unlicensed at 2M posts", newSnapshot(defaultConfig(), withStats(0, 2_000_000), unlicensed()), resolvedWant},
		{"license unavailable at 2M posts", newSnapshot(defaultConfig(), withStats(0, 2_000_000), nil), unknownLicenseWant},
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
