// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHostFromDSN(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		dsn  string
		host string
		ok   bool
	}{
		{"url with credentials", "postgres://****:****@db.example.com:5432/mattermost?sslmode=require", "db.example.com", true},
		{"url without credentials", "postgresql://10.0.0.5/mattermost", "10.0.0.5", true},
		{"ipv6 literal", "postgres://mmuser:secret@[2001:db8::1]:5432/mattermost", "2001:db8::1", true},
		{"keyword form", "host=db.example.com port=5432 user=mmuser dbname=mattermost", "db.example.com", true},
		{"keyword form quoted", "user=mmuser host='192.0.2.10' dbname=mattermost", "192.0.2.10", true},
		{"malformed url", "postgres://mmuser:secret@[2001:db8::1/mattermost", "", false},
		{"redacted", model.FakeSetting, "", false},
		{"empty", "", "", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			host, ok := hostFromDSN(tc.dsn)
			assert.Equal(t, tc.ok, ok)
			assert.Equal(t, tc.host, host)
		})
	}
}

func TestDBConnectionIsIP(t *testing.T) {
	t.Parallel()

	dsns := func(primary string, replicas, searchReplicas []string) *model.Config {
		cfg := defaultConfig()
		cfg.SqlSettings.DataSource = new(primary)
		cfg.SqlSettings.DataSourceReplicas = replicas
		cfg.SqlSettings.DataSourceSearchReplicas = searchReplicas
		return cfg
	}

	const message = "health.rule.db_connection_is_ip.message"
	resolved := healthcheck.StateResolved
	firing := healthcheck.StateFiring
	unknown := healthcheck.StateUnknown

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]healthcheck.State
	}{
		{
			name:     "config absent",
			snapshot: newSnapshot(nil, nil, nil),
			want:     map[string]healthcheck.State{dataSourceSubject: unknown, dataSourceReplicasSubject: unknown, dataSourceSearchReplicasSubject: unknown},
		},
		{
			name:     "dns names everywhere",
			snapshot: newSnapshot(dsns(primaryDSN, []string{replicaDSN}, []string{replicaDSN}), nil, nil),
			want:     map[string]healthcheck.State{dataSourceSubject: resolved, dataSourceReplicasSubject: resolved, dataSourceSearchReplicasSubject: resolved},
		},
		{
			name:     "empty replica lists",
			snapshot: newSnapshot(dsns(primaryDSN, nil, []string{}), nil, nil),
			want:     map[string]healthcheck.State{dataSourceSubject: resolved, dataSourceReplicasSubject: resolved, dataSourceSearchReplicasSubject: resolved},
		},
		{
			name:     "ip host replica",
			snapshot: newSnapshot(dsns(primaryDSN, []string{replicaDSN, "postgres://****:****@10.0.0.7:5432/mattermost"}, nil), nil, nil),
			want:     map[string]healthcheck.State{dataSourceSubject: resolved, dataSourceReplicasSubject: firing, dataSourceSearchReplicasSubject: resolved},
		},
		{
			name:     "redacted search replica",
			snapshot: newSnapshot(dsns("postgres://****:****@[2001:db8::1]:5432/mattermost", nil, []string{model.FakeSetting}), nil, nil),
			want:     map[string]healthcheck.State{dataSourceSubject: firing, dataSourceReplicasSubject: resolved, dataSourceSearchReplicasSubject: unknown},
		},
		{
			name:     "redacted primary",
			snapshot: newSnapshot(dsns(model.FakeSetting, []string{"host=192.0.2.10 dbname=mattermost"}, nil), nil, nil),
			want:     map[string]healthcheck.State{dataSourceSubject: unknown, dataSourceReplicasSubject: firing, dataSourceSearchReplicasSubject: resolved},
		},
		{
			name:     "unparseable replica",
			snapshot: newSnapshot(dsns(primaryDSN, []string{"10.0.0.7:5432"}, nil), nil, nil),
			want:     map[string]healthcheck.State{dataSourceSubject: resolved, dataSourceReplicasSubject: unknown, dataSourceSearchReplicasSubject: resolved},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			results := dbConnectionIsIP.Eval(tc.snapshot)
			require.Len(t, results, 3)

			got := map[string]healthcheck.State{}
			for _, result := range results {
				got[result.Subject] = result.State
				switch result.State {
				case healthcheck.StateFiring:
					assert.Equal(t, message, result.MessageID)
					assert.Equal(t, map[string]string{"setting": result.Subject}, result.Details)
				case healthcheck.StateUnknown:
					assert.Equal(t, healthcheck.ReasonConfigUnavailable, result.MessageID)
				}
			}
			assert.Equal(t, tc.want, got)
		})
	}
}
