// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost/server/v8/boards/model"
)

type BlockDoesntBelongToBoardsErr struct {
	blockID string
}

func (e BlockDoesntBelongToBoardsErr) Error() string {
	return fmt.Sprintf("block %s doesn't belong to any of the boards in the delete request", e.blockID)
}

func (s *SQLStore) createBoardsAndBlocksWithAdmin(db sq.BaseRunner, bab *model.BoardsAndBlocks, userID string) (*model.BoardsAndBlocks, []*model.BoardMember, error) {
	newBab, err := s.createBoardsAndBlocks(db, bab, userID)
	if err != nil {
		return nil, nil, err
	}

	members := []*model.BoardMember{}
	for _, board := range newBab.Boards {
		bm := &model.BoardMember{
			BoardID:      board.ID,
			UserID:       board.CreatedBy,
			SchemeAdmin:  true,
			SchemeEditor: true,
		}

		nbm, err := s.saveMember(db, bm)
		if err != nil {
			return nil, nil, err
		}

		members = append(members, nbm)
	}

	return newBab, members, nil
}

func (s *SQLStore) createBoardsAndBlocks(db sq.BaseRunner, bab *model.BoardsAndBlocks, userID string) (*model.BoardsAndBlocks, error) {
	boards := []*model.Board{}
	blocks := []*model.Block{}

	for _, board := range bab.Boards {
		newBoard, err := s.insertBoard(db, board, userID)
		if err != nil {
			return nil, err
		}

		boards = append(boards, newBoard)
	}

	for _, block := range bab.Blocks {
		b := block
		err := s.insertBlock(db, b, userID)
		if err != nil {
			return nil, err
		}

		blocks = append(blocks, block)
	}

	newBab := &model.BoardsAndBlocks{
		Boards: boards,
		Blocks: blocks,
	}

	return newBab, nil
}

func (s *SQLStore) patchBoardsAndBlocks(db sq.BaseRunner, pbab *model.PatchBoardsAndBlocks, userID string) (*model.BoardsAndBlocks, error) {
	bab := &model.BoardsAndBlocks{}
	for i, boardID := range pbab.BoardIDs {
		board, err := s.patchBoard(db, boardID, pbab.BoardPatches[i], userID)
		if err != nil {
			return nil, err
		}
		bab.Boards = append(bab.Boards, board)
	}

	for i, blockID := range pbab.BlockIDs {
		if err := s.patchBlock(db, blockID, pbab.BlockPatches[i], userID); err != nil {
			return nil, err
		}
		block, err := s.getBlock(db, blockID)
		if err != nil {
			return nil, err
		}
		bab.Blocks = append(bab.Blocks, block)
	}

	return bab, nil
}

// deleteBoardsAndBlocks deletes all the boards and blocks entities of
// the DeleteBoardsAndBlocks struct, making sure that all the blocks
// belong to the boards in the struct.
func (s *SQLStore) deleteBoardsAndBlocks(db sq.BaseRunner, dbab *model.DeleteBoardsAndBlocks, userID string) error {
	boardIDMap := map[string]bool{}
	for _, boardID := range dbab.Boards {
		boardIDMap[boardID] = true
	}

	// delete the blocks first, since deleting the board will clean up any children and we'll get
	// not found errors when deleting the blocks after.
	for _, blockID := range dbab.Blocks {
		block, err := s.getBlock(db, blockID)
		if err != nil {
			return err
		}

		if _, ok := boardIDMap[block.BoardID]; !ok {
			return BlockDoesntBelongToBoardsErr{blockID}
		}

		if err := s.deleteBlock(db, blockID, userID); err != nil {
			return err
		}
	}

	for _, boardID := range dbab.Boards {
		if err := s.deleteBoard(db, boardID, userID); err != nil {
			return err
		}
	}

	return nil
}

func (s *SQLStore) duplicateBoard(db sq.BaseRunner, boardID string, userID string, toTeam string, asTemplate bool) (*model.BoardsAndBlocks, []*model.BoardMember, error) {
	bab := &model.BoardsAndBlocks{
		Boards: []*model.Board{},
		Blocks: []*model.Block{},
	}

	board, err := s.getBoard(db, boardID)
	if err != nil {
		return nil, nil, err
	}

	// todo: server localization
	if asTemplate == board.IsTemplate {
		// board -> board or template -> template
		board.Title += " copy"
	} else if asTemplate {
		// template from board
		board.Title = "New board template"
	}

	// make new board private
	board.Type = "P"
	board.IsTemplate = asTemplate
	board.CreatedBy = userID
	board.ChannelID = ""

	if toTeam != "" {
		board.TeamID = toTeam
	}

	bab.Boards = []*model.Board{board}
	blocks, err := s.getBlocks(db, model.QueryBlocksOptions{BoardID: boardID})
	if err != nil {
		return nil, nil, err
	}
	newBlocks := []*model.Block{}
	for _, b := range blocks {
		if b.Type != model.TypeComment {
			newBlocks = append(newBlocks, b)
		}
	}
	bab.Blocks = newBlocks

	bab, err = model.GenerateBoardsAndBlocksIDs(bab, nil)
	if err != nil {
		return nil, nil, err
	}

	return s.createBoardsAndBlocksWithAdmin(db, bab, userID)
}
