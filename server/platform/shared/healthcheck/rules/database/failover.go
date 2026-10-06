// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"slices"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const failoverBurst = 400

var poolerHostMarkers = []string{"bouncer", "pgpool", "pooler"}

var dbHAFailoverStormRisk = healthcheck.Rule{
	Code:     "DB_HA_FAILOVER_STORM_RISK",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_ha_failover_storm_risk.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_ha_failover_storm_risk.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityTopology,
	Subject:    maxOpenConnsSubject,
	Eval:       evalDBHAFailoverStormRisk,
}

func isPoolerHost(host string) bool {
	host = strings.ToLower(host)
	return slices.ContainsFunc(poolerHostMarkers, func(marker string) bool { return strings.Contains(host, marker) })
}

func evalDBHAFailoverStormRisk(s *healthcheck.Snapshot) []healthcheck.Result {
	clustered, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.Enable })
	if !ok {
		return unknownConfig()
	}
	if !clustered {
		return resolved()
	}

	diag, ok := leaderDiag(s, model.SectionCluster)
	if !ok || diag.Cluster.NumberOfNodes == nil {
		return unknownDiagnostics()
	}
	nodes := *diag.Cluster.NumberOfNodes
	if nodes < 2 {
		return resolved()
	}

	maxOpen, ok := maxOpenConns(s)
	if !ok {
		return unknownConfig()
	}
	replicas, ok := s.ConfigStrings(func(cfg *model.Config) []string { return cfg.SqlSettings.DataSourceReplicas })
	if !ok {
		return unknownConfig()
	}
	searchReplicas, ok := s.ConfigStrings(func(cfg *model.Config) []string { return cfg.SqlSettings.DataSourceSearchReplicas })
	if !ok {
		return unknownConfig()
	}

	// Every data source gets its own pool of up to MaxOpenConns on every node.
	dataSources := 1 + len(replicas) + len(searchReplicas)
	burst := maxOpen * nodes * dataSources
	if burst < failoverBurst {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(burst))}
	}

	dsn, ok := s.DataSource()
	if !ok {
		return unknownConfig()
	}
	host, ok := hostFromDSN(dsn)
	if !ok {
		return unknownConfig()
	}
	if isPoolerHost(host) {
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(burst))}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.db_ha_failover_storm_risk.message")).
		WithDetail("nodes", strconv.Itoa(nodes)).
		WithDetail("max_open", strconv.Itoa(maxOpen)).
		WithDetail("data_sources", strconv.Itoa(dataSources)).
		WithDetail("burst", strconv.Itoa(burst)).
		WithValue(float64(burst))}
}
