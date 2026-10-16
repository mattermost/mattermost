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
		{"url with credentials", "postgres://****:****@db.example.com:5432/mattermost?sslmode=require", []string{"db.example.com"}, true},
		{"url without credentials", "postgresql://10.0.0.5/mattermost", []string{"10.0.0.5"}, true},
		{"ipv6 literal", "postgres://mmuser:secret@[2001:db8::1]:5432/mattermost", []string{"2001:db8::1"}, true},
		{"url host list", "postgres://****:****@db1.example.com:5432,[2001:db8::2]:5433,10.0.0.7/mattermost", []string{"db1.example.com", "2001:db8::2", "10.0.0.7"}, true},
		{"url host in query", "postgres:///mattermost?host=10.0.0.7&sslmode=require", []string{"10.0.0.7"}, true},
		{"url hostaddr in query", "postgres://****:****@db.example.com/mattermost?hostaddr=10.0.0.7", []string{"db.example.com", "10.0.0.7"}, true},
		{"url without host", "postgres:///mattermost", nil, false},
		{"url with bad query", "postgres://db.example.com/mattermost?sslmode=%zz", nil, false},
		{"keyword form", "host=db.example.com port=5432 user=mmuser dbname=mattermost", []string{"db.example.com"}, true},
		{"keyword form quoted", "user=mmuser host='192.0.2.10' dbname=mattermost", []string{"192.0.2.10"}, true},
		{"keyword host list", "host=db1.example.com,db2.example.com dbname=mattermost", []string{"db1.example.com", "db2.example.com"}, true},
		{"keyword hostaddr", "host=db.example.com hostaddr=10.0.0.7 dbname=mattermost", []string{"db.example.com", "10.0.0.7"}, true},
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
