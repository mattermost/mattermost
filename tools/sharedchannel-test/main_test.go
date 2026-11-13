package main

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateDBNames(t *testing.T) {
	tests := []struct {
		name    string
		manage  bool
		dbA     string
		dbB     string
		wantErr string
	}{
		{name: "managed defaults", manage: true, dbA: "sharedchannel_test_a", dbB: "sharedchannel_test_b"},
		{name: "unmanaged defaults", manage: false, dbA: "mattermost_test", dbB: "mattermost_node_test"},
		{name: "leading underscore and digits", manage: true, dbA: "_db1", dbB: "db_2"},
		{name: "max length", manage: true, dbA: "a" + strings.Repeat("b", 62), dbB: "b"},
		{name: "too long", manage: true, dbA: "a" + strings.Repeat("b", 63), dbB: "b", wantErr: "invalid database name"},
		{name: "hyphen", manage: true, dbA: "shared-channel", dbB: "b", wantErr: "invalid database name"},
		{name: "upper case", manage: true, dbA: "a", dbB: "MyDb", wantErr: "invalid database name"},
		{name: "leading digit", manage: true, dbA: "1db", dbB: "b", wantErr: "invalid database name"},
		{name: "empty", manage: false, dbA: "", dbB: "b", wantErr: "invalid database name"},
		{name: "managed refuses run-server db", manage: true, dbA: "mattermost_test", dbB: "b", wantErr: "refusing"},
		{name: "managed refuses run-node db", manage: true, dbA: "a", dbB: "mattermost_node_test", wantErr: "refusing"},
		{name: "same name managed", manage: true, dbA: "same", dbB: "same", wantErr: "must differ"},
		{name: "same name unmanaged", manage: false, dbA: "mattermost_test", dbB: "mattermost_test", wantErr: "must differ"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateDBNames(Config{Manage: tc.manage, DBNameA: tc.dbA, DBNameB: tc.dbB})
			if tc.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, tc.wantErr)
		})
	}
}
