// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/boards/model"

	"github.com/stretchr/testify/require"
)

func TestCreateBoardsAndBlocks(t *testing.T) {
	teamID := testTeamID

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).Start()
		defer th.TearDown()

		newBab := &model.BoardsAndBlocks{
			Boards: []*model.Board{},
			Blocks: []*model.Block{},
		}

		bab, resp := th.Client.CreateBoardsAndBlocks(newBab)
		th.CheckUnauthorized(resp)
		require.Nil(t, bab)
	})

	t.Run("invalid boards and blocks", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		t.Run("no boards", func(t *testing.T) {
			newBab := &model.BoardsAndBlocks{
				Boards: []*model.Board{},
				Blocks: []*model.Block{
					{ID: "block-id", BoardID: "board-id", Type: model.TypeCard},
				},
			}

			bab, resp := th.Client.CreateBoardsAndBlocks(newBab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("no blocks", func(t *testing.T) {
			newBab := &model.BoardsAndBlocks{
				Boards: []*model.Board{
					{ID: "board-id", TeamID: teamID, Type: model.BoardTypePrivate},
				},
				Blocks: []*model.Block{},
			}

			bab, resp := th.Client.CreateBoardsAndBlocks(newBab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("blocks from nonexistent boards", func(t *testing.T) {
			newBab := &model.BoardsAndBlocks{
				Boards: []*model.Board{
					{ID: "board-id", TeamID: teamID, Type: model.BoardTypePrivate},
				},
				Blocks: []*model.Block{
					{ID: "block-id", BoardID: "nonexistent-board-id", Type: model.TypeCard, CreateAt: 1, UpdateAt: 1},
				},
			}

			bab, resp := th.Client.CreateBoardsAndBlocks(newBab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("boards with no IDs", func(t *testing.T) {
			newBab := &model.BoardsAndBlocks{
				Boards: []*model.Board{
					{ID: "board-id", TeamID: teamID, Type: model.BoardTypePrivate},
					{TeamID: teamID, Type: model.BoardTypePrivate},
				},
				Blocks: []*model.Block{
					{ID: "block-id", BoardID: "board-id", Type: model.TypeCard, CreateAt: 1, UpdateAt: 1},
				},
			}

			bab, resp := th.Client.CreateBoardsAndBlocks(newBab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("boards from different teams", func(t *testing.T) {
			newBab := &model.BoardsAndBlocks{
				Boards: []*model.Board{
					{ID: "board-id-1", TeamID: "team-id-1", Type: model.BoardTypePrivate},
					{ID: "board-id-2", TeamID: "team-id-2", Type: model.BoardTypePrivate},
				},
				Blocks: []*model.Block{
					{ID: "block-id", BoardID: "board-id-1", Type: model.TypeCard, CreateAt: 1, UpdateAt: 1},
				},
			}

			bab, resp := th.Client.CreateBoardsAndBlocks(newBab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("creating boards and blocks", func(t *testing.T) {
			newBab := &model.BoardsAndBlocks{
				Boards: []*model.Board{
					{ID: "board-id-1", Title: "public board", TeamID: teamID, Type: model.BoardTypeOpen},
					{ID: "board-id-2", Title: "private board", TeamID: teamID, Type: model.BoardTypePrivate},
				},
				Blocks: []*model.Block{
					{ID: "block-id-1", Title: "block 1", BoardID: "board-id-1", Type: model.TypeCard, CreateAt: 1, UpdateAt: 1},
					{ID: "block-id-2", Title: "block 2", BoardID: "board-id-2", Type: model.TypeCard, CreateAt: 1, UpdateAt: 1},
				},
			}

			bab, resp := th.Client.CreateBoardsAndBlocks(newBab)
			th.CheckOK(resp)
			require.NotNil(t, bab)

			require.Len(t, bab.Boards, 2)
			require.Len(t, bab.Blocks, 2)

			// board 1 should have been created with a new ID, and its
			// block should be there too
			boardsTermPublic, resp := th.Client.SearchBoardsForTeam(teamID, "public")
			th.CheckOK(resp)
			require.Len(t, boardsTermPublic, 1)
			board1 := boardsTermPublic[0]
			require.Equal(t, "public board", board1.Title)
			require.Equal(t, model.BoardTypeOpen, board1.Type)
			require.NotEqual(t, "board-id-1", board1.ID)
			blocks1, err := th.Server.App().GetBlocks(model.QueryBlocksOptions{BoardID: board1.ID})
			require.NoError(t, err)
			require.Len(t, blocks1, 1)
			require.Equal(t, "block 1", blocks1[0].Title)

			// board 1 should have been created with a new ID, and its
			// block should be there too
			boardsTermPrivate, resp := th.Client.SearchBoardsForTeam(teamID, "private")
			th.CheckOK(resp)
			require.Len(t, boardsTermPrivate, 1)
			board2 := boardsTermPrivate[0]
			require.Equal(t, "private board", board2.Title)
			require.Equal(t, model.BoardTypePrivate, board2.Type)
			require.NotEqual(t, "board-id-2", board2.ID)
			blocks2, err := th.Server.App().GetBlocks(model.QueryBlocksOptions{BoardID: board2.ID})
			require.NoError(t, err)
			require.Len(t, blocks2, 1)
			require.Equal(t, "block 2", blocks2[0].Title)

			// user should be an admin of both newly created boards
			user1 := th.GetUser1()
			members1, err := th.Server.App().GetMembersForBoard(board1.ID)
			require.NoError(t, err)
			require.Len(t, members1, 1)
			require.Equal(t, user1.ID, members1[0].UserID)
			members2, err := th.Server.App().GetMembersForBoard(board2.ID)
			require.NoError(t, err)
			require.Len(t, members2, 1)
			require.Equal(t, user1.ID, members2[0].UserID)
		})
	})
}

func TestPatchBoardsAndBlocks(t *testing.T) {
	teamID := "team-id"

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).Start()
		defer th.TearDown()

		pbab := &model.PatchBoardsAndBlocks{}

		bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
		th.CheckUnauthorized(resp)
		require.Nil(t, bab)
	})

	t.Run("invalid patch boards and blocks", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		userID := th.GetUser1().ID
		initialTitle := "initial title 1"
		newTitle := "new title 1"

		newBoard1 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := th.Server.App().CreateBoard(newBoard1, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board1)

		newBoard2 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := th.Server.App().CreateBoard(newBoard2, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board2)

		newBlock1 := &model.Block{
			ID:      "block-id-1",
			BoardID: board1.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock1, userID))
		block1, err := th.Server.App().GetBlockByID("block-id-1")
		require.NoError(t, err)
		require.NotNil(t, block1)

		newBlock2 := &model.Block{
			ID:      "block-id-2",
			BoardID: board2.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock2, userID))
		block2, err := th.Server.App().GetBlockByID("block-id-2")
		require.NoError(t, err)
		require.NotNil(t, block2)

		t.Run("no board IDs", func(t *testing.T) {
			pbab := &model.PatchBoardsAndBlocks{
				BoardIDs: []string{},
				BoardPatches: []*model.BoardPatch{
					{Title: &newTitle},
					{Title: &newTitle},
				},
				BlockIDs: []string{block1.ID, block2.ID},
				BlockPatches: []*model.BlockPatch{
					{Title: &newTitle},
					{Title: &newTitle},
				},
			}

			bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("missmatch board IDs and patches", func(t *testing.T) {
			pbab := &model.PatchBoardsAndBlocks{
				BoardIDs: []string{board1.ID, board2.ID},
				BoardPatches: []*model.BoardPatch{
					{Title: &newTitle},
				},
				BlockIDs: []string{block1.ID, block2.ID},
				BlockPatches: []*model.BlockPatch{
					{Title: &newTitle},
					{Title: &newTitle},
				},
			}

			bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("no block IDs", func(t *testing.T) {
			pbab := &model.PatchBoardsAndBlocks{
				BoardIDs: []string{board1.ID, board2.ID},
				BoardPatches: []*model.BoardPatch{
					{Title: &newTitle},
					{Title: &newTitle},
				},
				BlockIDs: []string{},
				BlockPatches: []*model.BlockPatch{
					{Title: &newTitle},
					{Title: &newTitle},
				},
			}

			bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("missmatch block IDs and patches", func(t *testing.T) {
			pbab := &model.PatchBoardsAndBlocks{
				BoardIDs: []string{board1.ID, board2.ID},
				BoardPatches: []*model.BoardPatch{
					{Title: &newTitle},
					{Title: &newTitle},
				},
				BlockIDs: []string{block1.ID, block2.ID},
				BlockPatches: []*model.BlockPatch{
					{Title: &newTitle},
				},
			}

			bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})

		t.Run("block that doesn't belong to any board", func(t *testing.T) {
			pbab := &model.PatchBoardsAndBlocks{
				BoardIDs: []string{board1.ID},
				BoardPatches: []*model.BoardPatch{
					{Title: &newTitle},
				},
				BlockIDs: []string{block1.ID, block2.ID},
				BlockPatches: []*model.BlockPatch{
					{Title: &newTitle},
					{Title: &newTitle},
				},
			}

			bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
			th.CheckBadRequest(resp)
			require.Nil(t, bab)
		})
	})

	t.Run("if the user doesn't have permissions for one of the boards, nothing should be updated", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		userID := th.GetUser1().ID
		initialTitle := "initial title 2"
		newTitle := "new title 2"

		newBoard1 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := th.Server.App().CreateBoard(newBoard1, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board1)

		newBoard2 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := th.Server.App().CreateBoard(newBoard2, userID, false)
		require.NoError(t, err)
		require.NotNil(t, board2)

		newBlock1 := &model.Block{
			ID:      "block-id-1",
			BoardID: board1.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock1, userID))
		block1, err := th.Server.App().GetBlockByID("block-id-1")
		require.NoError(t, err)
		require.NotNil(t, block1)

		newBlock2 := &model.Block{
			ID:      "block-id-2",
			BoardID: board2.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock2, userID))
		block2, err := th.Server.App().GetBlockByID("block-id-2")
		require.NoError(t, err)
		require.NotNil(t, block2)

		pbab := &model.PatchBoardsAndBlocks{
			BoardIDs: []string{board1.ID, board2.ID},
			BoardPatches: []*model.BoardPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
			BlockIDs: []string{block1.ID, block2.ID},
			BlockPatches: []*model.BlockPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
		}

		bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
		th.CheckForbidden(resp)
		require.Nil(t, bab)
	})

	t.Run("boards belonging to different teams should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		userID := th.GetUser1().ID
		initialTitle := "initial title 3"
		newTitle := "new title 3"

		newBoard1 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := th.Server.App().CreateBoard(newBoard1, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board1)

		newBoard2 := &model.Board{
			Title:  initialTitle,
			TeamID: "different-team-id",
			Type:   model.BoardTypeOpen,
		}
		board2, err := th.Server.App().CreateBoard(newBoard2, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board2)

		newBlock1 := &model.Block{
			ID:      "block-id-1",
			BoardID: board1.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock1, userID))
		block1, err := th.Server.App().GetBlockByID("block-id-1")
		require.NoError(t, err)
		require.NotNil(t, block1)

		newBlock2 := &model.Block{
			ID:      "block-id-2",
			BoardID: board2.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock2, userID))
		block2, err := th.Server.App().GetBlockByID("block-id-2")
		require.NoError(t, err)
		require.NotNil(t, block2)

		pbab := &model.PatchBoardsAndBlocks{
			BoardIDs: []string{board1.ID, board2.ID},
			BoardPatches: []*model.BoardPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
			BlockIDs: []string{block1.ID, "board-id-2"},
			BlockPatches: []*model.BlockPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
		}

		bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
		th.CheckBadRequest(resp)
		require.Nil(t, bab)
	})

	t.Run("patches should be rejected if one is invalid", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		userID := th.GetUser1().ID
		initialTitle := "initial title 4"
		newTitle := "new title 4"

		newBoard1 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := th.Server.App().CreateBoard(newBoard1, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board1)

		newBoard2 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := th.Server.App().CreateBoard(newBoard2, userID, false)
		require.NoError(t, err)
		require.NotNil(t, board2)

		newBlock1 := &model.Block{
			ID:      "block-id-1",
			BoardID: board1.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock1, userID))
		block1, err := th.Server.App().GetBlockByID("block-id-1")
		require.NoError(t, err)
		require.NotNil(t, block1)

		newBlock2 := &model.Block{
			ID:      "block-id-2",
			BoardID: board2.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock2, userID))
		block2, err := th.Server.App().GetBlockByID("block-id-2")
		require.NoError(t, err)
		require.NotNil(t, block2)

		var invalidPatchType model.BoardType = "invalid"
		invalidPatch := &model.BoardPatch{Type: &invalidPatchType}

		pbab := &model.PatchBoardsAndBlocks{
			BoardIDs: []string{board1.ID, board2.ID},
			BoardPatches: []*model.BoardPatch{
				{Title: &newTitle},
				invalidPatch,
			},
			BlockIDs: []string{block1.ID, "board-id-2"},
			BlockPatches: []*model.BlockPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
		}

		bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
		th.CheckBadRequest(resp)
		require.Nil(t, bab)
	})

	t.Run("patches should be rejected if there is a block that doesn't belong to the boards being patched", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		userID := th.GetUser1().ID
		initialTitle := "initial title"
		newTitle := "new patched title"

		newBoard1 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := th.Server.App().CreateBoard(newBoard1, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board1)

		newBoard2 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := th.Server.App().CreateBoard(newBoard2, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board2)

		newBlock1 := &model.Block{
			ID:      "block-id-1",
			BoardID: board1.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock1, userID))
		block1, err := th.Server.App().GetBlockByID("block-id-1")
		require.NoError(t, err)
		require.NotNil(t, block1)

		newBlock2 := &model.Block{
			ID:      "block-id-2",
			BoardID: board2.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock2, userID))
		block2, err := th.Server.App().GetBlockByID("block-id-2")
		require.NoError(t, err)
		require.NotNil(t, block2)

		pbab := &model.PatchBoardsAndBlocks{
			BoardIDs: []string{board1.ID},
			BoardPatches: []*model.BoardPatch{
				{Title: &newTitle},
			},
			BlockIDs: []string{block1.ID, block2.ID},
			BlockPatches: []*model.BlockPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
		}

		bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
		th.CheckBadRequest(resp)
		require.Nil(t, bab)
	})

	t.Run("patches should be applied if they're valid and they're related", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		userID := th.GetUser1().ID
		initialTitle := "initial title"
		newTitle := "new other title"

		newBoard1 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board1, err := th.Server.App().CreateBoard(newBoard1, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board1)

		newBoard2 := &model.Board{
			Title:  initialTitle,
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board2, err := th.Server.App().CreateBoard(newBoard2, userID, true)
		require.NoError(t, err)
		require.NotNil(t, board2)

		newBlock1 := &model.Block{
			ID:      "block-id-1",
			BoardID: board1.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock1, userID))
		block1, err := th.Server.App().GetBlockByID("block-id-1")
		require.NoError(t, err)
		require.NotNil(t, block1)

		newBlock2 := &model.Block{
			ID:      "block-id-2",
			BoardID: board2.ID,
			Title:   initialTitle,
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock2, userID))
		block2, err := th.Server.App().GetBlockByID("block-id-2")
		require.NoError(t, err)
		require.NotNil(t, block2)

		pbab := &model.PatchBoardsAndBlocks{
			BoardIDs: []string{board1.ID, board2.ID},
			BoardPatches: []*model.BoardPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
			BlockIDs: []string{block1.ID, block2.ID},
			BlockPatches: []*model.BlockPatch{
				{Title: &newTitle},
				{Title: &newTitle},
			},
		}

		bab, resp := th.Client.PatchBoardsAndBlocks(pbab)
		th.CheckOK(resp)
		require.NotNil(t, bab)
		require.Len(t, bab.Boards, 2)
		require.Len(t, bab.Blocks, 2)

		// ensure that the entities have been updated
		rBoard1, err := th.Server.App().GetBoard(board1.ID)
		require.NoError(t, err)
		require.Equal(t, newTitle, rBoard1.Title)
		rBlock1, err := th.Server.App().GetBlockByID(block1.ID)
		require.NoError(t, err)
		require.Equal(t, newTitle, rBlock1.Title)

		rBoard2, err := th.Server.App().GetBoard(board2.ID)
		require.NoError(t, err)
		require.Equal(t, newTitle, rBoard2.Title)
		rBlock2, err := th.Server.App().GetBlockByID(block2.ID)
		require.NoError(t, err)
		require.Equal(t, newTitle, rBlock2.Title)
	})
}

