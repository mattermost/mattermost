// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"net"
	"net/url"
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

// hostFromDSN extracts the host of a Postgres DSN in URL or keyword form.
func hostFromDSN(dsn string) (string, bool) {
	if u, err := url.Parse(dsn); err == nil && u.Host != "" {
		host := u.Hostname()
		return host, host != ""
	}

	for field := range strings.FieldsSeq(dsn) {
		if key, value, found := strings.Cut(field, "="); found && key == "host" {
			host := strings.Trim(value, "'")
			return host, host != ""
		}
	}

	return "", false
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
		host, ok := hostFromDSN(dsn)
		if !ok {
			return healthcheck.UnknownSubject(subject, healthcheck.ReasonConfigUnavailable)
		}
		if net.ParseIP(host) != nil {
			firing = true
		}
	}

	if firing {
		return healthcheck.FiringSubject(subject, healthcheck.TranslationId("health.rule.db_connection_is_ip.message")).WithDetail("setting", subject)
	}

	return healthcheck.ResolvedSubject(subject)
}
