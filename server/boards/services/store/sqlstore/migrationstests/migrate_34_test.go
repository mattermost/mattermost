// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/server/boards/services/store/sqlstore"
	"github.com/mgdelacroix/foundation"
	"github.com/stretchr/testify/require"
)

func Test34DropDeleteAtColumnMySQLPostgres(t *testing.T) {
	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("column exists", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()

			th.f.MigrateToStep(34)

			// migration 34 only works for MySQL and PostgreSQL
			if th.IsMySQL() {
				var count int
				query := "SELECT COUNT(column_name) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'focalboard_category_boards' AND column_name = 'delete_at'"
				th.f.DB().Get(&count, query)
				require.Equal(t, 0, count)
			} else if th.IsPostgres() {
				var count int
				query := "select count(*) from information_schema.columns where table_name = 'focalboard_category_boards' and column_name = 'delete_at'"
				th.f.DB().Get(&count, query)
				require.Equal(t, 0, count)
			}
		})
	})

	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("column already deleted", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()

			th.f.MigrateToStep(33).
				ExecFile("./fixtures/test34_drop_delete_at_column.sql")

			th.f.MigrateToStep(34)

			if th.IsMySQL() {
				var count int
				query := "SELECT COUNT(column_name) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'focalboard_category_boards' AND column_name = 'delete_at'"
				th.f.DB().Get(&count, query)
				require.Equal(t, 0, count)
			} else if th.IsPostgres() {
				var count int
				query := "select count(*) from information_schema.columns where table_name = 'focalboard_category_boards' and column_name = 'delete_at'"
				th.f.DB().Get(&count, query)
				require.Equal(t, 0, count)
			}
		})
	})
}
