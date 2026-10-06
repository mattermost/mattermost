// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	readReplicaUsers   = 2_000
	searchReplicaPosts = 1_000_000
	lowMaxOpenConns    = 75
	lowMaxOpenUsers    = 1_000
	highQueryTimeout   = 60
)

var dbNoReadReplica = healthcheck.Rule{
	Code:     "DB_NO_READ_REPLICA",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_no_read_replica.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_no_read_replica.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    dataSourceReplicasSubject,
	Eval:       evalDBNoReadReplica,
}

var dbNoSearchReplica = healthcheck.Rule{
	Code:     "DB_NO_SEARCH_REPLICA",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_no_search_replica.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_no_search_replica.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    dataSourceSearchReplicasSubject,
	Eval:       evalDBNoSearchReplica,
}

var dbTraceOn = healthcheck.Rule{
	Code:     "DB_TRACE_ON",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_trace_on.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_trace_on.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "SqlSettings.Trace",
	Eval:       evalDBTraceOn,
}

var dbMaxOpenConnsLow = healthcheck.Rule{
	Code:     "DB_MAX_OPEN_CONNS_LOW",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_max_open_conns_low.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_max_open_conns_low.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    maxOpenConnsSubject,
	Eval:       evalDBMaxOpenConnsLow,
}

var dbQueryTimeoutHigh = healthcheck.Rule{
	Code:     "DB_QUERY_TIMEOUT_HIGH",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_query_timeout_high.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_query_timeout_high.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "SqlSettings.QueryTimeout",
	Eval:       evalDBQueryTimeoutHigh,
}

var dbReplicaLagUnmonitored = healthcheck.Rule{
	Code:     "DB_REPLICA_LAG_UNMONITORED",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_replica_lag_unmonitored.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_replica_lag_unmonitored.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "SqlSettings.ReplicaLagSettings",
	Eval:       evalDBReplicaLagUnmonitored,
}

var dbIdleExceedsOpen = healthcheck.Rule{
	Code:     "DB_IDLE_EXCEEDS_OPEN",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_idle_exceeds_open.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_idle_exceeds_open.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "SqlSettings.MaxIdleConns",
	Eval:       evalDBIdleExceedsOpen,
}

func evalDBNoReadReplica(s *healthcheck.Snapshot) []healthcheck.Result {
	cfg, ok := config(s)
	if !ok {
		return unknownConfig()
	}
	if len(cfg.SqlSettings.DataSourceReplicas) > 0 {
		return resolved()
	}

	users, ok := registeredUsers(s)
	if !ok {
		return unknownStats()
	}
	if users < readReplicaUsers {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(users))}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_no_read_replica.message")).
		WithDetail("users", strconv.FormatInt(users, 10)).
		WithValue(float64(users))}
}

func evalDBNoSearchReplica(s *healthcheck.Snapshot) []healthcheck.Result {
	cfg, ok := config(s)
	if !ok {
		return unknownConfig()
	}
	if len(cfg.SqlSettings.DataSourceSearchReplicas) > 0 {
		return resolved()
	}

	searching, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ElasticsearchSettings.EnableSearching })
	if !ok {
		return unknownConfig()
	}
	if searching {
		return resolved()
	}

	posts, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.Posts })
	if !ok {
		return unknownStats()
	}
	if posts < searchReplicaPosts {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(posts))}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_no_search_replica.message")).
		WithDetail("posts", strconv.FormatInt(posts, 10)).
		WithValue(float64(posts))}
}

func evalDBTraceOn(s *healthcheck.Snapshot) []healthcheck.Result {
	trace, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.SqlSettings.Trace })
	switch {
	case !ok:
		return unknownConfig()
	case trace:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_trace_on.message"))}
	default:
		return resolved()
	}
}

func evalDBMaxOpenConnsLow(s *healthcheck.Snapshot) []healthcheck.Result {
	maxOpen, ok := maxOpenConns(s)
	if !ok {
		return unknownConfig()
	}
	if maxOpen >= lowMaxOpenConns {
		return resolved()
	}

	users, ok := registeredUsers(s)
	if !ok {
		return unknownStats()
	}
	if users < lowMaxOpenUsers {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(users))}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_max_open_conns_low.message")).
		WithDetail("users", strconv.FormatInt(users, 10)).
		WithDetail("max_open", strconv.Itoa(maxOpen)).
		WithValue(float64(users))}
}

func evalDBQueryTimeoutHigh(s *healthcheck.Snapshot) []healthcheck.Result {
	timeout, ok := s.ConfigInt(func(cfg *model.Config) *int { return cfg.SqlSettings.QueryTimeout })
	switch {
	case !ok:
		return unknownConfig()
	case timeout >= highQueryTimeout:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_query_timeout_high.message")).
			WithDetail("timeout", strconv.Itoa(timeout))}
	default:
		return resolved()
	}
}

// Replica lag is only computed inside the metrics collector, so it needs metrics on to matter.
func evalDBReplicaLagUnmonitored(s *healthcheck.Snapshot) []healthcheck.Result {
	cfg, ok := config(s)
	if !ok {
		return unknownConfig()
	}
	if len(cfg.SqlSettings.DataSourceReplicas) == 0 {
		return resolved()
	}

	metrics, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.MetricsSettings.Enable })
	switch {
	case !ok:
		return unknownConfig()
	case metrics && len(cfg.SqlSettings.ReplicaLagSettings) == 0:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_replica_lag_unmonitored.message"))}
	default:
		return resolved()
	}
}

func evalDBIdleExceedsOpen(s *healthcheck.Snapshot) []healthcheck.Result {
	maxOpen, ok := maxOpenConns(s)
	if !ok {
		return unknownConfig()
	}

	maxIdle, ok := s.ConfigInt(func(cfg *model.Config) *int { return cfg.SqlSettings.MaxIdleConns })
	switch {
	case !ok:
		return unknownConfig()
	case maxIdle > maxOpen:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_idle_exceeds_open.message")).
			WithDetail("max_idle", strconv.Itoa(maxIdle)).
			WithDetail("max_open", strconv.Itoa(maxOpen))}
	default:
		return resolved()
	}
}
