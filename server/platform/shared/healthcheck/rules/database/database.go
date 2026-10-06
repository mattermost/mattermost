// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(
		dbNoReadReplica,
		dbNoSearchReplica,
		dbTraceOn,
		dbMaxOpenConnsLow,
		dbQueryTimeoutHigh,
		dbHAFailoverStormRisk,
		dbPostgresUnsupported,
		dbPoolSaturated,
		dbReplicaUnused,
		dbConnectionIsIP,
		dbReplicaLagUnmonitored,
		dbIdleExceedsOpen,
	)
}

const (
	databaseConsolePath = "/admin_console/environment/database"
	databaseDocsURL     = "https://docs.mattermost.com/administration-guide/configure/environment-configuration-settings.html#database"

	dataSourceSubject               = "SqlSettings.DataSource"
	dataSourceReplicasSubject       = "SqlSettings.DataSourceReplicas"
	dataSourceSearchReplicasSubject = "SqlSettings.DataSourceSearchReplicas"
	maxOpenConnsSubject             = "SqlSettings.MaxOpenConns"
)

func unknownConfig() []healthcheck.Result {
	return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
}

func unknownStats() []healthcheck.Result {
	return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)}
}

func unknownDiagnostics() []healthcheck.Result {
	return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
}

func resolved() []healthcheck.Result {
	return []healthcheck.Result{healthcheck.Resolved()}
}

// config returns the collected config, for rules that only need the length of a list
// setting and so must not be blocked by a redacted entry.
func config(s *healthcheck.Snapshot) (*model.Config, bool) {
	if !s.Has(model.SectionConfig) || s.Config == nil || s.Config.Config == nil {
		return nil, false
	}

	return s.Config.Config, true
}

func maxOpenConns(s *healthcheck.Snapshot) (int, bool) {
	return s.ConfigInt(func(cfg *model.Config) *int { return cfg.SqlSettings.MaxOpenConns })
}

func registeredUsers(s *healthcheck.Snapshot) (int64, bool) {
	return s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.RegisteredUsers })
}

// leaderDiag returns the leader's diagnostics, or ok=false when they or the given section were not collected.
func leaderDiag(s *healthcheck.Snapshot, section model.NodeSection) (*model.SupportPacketDiagnostics, bool) {
	leader, ok := s.Leader()
	if !ok {
		return nil, false
	}

	diag, ok := leader.Diag()
	if !ok {
		return nil, false
	}

	if _, err := leader.SectionErr(section); err != nil {
		return nil, false
	}

	return diag, true
}
