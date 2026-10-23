// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"net"
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
	Eval: healthcheck.Licensed(func(f *model.Features) *bool { return f.Cluster },
		healthcheck.Gate((*healthcheck.Snapshot).ClusterEnabled, healthcheck.ReasonConfigUnavailable, evalDBHAFailoverStormRisk)),
}

func isPoolerHost(host string) bool {
	// Nodes share one database, so a local host in a cluster can only be a per-node pooler or proxy.
	if strings.HasPrefix(host, "/") {
		return true
	}
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.ToLower(strings.Trim(host, "[]"))
	if ip := net.ParseIP(host); host == "localhost" || (ip != nil && ip.IsLoopback()) {
		return true
	}
	return slices.ContainsFunc(poolerHostMarkers, func(marker string) bool { return strings.Contains(host, marker) })
}

func evalDBHAFailoverStormRisk(s *healthcheck.Snapshot) healthcheck.Result {
	diag, ok := s.LeaderDiag(model.SectionCluster)
	if !ok || diag.Cluster.NumberOfNodes == nil {
		return unknownDiagnostics()
	}
	nodes := *diag.Cluster.NumberOfNodes
	if nodes < 2 {
		return healthcheck.Resolved()
	}

	maxOpen, ok := maxOpenConns(s)
	if !ok {
		return unknownConfig()
	}
	// Only the primary pools reconnect to the promoted primary; replica pools keep their own hosts.
	burst := maxOpen * nodes
	if burst < failoverBurst {
		return healthcheck.Resolved().WithValue(float64(burst))
	}

	dsn, ok := s.DataSource()
	if !ok {
		return unknownConfig()
	}
	hosts, ok := hostsFromDSN(dsn)
	if !ok {
		return unknownConfig()
	}
	// The driver tries hosts in order, so any direct host can take the full burst.
	if !slices.ContainsFunc(hosts, func(host string) bool { return !isPoolerHost(host) }) {
		return healthcheck.Resolved().WithValue(float64(burst))
	}

	return healthcheck.Firing(healthcheck.TranslationId("health.rule.db_ha_failover_storm_risk.message")).
		WithDetail("nodes", strconv.Itoa(nodes)).
		WithDetail("max_open", strconv.Itoa(maxOpen)).
		WithDetail("burst", strconv.Itoa(burst)).
		WithValue(float64(burst))
}
