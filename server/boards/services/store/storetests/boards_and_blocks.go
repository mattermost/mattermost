// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/store"
	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/stretchr/testify/require"
)

func StoreTestBoardsAndBlocksStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("createBoardsAndBlocks", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testCreateBoardsAndBlocks(t, store)
	})
	t.Run("patchBoardsAndBlocks", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testPatchBoardsAndBlocks(t, store)
	})
	t.Run("deleteBoardsAndBlocks", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testDeleteBoardsAndBlocks(t, store)
	})

	t.Run("duplicateBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testDuplicateBoard(t, store)
	})
}

func testCreateBoardsAndBlocks(t *testing.T, store store.Store) {
	teamID := testTeamID
	userID := testUserID

	boards, err := store.GetBoardsForUserAndTeam(userID, teamID, true)
	require.NoError(t, err)
	require.Empty(t, boards)

	t.Run("create boards and blocks", func(t *testing.T) {
		newBab := &model.BoardsAndBlocks{
			Boards: []*model.Board{
				{ID: "board-id-1", TeamID: teamID, Type: model.BoardTypeOpen},
				{ID: "board-id-2", TeamID: teamID, Type: model.BoardTypePrivate},
				{ID: "board-id-3", TeamID: teamID, Type: model.BoardTypeOpen},
			},
			Blocks: []*model.Block{
				{ID: "block-id-1", BoardID: "board-id-1", Type: model.TypeCard},
				{ID: "block-id-2", BoardID: "board-id-2", Type: model.TypeCard},
			},
		}

		bab, err := store.CreateBoardsAndBlocks(newBab, userID)
		require.NoError(t, err)
		require.NotNil(t, bab)
		require.Len(t, bab.Boards, 3)
		require.Len(t, bab.Blocks, 2)

		boardIDs := []string{}
		for _, board := range bab.Boards {
			boardIDs = append(boardIDs, board.ID)
		}

		blockIDs := []string{}
		for _, block := range bab.Blocks {
			blockIDs = append(blockIDs, block.ID)
		}

		require.ElementsMatch(t, []string{"board-id-1", "board-id-2", "board-id-3"}, boardIDs)
		require.ElementsMatch(t, []string{"block-id-1", "block-id-2"}, blockIDs)
	})

	t.Run("create boards and blocks with admin", func(t *testing.T) {
		newBab := &model.BoardsAndBlocks{
			Boards: []*model.Board{
				{ID: "board-id-4", TeamID: teamID, Type: model.BoardTypeOpen},
				{ID: "board-id-5", TeamID: teamID, Type: model.BoardTypePrivate},
				{ID: "board-id-6", TeamID: teamID, Type: model.BoardTypeOpen},
			},
			Blocks: []*model.Block{
				{ID: "block-id-3", BoardID: "board-id-4", Type: model.TypeCard},
				{ID: "block-id-4", BoardID: "board-id-5", Type: model.TypeCard},
			},
		}

		bab, members, err := store.CreateBoardsAndBlocksWithAdmin(newBab, userID)
		require.NoError(t, err)
		require.NotNil(t, bab)
		require.Len(t, bab.Boards, 3)
		require.Len(t, bab.Blocks, 2)
		require.Len(t, members, 3)

		boardIDs := []string{}
		for _, board := range bab.Boards {
			boardIDs = append(boardIDs, board.ID)
		}

		blockIDs := []string{}
		for _, block := range bab.Blocks {
			blockIDs = append(blockIDs, block.ID)
		}

		require.ElementsMatch(t, []string{"board-id-4", "board-id-5", "board-id-6"}, boardIDs)
		require.ElementsMatch(t, []string{"block-id-3", "block-id-4"}, blockIDs)

		memberBoardIDs := []string{}
		for _, member := range members {
			require.Equal(t, userID, member.UserID)
			memberBoardIDs = append(memberBoardIDs, member.BoardID)
		}
		require.ElementsMatch(t, []string{"board-id-4", "board-id-5", "board-id-6"}, memberBoardIDs)
	})

	t.Run("on failure, nothing should be saved", func(t *testing.T) {
		// one of the blocks is invalid as it doesn't have BoardID
		newBab := &model.BoardsAndBlocks{
			Boards: []*model.Board{
				{ID: "board-id-7", TeamID: teamID, Type: model.BoardTypeOpen},
				{ID: "board-id-8", TeamID: teamID, Type: model.BoardTypePrivate},
				{ID: "board-id-9", TeamID: teamID, Type: model.BoardTypeOpen},
			},
			Blocks: []*model.Block{
				{ID: "block-id-5", BoardID: "board-id-7", Type: model.TypeCard},
				{ID: "block-id-6", BoardID: "", Type: model.TypeCard},
			},
		}

		bab, err := store.CreateBoardsAndBlocks(newBab, userID)
		require.Error(t, err)
		require.Nil(t, bab)

		bab, members, err := store.CreateBoardsAndBlocksWithAdmin(newBab, userID)
		require.Error(t, err)
		require.Empty(t, bab)
		require.Empty(t, members)
	})
}