func TestDeleteBoardsAndBlocks(t *testing.T) {
	teamID := "team-id"

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).Start()
		defer th.TearDown()

		dbab := &model.DeleteBoardsAndBlocks{}

		success, resp := th.Client.DeleteBoardsAndBlocks(dbab)
		th.CheckUnauthorized(resp)
		require.False(t, success)
	})

	t.Run("invalid delete boards and blocks", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		// a board and a block are required for the permission checks
		newBoard := &model.Board{
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)
		require.NotNil(t, board)

		newBlock := &model.Block{
			ID:      "block-id-1",
			BoardID: board.ID,
			Title:   "title",
		}
		require.NoError(t, th.Server.App().InsertBlock(newBlock, th.GetUser1().ID))
		block, err := th.Server.App().GetBlockByID(newBlock.ID)
		require.NoError(t, err)
		require.NotNil(t, block)

		t.Run("no boards", func(t *testing.T) {
			dbab := &model.DeleteBoardsAndBlocks{
				Blocks: []string{block.ID},
			}

			success, resp := th.Client.DeleteBoardsAndBlocks(dbab)
			th.CheckBadRequest(resp)
			require.False(t, success)
		})

		t.Run("boards from different teams", func(t *testing.T) {
			newOtherTeamsBoard := &model.Board{
				TeamID: "another-team-id",
				Type:   model.BoardTypeOpen,
			}
			otherTeamsBoard, err := th.Server.App().CreateBoard(newOtherTeamsBoard, th.GetUser1().ID, true)
			require.NoError(t, err)
			require.NotNil(t, board)

			dbab := &model.DeleteBoardsAndBlocks{
				Boards: []string{board.ID, otherTeamsBoard.ID},
				Blocks: []string{"block-id-1"},
			}

			success, resp := th.Client.DeleteBoardsAndBlocks(dbab)
			th.CheckBadRequest(resp)
			require.False(t, success)
		})
	})

	t.Run("if the user has no permissions to one of the boards, nothing should be deleted", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		// the user is an admin of the first board
		newBoard1 := &model.Board{
			Type:   model.BoardTypeOpen,
			TeamID: "team_id_1",
		}
		board1, err := th.Server.App().CreateBoard(newBoard1, th.GetUser1().ID, true)
		require.NoError(t, err)
		require.NotNil(t, board1)

		// but not of the second
		newBoard2 := &model.Board{
			Type:   model.BoardTypeOpen,
			TeamID: "team_id_1",
		}
		board2, err := th.Server.App().CreateBoard(newBoard2, th.GetUser1().ID, false)
		require.NoError(t, err)
		require.NotNil(t, board2)

		dbab := &model.DeleteBoardsAndBlocks{
			Boards: []string{board1.ID, board2.ID},
			Blocks: []string{"block-id-1"},
		}

		success, resp := th.Client.DeleteBoardsAndBlocks(dbab)
		th.CheckForbidden(resp)
		require.False(t, success)
	})

	t.Run("all boards and blocks should be deleted if the request is correct", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBab := &model.BoardsAndBlocks{
			Boards: []*model.Board{
				{ID: "board-id-1", Title: "public board", TeamID: teamID, Type: model.BoardTypeOpen},
				{ID: "board-id-2", Title: "private board", TeamID: teamID, Type: model.BoardTypePrivate},
			},
			Blocks: []*model.Block{
				{ID: "block-id-1", Title: "block 1", BoardID: "board-id-1", Type: model.TypeCard, CreateAt: 1, UpdateAt: 1},
				{ID: "block-id-2", Title: "block 2", BoardID: "board-id-2", Type: model.TypeCard, CreateAt: 1, UpdateAt: 1},
			},
		}

		bab, err := th.Server.App().CreateBoardsAndBlocks(newBab, th.GetUser1().ID, true)
		require.NoError(t, err)
		require.Len(t, bab.Boards, 2)
		require.Len(t, bab.Blocks, 2)

		// ensure that the entities have been successfully created
		board1, err := th.Server.App().GetBoard("board-id-1")
		require.NoError(t, err)
		require.NotNil(t, board1)
		block1, err := th.Server.App().GetBlockByID("block-id-1")
		require.NoError(t, err)
		require.NotNil(t, block1)

		board2, err := th.Server.App().GetBoard("board-id-2")
		require.NoError(t, err)
		require.NotNil(t, board2)
		block2, err := th.Server.App().GetBlockByID("block-id-2")
		require.NoError(t, err)
		require.NotNil(t, block2)

		// call the API to delete boards and blocks
		dbab := &model.DeleteBoardsAndBlocks{
			Boards: []string{"board-id-1", "board-id-2"},
			Blocks: []string{"block-id-1", "block-id-2"},
		}

		success, resp := th.Client.DeleteBoardsAndBlocks(dbab)
		th.CheckOK(resp)
		require.True(t, success)

		// ensure that the entities have been successfully deleted
		board1, err = th.Server.App().GetBoard("board-id-1")
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, board1)
		block1, err = th.Server.App().GetBlockByID("block-id-1")
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, block1)

		board2, err = th.Server.App().GetBoard("board-id-2")
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, board2)
		block2, err = th.Server.App().GetBlockByID("block-id-2")
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, block2)
	})
}
