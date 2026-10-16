// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"net"
	"net/url"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

var dbConnectionIsIP = healthcheck.Rule{
	Code:     "DB_CONNECTION_IS_IP",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_connection_is_ip.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_connection_is_ip.remediation"),
		DocsURL:       databaseDocsURL,
		ConsolePath:   databaseConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Eval:       evalDBConnectionIsIP,
}

// hostsFromDSN returns every host and hostaddr a Postgres DSN in URL or keyword form names,
// including the comma-separated lists the driver accepts for multi-host connections.
func hostsFromDSN(dsn string) ([]string, bool) {
	var hosts []string
	add := func(list string) {
		for host := range strings.SplitSeq(strings.Trim(list, "'"), ",") {
			if h, _, err := net.SplitHostPort(host); err == nil {
				host = h
			}
			if host = strings.Trim(host, "[]"); host != "" {
				hosts = append(hosts, host)
			}
		}
	}

	if rest, found := cutPostgresScheme(dsn); found {
		authority, query, _ := strings.Cut(rest, "?")
		authority, _, _ = strings.Cut(authority, "/")
		if i := strings.LastIndex(authority, "@"); i >= 0 {
			authority = authority[i+1:]
		}
		params, err := url.ParseQuery(query)
		if err != nil {
			return nil, false
		}

		add(authority)
		add(params.Get("host"))
		add(params.Get("hostaddr"))
		return hosts, len(hosts) > 0
	}

	for field := range strings.FieldsSeq(dsn) {
		if key, value, found := strings.Cut(field, "="); found && (key == "host" || key == "hostaddr") {
			add(value)
		}
	}

	return hosts, len(hosts) > 0
}

func cutPostgresScheme(dsn string) (string, bool) {
	if rest, found := strings.CutPrefix(dsn, "postgres://"); found {
		return rest, true
	}
	return strings.CutPrefix(dsn, "postgresql://")
}

func evalDBConnectionIsIP(s *healthcheck.Snapshot) []healthcheck.Result {
	var primary []string
	dsn, ok := s.DataSource()
	if ok {
		primary = []string{dsn}
	}

	replicas, replicasOK := s.ConfigStrings(func(cfg *model.Config) []string { return cfg.SqlSettings.DataSourceReplicas })
	searchReplicas, searchOK := s.ConfigStrings(func(cfg *model.Config) []string { return cfg.SqlSettings.DataSourceSearchReplicas })

	return []healthcheck.Result{
		ipHostResult(dataSourceSubject, primary, ok),
		ipHostResult(dataSourceReplicasSubject, replicas, replicasOK),
		ipHostResult(dataSourceSearchReplicasSubject, searchReplicas, searchOK),
	}
}

// The detail names the setting only: a DSN, even sanitized, never leaves the rule.
func ipHostResult(subject string, dsns []string, ok bool) healthcheck.Result {
	if !ok {
		return healthcheck.UnknownSubject(subject, healthcheck.ReasonConfigUnavailable)
	}

	firing := false
	for _, dsn := range dsns {
		hosts, ok := hostsFromDSN(dsn)
		if !ok {
			return healthcheck.UnknownSubject(subject, healthcheck.ReasonConfigUnavailable)
		}
		if slices.ContainsFunc(hosts, func(host string) bool { return net.ParseIP(host) != nil }) {
			firing = true
		}
	}

	if firing {
		return healthcheck.FiringSubject(subject, healthcheck.TranslationId("health.rule.db_connection_is_ip.message")).WithDetail("setting", subject)
	}

	return healthcheck.ResolvedSubject(subject)
}