func testPatchBoardsAndBlocks(t *testing.T, store store.Store) {
	teamID := testTeamID
	userID := testUserID

	t.Run("on failure, nothing should be saved", func(t *testing.T) {
		initialTitle := "initial title"
		newTitle := "new title"

		board := &model.Board{
			ID:     "board-id-1",
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		_, err := store.InsertBoard(board, userID)
		require.NoError(t, err)

		block := &model.Block{
			ID:      "block-id-1",
			BoardID: "board-id-1",
			Title:   initialTitle,
		}
		require.NoError(t, store.InsertBlock(block, userID))

		// apply the patches
		pbab := &model.PatchBoardsAndBlocks{
			BoardIDs: []string{"board-id-1"},
			BoardPatches: []*model.BoardPatch{
				{Title: &newTitle},
			},
			BlockIDs: []string{"block-id-1", "block-id-2"},
			BlockPatches: []*model.BlockPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
		}

		time.Sleep(10 * time.Millisecond)

		bab, err := store.PatchBoardsAndBlocks(pbab, userID)
		require.Error(t, err)
		require.Nil(t, bab)

		// check that things have changed
		rBoard, err := store.GetBoard("board-id-1")
		require.NoError(t, err)
		require.Equal(t, initialTitle, rBoard.Title)

		rBlock, err := store.GetBlock("block-id-1")
		require.NoError(t, err)
		require.Equal(t, initialTitle, rBlock.Title)
	})

	t.Run("patch boards and blocks", func(t *testing.T) {
		newBab := &model.BoardsAndBlocks{
			Boards: []*model.Board{
				{ID: "board-id-1", Description: "initial description", TeamID: teamID, Type: model.BoardTypeOpen},
				{ID: "board-id-2", TeamID: teamID, Type: model.BoardTypePrivate},
				{ID: "board-id-3", Title: "initial title", TeamID: teamID, Type: model.BoardTypeOpen},
			},
			Blocks: []*model.Block{
				{ID: "block-id-1", Title: "initial title", BoardID: "board-id-1", Type: model.TypeCard},
				{ID: "block-id-2", Schema: 1, BoardID: "board-id-2", Type: model.TypeCard},
			},
		}

		rBab, err := store.CreateBoardsAndBlocks(newBab, userID)
		require.NoError(t, err)
		require.NotNil(t, rBab)
		require.Len(t, rBab.Boards, 3)
		require.Len(t, rBab.Blocks, 2)

		// apply the patches
		newTitle := "new title"
		newDescription := "new description"
		var newSchema int64 = 2

		pbab := &model.PatchBoardsAndBlocks{
			BoardIDs: []string{"board-id-3", "board-id-1"},
			BoardPatches: []*model.BoardPatch{
				{Title: &newTitle, Description: &newDescription},
				{Description: &newDescription},
			},
			BlockIDs: []string{"block-id-1", "block-id-2"},
			BlockPatches: []*model.BlockPatch{
				{Title: &newTitle},
				{Schema: &newSchema},
			},
		}

		time.Sleep(10 * time.Millisecond)

		bab, err := store.PatchBoardsAndBlocks(pbab, userID)
		require.NoError(t, err)
		require.NotNil(t, bab)
		require.Len(t, bab.Boards, 2)
		require.Len(t, bab.Blocks, 2)

		// check that things have changed
		board1, err := store.GetBoard("board-id-1")
		require.NoError(t, err)
		require.Equal(t, newDescription, board1.Description)

		board3, err := store.GetBoard("board-id-3")
		require.NoError(t, err)
		require.Equal(t, newTitle, board3.Title)
		require.Equal(t, newDescription, board3.Description)

		block1, err := store.GetBlock("block-id-1")
		require.NoError(t, err)
		require.Equal(t, newTitle, block1.Title)

		block2, err := store.GetBlock("block-id-2")
		require.NoError(t, err)
		require.Equal(t, newSchema, block2.Schema)
	})
}

func testDeleteBoardsAndBlocks(t *testing.T, store store.Store) {
	teamID := testTeamID
	userID := testUserID

	t.Run("should not delete anything if a block doesn't belong to any of the boards", func(t *testing.T) {
		newBoard1 := &model.Board{
			ID:     utils.NewID(utils.IDTypeBoard),
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := store.InsertBoard(newBoard1, userID)
		require.NoError(t, err)

		block1 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board1.ID,
		}
		require.NoError(t, store.InsertBlock(block1, userID))

		block2 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board1.ID,
		}
		require.NoError(t, store.InsertBlock(block2, userID))

		newBoard2 := &model.Board{
			ID:     utils.NewID(utils.IDTypeBoard),
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := store.InsertBoard(newBoard2, userID)
		require.NoError(t, err)

		block3 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board2.ID,
		}
		require.NoError(t, store.InsertBlock(block3, userID))

		block4 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: "different-board-id",
		}
		require.NoError(t, store.InsertBlock(block4, userID))

		dbab := &model.DeleteBoardsAndBlocks{
			Boards: []string{board1.ID, board2.ID},
			Blocks: []string{block1.ID, block2.ID, block3.ID, block4.ID},
		}

		time.Sleep(10 * time.Millisecond)

		expectedErrorMsg := fmt.Sprintf("block %s doesn't belong to any of the boards in the delete request", block4.ID)
		require.EqualError(t, store.DeleteBoardsAndBlocks(dbab, userID), expectedErrorMsg)

		// all the entities should still exist
		rBoard1, err := store.GetBoard(board1.ID)
		require.NoError(t, err)
		require.NotNil(t, rBoard1)
		rBlock1, err := store.GetBlock(block1.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock1)
		rBlock2, err := store.GetBlock(block2.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock2)

		rBoard2, err := store.GetBoard(board2.ID)
		require.NoError(t, err)
		require.NotNil(t, rBoard2)
		rBlock3, err := store.GetBlock(block3.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock3)
		rBlock4, err := store.GetBlock(block4.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock4)
	})

	t.Run("should not delete anything if a board doesn't exist", func(t *testing.T) {
		newBoard1 := &model.Board{
			ID:     utils.NewID(utils.IDTypeBoard),
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := store.InsertBoard(newBoard1, userID)
		require.NoError(t, err)

		block1 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board1.ID,
		}
		require.NoError(t, store.InsertBlock(block1, userID))

		block2 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board1.ID,
		}
		require.NoError(t, store.InsertBlock(block2, userID))

		newBoard2 := &model.Board{
			ID:     utils.NewID(utils.IDTypeBoard),
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := store.InsertBoard(newBoard2, userID)
		require.NoError(t, err)

		block3 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board2.ID,
		}
		require.NoError(t, store.InsertBlock(block3, userID))

		block4 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board2.ID,
		}
		require.NoError(t, store.InsertBlock(block4, userID))

		dbab := &model.DeleteBoardsAndBlocks{
			Boards: []string{board1.ID, board2.ID, "a nonexistent board ID"},
			Blocks: []string{block1.ID, block2.ID, block3.ID, block4.ID},
		}

		time.Sleep(10 * time.Millisecond)

		require.True(t, model.IsErrNotFound(store.DeleteBoardsAndBlocks(dbab, userID)))

		// all the entities should still exist
		rBoard1, err := store.GetBoard(board1.ID)
		require.NoError(t, err)
		require.NotNil(t, rBoard1)
		rBlock1, err := store.GetBlock(block1.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock1)
		rBlock2, err := store.GetBlock(block2.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock2)

		rBoard2, err := store.GetBoard(board2.ID)
		require.NoError(t, err)
		require.NotNil(t, rBoard2)
		rBlock3, err := store.GetBlock(block3.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock3)
		rBlock4, err := store.GetBlock(block4.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock4)
	})

	t.Run("should not delete anything if a block doesn't exist", func(t *testing.T) {
		newBoard1 := &model.Board{
			ID:     utils.NewID(utils.IDTypeBoard),
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := store.InsertBoard(newBoard1, userID)
		require.NoError(t, err)

		block1 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board1.ID,
		}
		require.NoError(t, store.InsertBlock(block1, userID))

		block2 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board1.ID,
		}
		require.NoError(t, store.InsertBlock(block2, userID))

		newBoard2 := &model.Board{
			ID:     utils.NewID(utils.IDTypeBoard),
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := store.InsertBoard(newBoard2, userID)
		require.NoError(t, err)

		block3 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board2.ID,
		}
		require.NoError(t, store.InsertBlock(block3, userID))

		block4 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board2.ID,
		}
		require.NoError(t, store.InsertBlock(block4, userID))

		dbab := &model.DeleteBoardsAndBlocks{
			Boards: []string{board1.ID, board2.ID},
			Blocks: []string{block1.ID, block2.ID, block3.ID, block4.ID, "a nonexistent block ID"},
		}

		time.Sleep(10 * time.Millisecond)

		require.True(t, model.IsErrNotFound(store.DeleteBoardsAndBlocks(dbab, userID)))

		// all the entities should still exist
		rBoard1, err := store.GetBoard(board1.ID)
		require.NoError(t, err)
		require.NotNil(t, rBoard1)
		rBlock1, err := store.GetBlock(block1.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock1)
		rBlock2, err := store.GetBlock(block2.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock2)

		rBoard2, err := store.GetBoard(board2.ID)
		require.NoError(t, err)
		require.NotNil(t, rBoard2)
		rBlock3, err := store.GetBlock(block3.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock3)
		rBlock4, err := store.GetBlock(block4.ID)
		require.NoError(t, err)
		require.NotNil(t, rBlock4)
	})

	t.Run("should work properly if all the entities are related", func(t *testing.T) {
		newBoard1 := &model.Board{
			ID:     utils.NewID(utils.IDTypeBoard),
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := store.InsertBoard(newBoard1, userID)
		require.NoError(t, err)

		block1 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board1.ID,
		}
		require.NoError(t, store.InsertBlock(block1, userID))

		block2 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board1.ID,
		}
		require.NoError(t, store.InsertBlock(block2, userID))

		newBoard2 := &model.Board{
			ID:     utils.NewID(utils.IDTypeBoard),
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := store.InsertBoard(newBoard2, userID)
		require.NoError(t, err)

		block3 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board2.ID,
		}
		require.NoError(t, store.InsertBlock(block3, userID))

		block4 := &model.Block{
			ID:      utils.NewID(utils.IDTypeBlock),
			BoardID: board2.ID,
		}
		require.NoError(t, store.InsertBlock(block4, userID))

		dbab := &model.DeleteBoardsAndBlocks{
			Boards: []string{board1.ID, board2.ID},
			Blocks: []string{block1.ID, block2.ID, block3.ID, block4.ID},
		}

		time.Sleep(10 * time.Millisecond)

		require.NoError(t, store.DeleteBoardsAndBlocks(dbab, userID))

		rBoard1, err := store.GetBoard(board1.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, rBoard1)
		rBlock1, err := store.GetBlock(block1.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, rBlock1)
		rBlock2, err := store.GetBlock(block2.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, rBlock2)

		rBoard2, err := store.GetBoard(board2.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, rBoard2)
		rBlock3, err := store.GetBlock(block3.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, rBlock3)
		rBlock4, err := store.GetBlock(block4.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, rBlock4)
	})
}

