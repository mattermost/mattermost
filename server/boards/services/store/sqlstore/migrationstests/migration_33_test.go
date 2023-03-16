// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"testing"

	"github.com/mgdelacroix/foundation"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/server/boards/services/store/sqlstore"
)

func Test33RemoveDeletedCategoryBoards(t *testing.T) {
	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("base case - no data in table", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()
			th.f.MigrateToStep(33)
		})
	})

	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("existing data - 2 soft deleted records", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()

			th.f.MigrateToStep(32).
				ExecFile("./fixtures/test33_with_deleted_data.sql")

			// cound total records
			var count int
			err := th.f.DB().Get(&count, "SELECT COUNT(*) FROM focalboard_category_boards")
			require.NoError(t, err)
			require.Equal(t, 5, count)

			// now we run the migration
			th.f.MigrateToStep(33)

			// and verify record count again.
			// The soft deleted records should have been removed from the DB now
			err = th.f.DB().Get(&count, "SELECT COUNT(*) FROM focalboard_category_boards")
			require.NoError(t, err)
			require.Equal(t, 3, count)
		})
	})

	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("existing data - no soft deleted records", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()

			th.f.MigrateToStep(32).
				ExecFile("./fixtures/test33_with_no_deleted_data.sql")

			// cound total records
			var count int
			err := th.f.DB().Get(&count, "SELECT COUNT(*) FROM focalboard_category_boards")
			require.NoError(t, err)
			require.Equal(t, 5, count)

			// now we run the migration
			th.f.MigrateToStep(33)

			// and verify record count again.
			// Since there were no soft-deleted records, nothing should have been
			// deleted from the database.
			err = th.f.DB().Get(&count, "SELECT COUNT(*) FROM focalboard_category_boards")
			require.NoError(t, err)
			require.Equal(t, 5, count)

		})
	})
}
