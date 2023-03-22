// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/server/boards/services/store/sqlstore"
	"github.com/mgdelacroix/foundation"
)

func Test35AddHiddenColumnToCategoryBoards(t *testing.T) {
	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("base case - column doesn't already exist", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()
			th.f.MigrateToStep(35)
		})
	})

	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("column already exist", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()

			th.f.MigrateToStep(34).
				ExecFile("./fixtures/test35_add_hidden_column.sql")

			th.f.MigrateToStep(35)
		})
	})
}
