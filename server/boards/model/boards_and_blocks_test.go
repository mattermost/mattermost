package model

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func TestIsValidBoardsAndBlocks(t *testing.T) {
	t.Run("no boards", func(t *testing.T) {
		bab := &BoardsAndBlocks{
			Blocks: []*Block{
				{ID: "block-id-1", BoardID: "board-id-1", Type: TypeCard},
				{ID: "block-id-2", BoardID: "board-id-2", Type: TypeCard},
			},
		}

		require.ErrorIs(t, bab.IsValid(), ErrNoBoardsInBoardsAndBlocks)
	})

	t.Run("no blocks", func(t *testing.T) {
		bab := &BoardsAndBlocks{
			Boards: []*Board{
				{ID: "board-id-1", Type: BoardTypeOpen},
				{ID: "board-id-2", Type: BoardTypePrivate},
			},
		}

		require.ErrorIs(t, bab.IsValid(), ErrNoBlocksInBoardsAndBlocks)
	})

	t.Run("block that doesn't belong to the boards", func(t *testing.T) {
		bab := &BoardsAndBlocks{
			Boards: []*Board{
				{ID: "board-id-1", Type: BoardTypeOpen},
				{ID: "board-id-2", Type: BoardTypePrivate},
			},
			Blocks: []*Block{
				{ID: "block-id-1", BoardID: "board-id-1", Type: TypeCard},
				{ID: "block-id-3", BoardID: "board-id-3", Type: TypeCard},
				{ID: "block-id-2", BoardID: "board-id-2", Type: TypeCard},
			},
		}

		require.ErrorIs(t, bab.IsValid(), BlockDoesntBelongToAnyBoardErr{"block-id-3"})
	})

	t.Run("valid boards and blocks", func(t *testing.T) {
		bab := &BoardsAndBlocks{
			Boards: []*Board{
				{ID: "board-id-1", Type: BoardTypeOpen},
				{ID: "board-id-2", Type: BoardTypePrivate},
			},
			Blocks: []*Block{
				{ID: "block-id-1", BoardID: "board-id-1", Type: TypeCard},
				{ID: "block-id-3", BoardID: "board-id-2", Type: TypeCard},
				{ID: "block-id-2", BoardID: "board-id-2", Type: TypeCard},
			},
		}

		require.NoError(t, bab.IsValid())
	})
}

func TestGenerateBoardsAndBlocksIDs(t *testing.T) {
	logger, err := mlog.NewLogger()
	require.NoError(t, err)

	getBlockByType := func(blocks []*Block, blockType BlockType) *Block {
		for _, b := range blocks {
			if b.Type == blockType {
				return b
			}
		}
		return &Block{}
	}

	getBoardByTitle := func(boards []*Board, title string) *Board {
		for _, b := range boards {
			if b.Title == title {
				return b
			}
		}
		return nil
	}

	t.Run("invalid boards and blocks", func(t *testing.T) {
		bab := &BoardsAndBlocks{
			Blocks: []*Block{
				{ID: "block-id-1", BoardID: "board-id-1", Type: TypeCard},
				{ID: "block-id-2", BoardID: "board-id-2", Type: TypeCard},
			},
		}

		rBab, err := GenerateBoardsAndBlocksIDs(bab, logger)
		require.Error(t, err)
		require.Nil(t, rBab)
	})

	t.Run("correctly generates IDs for all the boards and links the blocks to them, with new IDs too", func(t *testing.T) {
		bab := &BoardsAndBlocks{
			Boards: []*Board{
				{ID: "board-id-1", Type: BoardTypeOpen, Title: "board1"},
				{ID: "board-id-2", Type: BoardTypePrivate, Title: "board2"},
				{ID: "board-id-3", Type: BoardTypeOpen, Title: "board3"},
			},
			Blocks: []*Block{
				{ID: "block-id-1", BoardID: "board-id-1", Type: TypeCard},
				{ID: "block-id-2", BoardID: "board-id-2", Type: TypeView},
				{ID: "block-id-3", BoardID: "board-id-2", Type: TypeText},
			},
		}

		rBab, err := GenerateBoardsAndBlocksIDs(bab, logger)
		require.NoError(t, err)
		require.NotNil(t, rBab)

		// all boards and blocks should have refreshed their IDs, and
		// blocks should be correctly linked to the new board IDs
		board1 := getBoardByTitle(rBab.Boards, "board1")
		require.NotNil(t, board1)
		require.NotEmpty(t, board1.ID)
		require.NotEqual(t, "board-id-1", board1.ID)
		board2 := getBoardByTitle(rBab.Boards, "board2")
		require.NotNil(t, board2)
		require.NotEmpty(t, board2.ID)
		require.NotEqual(t, "board-id-2", board2.ID)
		board3 := getBoardByTitle(rBab.Boards, "board3")
		require.NotNil(t, board3)
		require.NotEmpty(t, board3.ID)
		require.NotEqual(t, "board-id-3", board3.ID)

		block1 := getBlockByType(rBab.Blocks, TypeCard)
		require.NotNil(t, block1)
		require.NotEmpty(t, block1.ID)
		require.NotEqual(t, "block-id-1", block1.ID)
		require.Equal(t, board1.ID, block1.BoardID)
		block2 := getBlockByType(rBab.Blocks, TypeView)
		require.NotNil(t, block2)
		require.NotEmpty(t, block2.ID)
		require.NotEqual(t, "block-id-2", block2.ID)
		require.Equal(t, board2.ID, block2.BoardID)
		block3 := getBlockByType(rBab.Blocks, TypeText)
		require.NotNil(t, block3)
		require.NotEmpty(t, block3.ID)
		require.NotEqual(t, "block-id-3", block3.ID)
		require.Equal(t, board2.ID, block3.BoardID)
	})
}

