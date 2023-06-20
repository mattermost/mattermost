// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/utils"

	"github.com/stretchr/testify/require"
)

func TestGetBlocks(t *testing.T) {
	th := SetupTestHelperWithToken(t).Start()
	defer th.TearDown()

	board := th.CreateBoard("team-id", model.BoardTypeOpen)

	initialID1 := utils.NewID(utils.IDTypeBlock)
	initialID2 := utils.NewID(utils.IDTypeBlock)
	newBlocks := []*model.Block{
		{
			ID:       initialID1,
			BoardID:  board.ID,
			CreateAt: 1,
			UpdateAt: 1,
			Type:     model.TypeCard,
		},
		{
			ID:       initialID2,
			BoardID:  board.ID,
			CreateAt: 1,
			UpdateAt: 1,
			Type:     model.TypeCard,
		},
	}
	newBlocks, resp := th.Client.InsertBlocks(board.ID, newBlocks, false)
	require.NoError(t, resp.Error)
	require.Len(t, newBlocks, 2)
	blockID1 := newBlocks[0].ID
	blockID2 := newBlocks[1].ID

	blocks, resp := th.Client.GetBlocksForBoard(board.ID)
	require.NoError(t, resp.Error)
	require.Len(t, blocks, 2)

	blockIDs := make([]string, len(blocks))
	for i, b := range blocks {
		blockIDs[i] = b.ID
	}
	require.Contains(t, blockIDs, blockID1)
	require.Contains(t, blockIDs, blockID2)
}

func TestPostBlock(t *testing.T) {
	th := SetupTestHelperWithToken(t).Start()
	defer th.TearDown()

	board := th.CreateBoard("team-id", model.BoardTypeOpen)

	var blockID1 string
	var blockID2 string
	var blockID3 string

	t.Run("Create a single block", func(t *testing.T) {
		initialID1 := utils.NewID(utils.IDTypeBlock)
		block := &model.Block{
			ID:       initialID1,
			BoardID:  board.ID,
			CreateAt: 1,
			UpdateAt: 1,
			Type:     model.TypeCard,
			Title:    "New title",
		}

		newBlocks, resp := th.Client.InsertBlocks(board.ID, []*model.Block{block}, false)
		require.NoError(t, resp.Error)
		require.Len(t, newBlocks, 1)
		blockID1 = newBlocks[0].ID

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, 1)

		blockIDs := make([]string, len(blocks))
		for i, b := range blocks {
			blockIDs[i] = b.ID
		}
		require.Contains(t, blockIDs, blockID1)
	})

	t.Run("Create a couple of blocks in the same call", func(t *testing.T) {
		initialID2 := utils.NewID(utils.IDTypeBlock)
		initialID3 := utils.NewID(utils.IDTypeBlock)
		newBlocks := []*model.Block{
			{
				ID:       initialID2,
				BoardID:  board.ID,
				CreateAt: 1,
				UpdateAt: 1,
				Type:     model.TypeCard,
			},
			{
				ID:       initialID3,
				BoardID:  board.ID,
				CreateAt: 1,
				UpdateAt: 1,
				Type:     model.TypeCard,
			},
		}

		newBlocks, resp := th.Client.InsertBlocks(board.ID, newBlocks, false)
		require.NoError(t, resp.Error)
		require.Len(t, newBlocks, 2)
		blockID2 = newBlocks[0].ID
		blockID3 = newBlocks[1].ID
		require.NotEqual(t, initialID2, blockID2)
		require.NotEqual(t, initialID3, blockID3)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, 3)

		blockIDs := make([]string, len(blocks))
		for i, b := range blocks {
			blockIDs[i] = b.ID
		}
		require.Contains(t, blockIDs, blockID1)
		require.Contains(t, blockIDs, blockID2)
		require.Contains(t, blockIDs, blockID3)
	})

	t.Run("Update a block should not be possible through the insert endpoint", func(t *testing.T) {
		block := &model.Block{
			ID:       blockID1,
			BoardID:  board.ID,
			CreateAt: 1,
			UpdateAt: 20,
			Type:     model.TypeCard,
			Title:    "Updated title",
		}

		newBlocks, resp := th.Client.InsertBlocks(board.ID, []*model.Block{block}, false)
		require.NoError(t, resp.Error)
		require.Len(t, newBlocks, 1)
		blockID4 := newBlocks[0].ID
		require.NotEqual(t, blockID1, blockID4)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, 4)

		var block4 *model.Block
		for _, b := range blocks {
			if b.ID == blockID4 {
				block4 = b
			}
		}
		require.NotNil(t, block4)
		require.Equal(t, "Updated title", block4.Title)
	})
}

