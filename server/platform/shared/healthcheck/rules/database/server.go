// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/internal/versions"
)

const poolSaturatedPercent = 90

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
	Eval:       healthcheck.Single(evalDBPostgresUnsupported),
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
	EvalNode:   healthcheck.SingleNode(evalDBPoolSaturated),
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
	// The store ignores replicas without a license.
	Eval: healthcheck.Licensed(healthcheck.AnyLicense, healthcheck.Single(evalDBReplicaUnused)),
}

func evalDBPostgresUnsupported(s *healthcheck.Snapshot) healthcheck.Result {
	diag, ok := s.LeaderDiag(model.SectionDatabaseIdentity)
	if !ok || diag.Database.Version == nil {
		return unknownDiagnostics()
	}
	// Packets from servers that predate the Postgres-only requirement can report MySQL.
	if diag.Database.Type == nil || *diag.Database.Type != model.DatabaseDriverPostgres {
		return unknownDiagnostics()
	}

	version := *diag.Database.Version
	major, ok := versions.Major(version)
	switch {
	case !ok:
		return unknownDiagnostics()
	case major < model.MinimumPostgresMajorVersion:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.db_postgres_unsupported.message")).
			WithDetail("version", version).
			WithDetail("minimum", strconv.Itoa(model.MinimumPostgresMajorVersion))
	default:
		return healthcheck.Resolved()
	}
}

func evalDBPoolSaturated(s *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	maxOpen, ok := maxOpenConns(s)
	if !ok {
		return unknownConfig()
	}
	if maxOpen <= 0 {
		return healthcheck.Resolved()
	}

	diag, ok := n.SectionDiag(model.SectionDatabasePool)
	if !ok || diag.Database.MasterConnectionsInUse == nil {
		return unknownDiagnostics()
	}

	inUse := *diag.Database.MasterConnectionsInUse
	percent := 100 * float64(inUse) / float64(maxOpen)
	if percent < poolSaturatedPercent {
		return healthcheck.Resolved().WithValue(percent)
	}

	return healthcheck.Firing(healthcheck.TranslationId("health.rule.db_pool_saturated.message")).
		WithDetail("in_use", strconv.Itoa(inUse)).
		WithDetail("max_open", strconv.Itoa(maxOpen)).
		WithDetail("percent", strconv.FormatFloat(percent, 'f', 0, 64)).
		WithValue(percent)
}

func evalDBReplicaUnused(s *healthcheck.Snapshot) healthcheck.Result {
	cfg, ok := s.ConfigRoot()
	if !ok {
		return unknownConfig()
	}
	if len(cfg.SqlSettings.DataSourceReplicas) == 0 {
		return healthcheck.Resolved()
	}

	diag, ok := s.LeaderDiag(model.SectionDatabasePool)
	switch {
	case !ok || diag.Database.ReplicasOnline == nil:
		return unknownDiagnostics()
	case *diag.Database.ReplicasOnline == 0:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.db_replica_unused.message"))
	default:
		return healthcheck.Resolved()
	}
}