func TestIsValidPatchBoardsAndBlocks(t *testing.T) {
	newTitle := "new title"
	newDescription := "new description"
	var schema int64 = 1

	t.Run("no board ids", func(t *testing.T) {
		pbab := &PatchBoardsAndBlocks{
			BoardIDs: []string{},
			BlockIDs: []string{"block-id-1"},
			BlockPatches: []*BlockPatch{
				{Title: &newTitle},
				{Schema: &schema},
			},
		}

		require.ErrorIs(t, pbab.IsValid(), ErrNoBoardsInBoardsAndBlocks)
	})

	t.Run("missmatch board IDs and patches", func(t *testing.T) {
		pbab := &PatchBoardsAndBlocks{
			BoardIDs: []string{"board-id-1", "board-id-2"},
			BoardPatches: []*BoardPatch{
				{Title: &newTitle},
			},
			BlockIDs: []string{"block-id-1"},
			BlockPatches: []*BlockPatch{
				{Title: &newTitle},
			},
		}

		require.ErrorIs(t, pbab.IsValid(), ErrBoardIDsAndPatchesMissmatchInBoardsAndBlocks)
	})

	t.Run("missmatch block IDs and patches", func(t *testing.T) {
		pbab := &PatchBoardsAndBlocks{
			BoardIDs: []string{"board-id-1", "board-id-2"},
			BoardPatches: []*BoardPatch{
				{Title: &newTitle},
				{Description: &newDescription},
			},
			BlockIDs: []string{"block-id-1"},
			BlockPatches: []*BlockPatch{
				{Title: &newTitle},
				{Schema: &schema},
			},
		}

		require.ErrorIs(t, pbab.IsValid(), ErrBlockIDsAndPatchesMissmatchInBoardsAndBlocks)
	})

	t.Run("valid", func(t *testing.T) {
		pbab := &PatchBoardsAndBlocks{
			BoardIDs: []string{"board-id-1", "board-id-2"},
			BoardPatches: []*BoardPatch{
				{Title: &newTitle},
				{Description: &newDescription},
			},
			BlockIDs: []string{"block-id-1"},
			BlockPatches: []*BlockPatch{
				{Title: &newTitle},
			},
		}

		require.NoError(t, pbab.IsValid())
	})
}

func TestIsValidDeleteBoardsAndBlocks(t *testing.T) {
	/*
		TODO fix this
		t.Run("no board ids", func(t *testing.T) {
			dbab := &DeleteBoardsAndBlocks{
				TeamID: "team-id",
				Blocks: []string{"block-id-1"},
			}

			require.ErrorIs(t, dbab.IsValid(), NoBoardsInBoardsAndBlocksErr)
		})

		t.Run("no block ids", func(t *testing.T) {
			dbab := &DeleteBoardsAndBlocks{
				TeamID: "team-id",
				Boards: []string{"board-id-1", "board-id-2"},
			}

			require.ErrorIs(t, dbab.IsValid(), NoBlocksInBoardsAndBlocksErr)
		})

		t.Run("valid", func(t *testing.T) {
			dbab := &DeleteBoardsAndBlocks{
				TeamID: "team-id",
				Boards: []string{"board-id-1", "board-id-2"},
				Blocks: []string{"block-id-1"},
			}

			require.NoError(t, dbab.IsValid())
		})
	*/
}
