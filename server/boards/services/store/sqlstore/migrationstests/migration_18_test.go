// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/store/sqlstore"
	"github.com/mgdelacroix/foundation"
	"github.com/stretchr/testify/require"
)

func Test18AddTeamsAndBoardsSQLMigration(t *testing.T) {
	sqlstore.RunStoreTestsWithFoundation(t, func(t *testing.T, f *foundation.Foundation) {
		t.Run("should migrate a block of type board to the boards table", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t, f)
			defer tearDown()

			th.f.MigrateToStep(17).
				ExecFile("./fixtures/test18AddTeamsAndBoardsSQLMigrationFixtures.sql")

			board := struct {
				ID               string
				Title            string
				Type             string
				Fields           string
				Description      string
				Show_Description bool
				Is_Template      bool
				Template_Version int
			}{}

			// we check first that the board is inside the blocks table as
			// a block of board type and columnCalculations exists if Fields
			err := th.f.DB().Get(&board, "SELECT id, title, type, fields FROM focalboard_blocks WHERE id = 'board-id'")
			require.NoError(t, err)
			require.Equal(t, "My Board", board.Title)
			require.Equal(t, "board", board.Type)
			require.Contains(t, board.Fields, "columnCalculations")

			// we check another board is inside the blocks table as
			// a block of board type and has several different properties in boards
			err = th.f.DB().Get(&board, "SELECT id, title, type, fields FROM focalboard_blocks WHERE id = 'board-id2'")
			require.NoError(t, err)
			require.Equal(t, "My Board Two", board.Title)
			require.Equal(t, "board", board.Type)
			require.Contains(t, board.Fields, "description")
			require.Contains(t, board.Fields, "showDescription")
			require.Contains(t, board.Fields, "isTemplate")
			require.Contains(t, board.Fields, "templateVer")

			// then we run the migration
			th.f.MigrateToStep(18)

			// we assert that the board is now in the boards table
			bErr := th.f.DB().Get(&board, "SELECT id, title, type FROM focalboard_boards WHERE id = 'board-id'")
			require.NoError(t, bErr)
			require.Equal(t, "My Board", board.Title)
			require.Equal(t, "O", board.Type)

			card := struct {
				Title     string
				Type      string
				Parent_ID string
				Board_ID  string
			}{}

			// we fetch the card to ensure that the card is still in the blocks table
			cErr := th.f.DB().Get(&card, "SELECT title, type, parent_id, board_id FROM focalboard_blocks WHERE id = 'card-id'")
			require.NoError(t, cErr)
			require.Equal(t, "A card", card.Title)
			require.Equal(t, "card", card.Type)
			require.Equal(t, board.ID, card.Parent_ID)
			require.Equal(t, board.ID, card.Board_ID)

			// we assert that the board is now a board and properties from JSON Fields
			dErr := th.f.DB().Get(&board, "SELECT id, title, type, description, show_description, is_template, template_version FROM focalboard_boards WHERE id = 'board-id2'")
			require.NoError(t, dErr)
			require.Equal(t, "My Board Two", board.Title)
			require.Equal(t, "O", board.Type)
			require.Equal(t, "My Description", board.Description)
			require.Equal(t, true, board.Show_Description)
			require.Equal(t, true, board.Is_Template)
			require.Equal(t, 1, board.Template_Version)

			view := struct {
				Title     string
				Type      string
				Parent_ID string
				Board_ID  string
				Fields    string
			}{}

			// we fetch the views to ensure that the calculation columns exist on views
			eErr := th.f.DB().Get(&view, "SELECT title, type, parent_id, board_id, fields FROM focalboard_blocks WHERE id = 'view-id'")
			require.NoError(t, eErr)
			require.Contains(t, view.Fields, "columnCalculations")
			var fields map[string]interface{}

			// Make sure a valid JSON object
			json.Unmarshal([]byte(view.Fields), &fields)
			require.NotNil(t, fields["columnCalculations"])
			require.NotEmpty(t, fields["columnCalculations"])

			// Board View should not have columnCalculations
			fErr := th.f.DB().Get(&view, "SELECT title, type, parent_id, board_id, fields FROM focalboard_blocks WHERE id = 'view-id2'")
			require.NoError(t, fErr)
			require.NotContains(t, view.Fields, "columnCalculations")
		})
	})
}
