// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"net"
	"net/url"
	"strings"
)

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
