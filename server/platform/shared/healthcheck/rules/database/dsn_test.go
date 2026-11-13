// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestHostsFromDSN(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name  string
		dsn   string
		hosts []string
		ok    bool
	}{
		{"url with credentials", "postgres://****:****@db.example.com:5432/mattermost?sslmode=require", []string{"db.example.com:5432"}, true},
		{"postgresql scheme without credentials", "postgresql://10.0.0.5/mattermost", []string{"10.0.0.5"}, true},
		{"url host list", "postgres://****:****@db1.example.com:5432,[2001:db8::2]:5433,10.0.0.7/mattermost", []string{"db1.example.com:5432", "[2001:db8::2]:5433", "10.0.0.7"}, true},
		{"url host in query", "postgres:///mattermost?host=pgbouncer.internal&sslmode=require", []string{"pgbouncer.internal"}, true},
		{"url without host", "postgres:///mattermost", nil, false},
		{"url with bad query", "postgres://db.example.com/mattermost?sslmode=%zz", nil, false},
		{"keyword form", "host=db.example.com port=5432 user=mmuser dbname=mattermost", nil, false},
		{"redacted", model.FakeSetting, nil, false},
		{"empty", "", nil, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			hosts, ok := hostsFromDSN(tc.dsn)
			assert.Equal(t, tc.ok, ok)
			assert.Equal(t, tc.hosts, hosts)
		})
	}
}
