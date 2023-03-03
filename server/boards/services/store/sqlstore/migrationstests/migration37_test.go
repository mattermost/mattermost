// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func Test37MigrateHiddenBoardIDTest(t *testing.T) {
	t.Run("no existing hidden boards exist", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()
		th.f.MigrateToStep(37)
	})

	t.Run("MySQL and PostgreSQL - existsing category boards with some hidden boards", func(t *testing.T) {
		th, tearDown := SetupPluginTestHelper(t)
		defer tearDown()

		th.f.MigrateToStep(36).
			ExecFile("./fixtures/test37_valid_data.sql")

		th.f.MigrateToStep(37)

		type categoryBoard struct {
			User_ID     string
			Category_ID string
			Board_ID    string
			Hidden      bool
		}

		var hiddenCategoryBoards []categoryBoard

		query := "SELECT user_id, category_id, board_id, hidden FROM focalboard_category_boards WHERE hidden = true"
		err := th.f.DB().Select(&hiddenCategoryBoards, query)
		require.NoError(t, err)
		require.Equal(t, 3, len(hiddenCategoryBoards))
		require.Contains(t, hiddenCategoryBoards, categoryBoard{User_ID: "user-id-1", Category_ID: "category-id-1", Board_ID: "board-id-1", Hidden: true})
		require.Contains(t, hiddenCategoryBoards, categoryBoard{User_ID: "user-id-2", Category_ID: "category-id-3", Board_ID: "board-id-3", Hidden: true})
		require.Contains(t, hiddenCategoryBoards, categoryBoard{User_ID: "user-id-2", Category_ID: "category-id-3", Board_ID: "board-id-4", Hidden: true})
	})

	t.Run("no hidden boards", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.f.MigrateToStep(36).
			ExecFile("./fixtures/test37_valid_data_no_hidden_boards.sql")

		th.f.MigrateToStep(37)

		var count int
		query := "SELECT count(*) FROM focalboard_category_boards WHERE hidden = true"
		err := th.f.DB().Get(&count, query)
		require.NoError(t, err)
		require.Equal(t, 0, count)
	})

	t.Run("MySQL and PostgreSQL - preference but no hidden board", func(t *testing.T) {
		th, tearDown := SetupPluginTestHelper(t)
		defer tearDown()

		th.f.MigrateToStep(36).
			ExecFile("./fixtures/test37_valid_data_preference_but_no_hidden_board.sql")

		th.f.MigrateToStep(37)

		var count int
		query := "SELECT count(*) FROM focalboard_category_boards WHERE hidden = true"
		err := th.f.DB().Get(&count, query)
		require.NoError(t, err)
		require.Equal(t, 0, count)
	})

}
