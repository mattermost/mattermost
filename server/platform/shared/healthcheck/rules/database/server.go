// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	// Mirrors sqlstore's minimumRequiredPostgresVersion, which this package cannot import.
	minimumPostgresMajorVersion = 15

	poolSaturatedPercent = 90
)

var dbPostgresUnsupported = healthcheck.Rule{
	Code:     "DB_POSTGRES_UNSUPPORTED",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_postgres_unsupported.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_postgres_unsupported.remediation"),
		DocsURL:       "https://docs.mattermost.com/deployment-guide/software-hardware-requirements.html",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "Database.Version",
	Eval:       evalDBPostgresUnsupported,
}

var dbPoolSaturated = healthcheck.Rule{
	Code:     "DB_POOL_SATURATED",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_pool_saturated.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_pool_saturated.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    maxOpenConnsSubject,
	Eval:       evalDBPoolSaturated,
}

var dbReplicaUnused = healthcheck.Rule{
	Code:     "DB_REPLICA_UNUSED",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_replica_unused.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_replica_unused.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityProbe,
	Subject:    dataSourceReplicasSubject,
	Eval:       evalDBReplicaUnused,
}

// majorVersion reads the leading integer of a server_version string such as "15.4 (Debian 15.4-1)".
func majorVersion(version string) (int, bool) {
	version = strings.TrimSpace(version)
	end := strings.IndexFunc(version, func(r rune) bool { return r < '0' || r > '9' })
	if end == -1 {
		end = len(version)
	}

	major, err := strconv.Atoi(version[:end])
	return major, err == nil
}

func evalDBPostgresUnsupported(s *healthcheck.Snapshot) []healthcheck.Result {
	diag, ok := leaderDiag(s, model.SectionDatabaseIdentity)
	if !ok || diag.Database.Version == nil {
		return unknownDiagnostics()
	}

	version := *diag.Database.Version
	major, ok := majorVersion(version)
	switch {
	case !ok:
		return unknownDiagnostics()
	case major < minimumPostgresMajorVersion:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_postgres_unsupported.message")).
			WithDetail("version", version).
			WithDetail("minimum", strconv.Itoa(minimumPostgresMajorVersion))}
	default:
		return resolved()
	}
}

// Collection is leader-only, so this covers the leader's pool.
func evalDBPoolSaturated(s *healthcheck.Snapshot) []healthcheck.Result {
	maxOpen, ok := maxOpenConns(s)
	if !ok {
		return unknownConfig()
	}

	diag, ok := leaderDiag(s, model.SectionDatabasePool)
	if !ok || diag.Database.MasterConnectionsInUse == nil {
		return unknownDiagnostics()
	}
	if maxOpen <= 0 {
		return resolved()
	}

	inUse := *diag.Database.MasterConnectionsInUse
	percent := 100 * float64(inUse) / float64(maxOpen)
	if percent < poolSaturatedPercent {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(percent)}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_pool_saturated.message")).
		WithDetail("in_use", strconv.Itoa(inUse)).
		WithDetail("max_open", strconv.Itoa(maxOpen)).
		WithDetail("percent", strconv.FormatFloat(percent, 'f', 0, 64)).
		WithValue(percent)}
}

func evalDBReplicaUnused(s *healthcheck.Snapshot) []healthcheck.Result {
	cfg, ok := config(s)
	if !ok {
		return unknownConfig()
	}
	if len(cfg.SqlSettings.DataSourceReplicas) == 0 {
		return resolved()
	}

	diag, ok := leaderDiag(s, model.SectionDatabasePool)
	switch {
	case !ok:
		return unknownDiagnostics()
	case diag.Database.ReplicaConnections == 0:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_replica_unused.message"))}
	default:
		return resolved()
	}
}
