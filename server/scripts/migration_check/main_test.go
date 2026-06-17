// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseMigration(t *testing.T) {
	tests := []struct {
		name   string
		path   string
		want   migration
		wantOk bool
	}{
		{
			name:   "postgres up file",
			path:   "server/channels/db/migrations/postgres/000195_threadmemberships_cleanup_v2.up.sql",
			want:   migration{driver: "postgres", version: "000195", name: "threadmemberships_cleanup_v2"},
			wantOk: true,
		},
		{
			name:   "postgres down file",
			path:   "server/channels/db/migrations/postgres/000001_create_teams.down.sql",
			want:   migration{driver: "postgres", version: "000001", name: "create_teams"},
			wantOk: true,
		},
		{
			name:   "relative path from migrations.list",
			path:   "channels/db/migrations/postgres/000042_add_index.up.sql",
			want:   migration{driver: "postgres", version: "000042", name: "add_index"},
			wantOk: true,
		},
		{
			name:   "other driver",
			path:   "server/channels/db/migrations/mysql/000003_create_cluster.up.sql",
			want:   migration{driver: "mysql", version: "000003", name: "create_cluster"},
			wantOk: true,
		},
		{
			name:   "absolute working-tree path with migrations in the root prefix",
			path:   "/home/ci/migrations/checkout/server/channels/db/migrations/postgres/000007_add_col.up.sql",
			want:   migration{driver: "postgres", version: "000007", name: "add_col"},
			wantOk: true,
		},
		{
			name:   "name containing dots is preserved",
			path:   "server/channels/db/migrations/postgres/000008_foo.bar.up.sql",
			want:   migration{driver: "postgres", version: "000008", name: "foo.bar"},
			wantOk: true,
		},
		{
			name:   "file directly under migrations without a driver dir is ignored",
			path:   "server/channels/db/migrations/000009_no_driver.up.sql",
			wantOk: false,
		},
		{
			name:   "file nested below the driver dir is ignored",
			path:   "server/channels/db/migrations/postgres/extra/000010_nested.up.sql",
			wantOk: false,
		},
		{
			name:   "sql file that is neither up nor down is ignored",
			path:   "server/channels/db/migrations/postgres/000011_plain.sql",
			wantOk: false,
		},
		{
			name:   "migrations.list is ignored",
			path:   "server/channels/db/migrations/migrations.list",
			wantOk: false,
		},
		{
			name:   "readme is ignored",
			path:   "server/channels/db/migrations/README.md",
			wantOk: false,
		},
		{
			name:   "non-migration file is ignored",
			path:   "server/channels/db/store.go",
			wantOk: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseMigration(tc.path)
			require.Equal(t, tc.wantOk, ok)
			if tc.wantOk {
				require.Equal(t, tc.want, got)
			}
		})
	}
}

func up(path string) string   { return path + ".up.sql" }
func down(path string) string { return path + ".down.sql" }

// migrationPair returns the up and down file paths for a migration stem.
func migrationPair(stem string) []string {
	base := "server/channels/db/migrations/postgres/" + stem
	return []string{up(base), down(base)}
}

