// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"net/url"
	"strings"
)

// Only the URL form needs parsing: sanitized config redacts every other DSN form.
func hostsFromDSN(dsn string) ([]string, bool) {
	rest, found := strings.CutPrefix(dsn, "postgres://")
	if !found {
		if rest, found = strings.CutPrefix(dsn, "postgresql://"); !found {
			return nil, false
		}
	}

	authority, query, _ := strings.Cut(rest, "?")
	authority, _, _ = strings.Cut(authority, "/")
	if i := strings.LastIndex(authority, "@"); i >= 0 {
		authority = authority[i+1:]
	}
	params, err := url.ParseQuery(query)
	if err != nil {
		return nil, false
	}

	var hosts []string
	for _, list := range []string{authority, params.Get("host")} {
		for host := range strings.SplitSeq(list, ",") {
			if host != "" {
				hosts = append(hosts, host)
			}
		}
	}

	return hosts, len(hosts) > 0
}
