// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

func TestSidebar(t *testing.T) {
	th := SetupTestHelperWithToken(t).Start()
	defer th.TearDown()

	// we'll create a new board.
	// The board should end up in a default "Boards" category
	board := th.CreateBoard("team-id", "O")

	categoryBoards := th.GetUserCategoryBoards("team-id")
	require.Equal(t, 1, len(categoryBoards))
	require.Equal(t, "Boards", categoryBoards[0].Name)
	require.Equal(t, 1, len(categoryBoards[0].BoardMetadata))
	require.Equal(t, board.ID, categoryBoards[0].BoardMetadata[0].BoardID)

	// create a new category, a new board
	// and move that board into the new category
	board2 := th.CreateBoard("team-id", "O")
	category := th.CreateCategory(model.Category{
		Name:   "Category 2",
		TeamID: "team-id",
		UserID: "single-user",
	})
	th.UpdateCategoryBoard("team-id", category.ID, board2.ID)

	categoryBoards = th.GetUserCategoryBoards("team-id")
	// now there should be two categories - boards and the one
	// we created just now
	require.Equal(t, 2, len(categoryBoards))

	// the newly created category should be the first one array
	// as new categories end up on top in LHS
	require.Equal(t, "Category 2", categoryBoards[0].Name)
	require.Equal(t, 1, len(categoryBoards[0].BoardMetadata))
	require.Equal(t, board2.ID, categoryBoards[0].BoardMetadata[0].BoardID)

	// now we'll delete the custom category we created, "Category 2"
	// and all it's boards should get moved to the Boards category
	th.DeleteCategory("team-id", category.ID)
	categoryBoards = th.GetUserCategoryBoards("team-id")
	require.Equal(t, 1, len(categoryBoards))
	require.Equal(t, "Boards", categoryBoards[0].Name)
	require.Equal(t, 2, len(categoryBoards[0].BoardMetadata))
	require.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: board.ID, Hidden: false})
	require.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: board2.ID, Hidden: false})
}

func TestHideUnhideBoard(t *testing.T) {
	th := SetupTestHelperWithToken(t).Start()
	defer th.TearDown()

	// we'll create a new board.
	// The board should end up in a default "Boards" category
	th.CreateBoard("team-id", "O")

	// the created board should not be hidden
	categoryBoards := th.GetUserCategoryBoards("team-id")
	require.Equal(t, 1, len(categoryBoards))
	require.Equal(t, "Boards", categoryBoards[0].Name)
	require.Equal(t, 1, len(categoryBoards[0].BoardMetadata))
	require.False(t, categoryBoards[0].BoardMetadata[0].Hidden)

	// now we'll hide the board
	response := th.Client.HideBoard("team-id", categoryBoards[0].ID, categoryBoards[0].BoardMetadata[0].BoardID)
	th.CheckOK(response)

	// verifying if the board has been marked as hidden
	categoryBoards = th.GetUserCategoryBoards("team-id")
	require.True(t, categoryBoards[0].BoardMetadata[0].Hidden)

	// trying to hide the already hidden board.This should have no effect
	response = th.Client.HideBoard("team-id", categoryBoards[0].ID, categoryBoards[0].BoardMetadata[0].BoardID)
	th.CheckOK(response)
	categoryBoards = th.GetUserCategoryBoards("team-id")
	require.True(t, categoryBoards[0].BoardMetadata[0].Hidden)

	// now we'll unhide the board
	response = th.Client.UnhideBoard("team-id", categoryBoards[0].ID, categoryBoards[0].BoardMetadata[0].BoardID)
	th.CheckOK(response)

	// verifying
	categoryBoards = th.GetUserCategoryBoards("team-id")
	require.False(t, categoryBoards[0].BoardMetadata[0].Hidden)

	// trying to unhide the already visible board.This should have no effect
	response = th.Client.UnhideBoard("team-id", categoryBoards[0].ID, categoryBoards[0].BoardMetadata[0].BoardID)
	th.CheckOK(response)
	categoryBoards = th.GetUserCategoryBoards("team-id")
	require.False(t, categoryBoards[0].BoardMetadata[0].Hidden)
}