func TestCompareMigrations(t *testing.T) {
	t.Run("identical migrations produce no violation", func(t *testing.T) {
		master := append(migrationPair("000001_create_teams"), migrationPair("000002_create_members")...)
		branch := append(migrationPair("000001_create_teams"), migrationPair("000002_create_members")...)

		require.Empty(t, compareMigrations(master, branch))
	})

	t.Run("newly added migration is ignored", func(t *testing.T) {
		master := migrationPair("000001_create_teams")
		branch := append(migrationPair("000001_create_teams"), migrationPair("000002_brand_new")...)

		require.Empty(t, compareMigrations(master, branch))
	})

	t.Run("empty inputs produce no violation", func(t *testing.T) {
		require.Empty(t, compareMigrations(nil, nil))
		require.Empty(t, compareMigrations(migrationPair("000001_a"), nil))
		require.Empty(t, compareMigrations(nil, migrationPair("000001_a")))
	})

	t.Run("deleted migration is not flagged", func(t *testing.T) {
		master := append(migrationPair("000001_a"), migrationPair("000002_b")...)
		branch := migrationPair("000001_a")

		require.Empty(t, compareMigrations(master, branch))
	})

	t.Run("simultaneous rename and renumber is treated as new", func(t *testing.T) {
		// Both version and name change, so the migration cannot be matched back
		// to master and is indistinguishable from a brand new one.
		master := migrationPair("000010_add_index")
		branch := migrationPair("000011_add_index_v2")

		require.Empty(t, compareMigrations(master, branch))
	})

	t.Run("renamed migration at same version is flagged", func(t *testing.T) {
		master := migrationPair("000001_create_teams")
		branch := migrationPair("000001_create_teams_renamed")

		violations := compareMigrations(master, branch)
		require.Len(t, violations, 1)
		require.Equal(t, "postgres", violations[0].driver)
		require.Contains(t, violations[0].message, "000001")
		require.Contains(t, violations[0].message, "create_teams_renamed")
		require.Contains(t, violations[0].message, "create_teams")
	})

	t.Run("renumbered migration is flagged", func(t *testing.T) {
		// master: 000010_add_index. branch moved it to 000011_add_index
		// (and 000010 now holds an unrelated, brand new migration).
		master := migrationPair("000010_add_index")
		branch := append(migrationPair("000010_something_else"), migrationPair("000011_add_index")...)

		violations := compareMigrations(master, branch)
		// Two issues: name "add_index" moved to a new number, and version
		// 000010 now points at a different name.
		require.Len(t, violations, 2)

		var sawRenumber, sawRename bool
		for _, v := range violations {
			if v.driver == "postgres" && strings.Contains(v.message, "add_index") && strings.Contains(v.message, "numbered") {
				sawRenumber = true
			}
			if v.driver == "postgres" && strings.Contains(v.message, "000010") && strings.Contains(v.message, "named") {
				sawRename = true
			}
		}
		require.True(t, sawRenumber, "expected a renumber violation for add_index")
		require.True(t, sawRename, "expected a rename violation for version 000010")
	})

	t.Run("renumber to a fresh number is flagged via name match", func(t *testing.T) {
		// master: 000010_add_index is the latest migration. branch bumps it to
		// 000050_add_index, a number that does not exist on master.
		master := migrationPair("000010_add_index")
		branch := migrationPair("000050_add_index")

		violations := compareMigrations(master, branch)
		require.Len(t, violations, 1)
		require.Contains(t, violations[0].message, "add_index")
		require.Contains(t, violations[0].message, "000050")
		require.Contains(t, violations[0].message, "000010")
	})

	t.Run("violations are reported per driver", func(t *testing.T) {
		master := []string{
			"server/channels/db/migrations/postgres/000001_a.up.sql",
			"server/channels/db/migrations/mysql/000001_a.up.sql",
		}
		branch := []string{
			"server/channels/db/migrations/postgres/000001_a_renamed.up.sql",
			"server/channels/db/migrations/mysql/000001_a.up.sql",
		}

		violations := compareMigrations(master, branch)
		require.Len(t, violations, 1)
		require.Equal(t, "postgres", violations[0].driver)
	})

	t.Run("violations are sorted deterministically by driver", func(t *testing.T) {
		master := []string{
			"server/channels/db/migrations/postgres/000001_a.up.sql",
			"server/channels/db/migrations/mysql/000001_a.up.sql",
		}
		branch := []string{
			"server/channels/db/migrations/postgres/000001_a_renamed.up.sql",
			"server/channels/db/migrations/mysql/000001_a_renamed.up.sql",
		}

		violations := compareMigrations(master, branch)
		require.Len(t, violations, 2)
		require.Equal(t, "mysql", violations[0].driver)
		require.Equal(t, "postgres", violations[1].driver)
	})
}