func testDuplicateBoard(t *testing.T, store store.Store) {
	teamID := testTeamID
	userID := testUserID

	newBab := &model.BoardsAndBlocks{
		Boards: []*model.Board{
			{ID: "board-id-1", TeamID: teamID, Type: model.BoardTypeOpen, ChannelID: "test-channel"},
			{ID: "board-id-2", TeamID: teamID, Type: model.BoardTypePrivate},
			{ID: "board-id-3", TeamID: teamID, Type: model.BoardTypeOpen},
		},
		Blocks: []*model.Block{
			{ID: "block-id-1", BoardID: "board-id-1", Type: model.TypeCard},
			{ID: "block-id-1a", BoardID: "board-id-1", Type: model.TypeComment},
			{ID: "block-id-2", BoardID: "board-id-2", Type: model.TypeCard},
		},
	}

	bab, err := store.CreateBoardsAndBlocks(newBab, userID)
	require.NoError(t, err)
	require.NotNil(t, bab)
	require.Len(t, bab.Boards, 3)
	require.Len(t, bab.Blocks, 3)

	t.Run("duplicate existing board as no template", func(t *testing.T) {
		bab, members, err := store.DuplicateBoard("board-id-1", userID, teamID, false)
		require.NoError(t, err)
		require.Len(t, members, 1)
		require.Len(t, bab.Boards, 1)
		require.Len(t, bab.Blocks, 1)
		require.Equal(t, bab.Boards[0].IsTemplate, false)
		require.Equal(t, "", bab.Boards[0].ChannelID)
	})

	t.Run("duplicate existing board as template", func(t *testing.T) {
		bab, members, err := store.DuplicateBoard("board-id-1", userID, teamID, true)
		require.NoError(t, err)
		require.Len(t, members, 1)
		require.Len(t, bab.Boards, 1)
		require.Len(t, bab.Blocks, 1)
		require.Equal(t, bab.Boards[0].IsTemplate, true)
		require.Equal(t, "", bab.Boards[0].ChannelID)
	})

	t.Run("duplicate not existing board", func(t *testing.T) {
		bab, members, err := store.DuplicateBoard("not-existing-id", userID, teamID, false)
		require.Error(t, err)
		require.Nil(t, members)
		require.Nil(t, bab)
	})
}