func TestPatchBlock(t *testing.T) {
	th := SetupTestHelperWithToken(t).Start()
	defer th.TearDown()

	initialID := utils.NewID(utils.IDTypeBlock)

	board := th.CreateBoard("team-id", model.BoardTypeOpen)
	time.Sleep(10 * time.Millisecond)

	block := &model.Block{
		ID:       initialID,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		Title:    "New title",
		Fields:   map[string]interface{}{"test": "test value", "test2": "test value 2"},
	}

	newBlocks, resp := th.Client.InsertBlocks(board.ID, []*model.Block{block}, false)
	th.CheckOK(resp)
	require.Len(t, newBlocks, 1)
	blockID := newBlocks[0].ID

	t.Run("Patch a block basic field", func(t *testing.T) {
		newTitle := "Updated title"
		blockPatch := &model.BlockPatch{
			Title: &newTitle,
		}

		_, resp := th.Client.PatchBlock(board.ID, blockID, blockPatch, false)
		require.NoError(t, resp.Error)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, 1)

		var updatedBlock *model.Block
		for _, b := range blocks {
			if b.ID == blockID {
				updatedBlock = b
			}
		}
		require.NotNil(t, updatedBlock)
		require.Equal(t, "Updated title", updatedBlock.Title)
	})

	t.Run("Patch a block custom fields", func(t *testing.T) {
		blockPatch := &model.BlockPatch{
			UpdatedFields: map[string]interface{}{
				"test":  "new test value",
				"test3": "new field",
			},
		}

		_, resp := th.Client.PatchBlock(board.ID, blockID, blockPatch, false)
		require.NoError(t, resp.Error)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, 1)

		var updatedBlock *model.Block
		for _, b := range blocks {
			if b.ID == blockID {
				updatedBlock = b
			}
		}
		require.NotNil(t, updatedBlock)
		require.Equal(t, "new test value", updatedBlock.Fields["test"])
		require.Equal(t, "new field", updatedBlock.Fields["test3"])
	})

	t.Run("Patch a block to remove custom fields", func(t *testing.T) {
		blockPatch := &model.BlockPatch{
			DeletedFields: []string{"test", "test3", "test100"},
		}

		_, resp := th.Client.PatchBlock(board.ID, blockID, blockPatch, false)
		require.NoError(t, resp.Error)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, 1)

		var updatedBlock *model.Block
		for _, b := range blocks {
			if b.ID == blockID {
				updatedBlock = b
			}
		}
		require.NotNil(t, updatedBlock)
		require.Equal(t, nil, updatedBlock.Fields["test"])
		require.Equal(t, "test value 2", updatedBlock.Fields["test2"])
		require.Equal(t, nil, updatedBlock.Fields["test3"])
	})
}

func TestDeleteBlock(t *testing.T) {
	th := SetupTestHelperWithToken(t).Start()
	defer th.TearDown()

	board := th.CreateBoard("team-id", model.BoardTypeOpen)
	time.Sleep(10 * time.Millisecond)

	var blockID string
	t.Run("Create a block", func(t *testing.T) {
		initialID := utils.NewID(utils.IDTypeBlock)
		block := &model.Block{
			ID:       initialID,
			BoardID:  board.ID,
			CreateAt: 1,
			UpdateAt: 1,
			Type:     model.TypeCard,
			Title:    "New title",
		}

		newBlocks, resp := th.Client.InsertBlocks(board.ID, []*model.Block{block}, false)
		require.NoError(t, resp.Error)
		require.Len(t, newBlocks, 1)
		require.NotZero(t, newBlocks[0].ID)
		require.NotEqual(t, initialID, newBlocks[0].ID)
		blockID = newBlocks[0].ID

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, 1)

		blockIDs := make([]string, len(blocks))
		for i, b := range blocks {
			blockIDs[i] = b.ID
		}
		require.Contains(t, blockIDs, blockID)
	})

	t.Run("Delete a block", func(t *testing.T) {
		// this avoids triggering uniqueness constraint of
		// id,insert_at on block history
		time.Sleep(10 * time.Millisecond)

		_, resp := th.Client.DeleteBlock(board.ID, blockID, false)
		require.NoError(t, resp.Error)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Empty(t, blocks)
	})
}

func TestUndeleteBlock(t *testing.T) {
	th := SetupTestHelper(t).InitBasic()
	defer th.TearDown()

	board := th.CreateBoard("team-id", model.BoardTypeOpen)

	blocks, resp := th.Client.GetBlocksForBoard(board.ID)
	require.NoError(t, resp.Error)
	initialCount := len(blocks)

	var blockID string
	t.Run("Create a block", func(t *testing.T) {
		initialID := utils.NewID(utils.IDTypeBoard)
		block := &model.Block{
			ID:       initialID,
			BoardID:  board.ID,
			CreateAt: 1,
			UpdateAt: 1,
			Type:     model.TypeBoard,
			Title:    "New title",
		}

		newBlocks, resp := th.Client.InsertBlocks(board.ID, []*model.Block{block}, false)
		require.NoError(t, resp.Error)
		require.Len(t, newBlocks, 1)
		require.NotZero(t, newBlocks[0].ID)
		require.NotEqual(t, initialID, newBlocks[0].ID)
		blockID = newBlocks[0].ID

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, initialCount+1)

		blockIDs := make([]string, len(blocks))
		for i, b := range blocks {
			blockIDs[i] = b.ID
		}
		require.Contains(t, blockIDs, blockID)
	})

	t.Run("Delete a block", func(t *testing.T) {
		// this avoids triggering uniqueness constraint of
		// id,insert_at on block history
		time.Sleep(10 * time.Millisecond)

		_, resp := th.Client.DeleteBlock(board.ID, blockID, false)
		require.NoError(t, resp.Error)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, initialCount)
	})

	t.Run("Undelete a block", func(t *testing.T) {
		// this avoids triggering uniqueness constraint of
		// id,insert_at on block history
		time.Sleep(10 * time.Millisecond)

		_, resp := th.Client.UndeleteBlock(board.ID, blockID)
		require.NoError(t, resp.Error)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, initialCount+1)
	})

	t.Run("Try to undelete a block without permissions", func(t *testing.T) {
		// this avoids triggering uniqueness constraint of
		// id,insert_at on block history
		time.Sleep(10 * time.Millisecond)

		_, resp := th.Client.DeleteBlock(board.ID, blockID, false)
		require.NoError(t, resp.Error)

		_, resp = th.Client2.UndeleteBlock(board.ID, blockID)
		th.CheckForbidden(resp)

		blocks, resp := th.Client.GetBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, blocks, initialCount)
	})
}
