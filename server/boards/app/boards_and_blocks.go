// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/notify"

	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

func (a *App) CreateBoardsAndBlocks(bab *model.BoardsAndBlocks, userID string, addMember bool) (*model.BoardsAndBlocks, error) {
	var newBab *model.BoardsAndBlocks
	var members []*model.BoardMember
	var err error

	if addMember {
		newBab, members, err = a.store.CreateBoardsAndBlocksWithAdmin(bab, userID)
	} else {
		newBab, err = a.store.CreateBoardsAndBlocks(bab, userID)
	}

	if err != nil {
		return nil, err
	}

	// all new boards should belong to the same team
	teamID := newBab.Boards[0].TeamID

	// This can be synchronous because this action is not common
	for _, board := range newBab.Boards {
		a.wsAdapter.BroadcastBoardChange(teamID, board)
	}

	for _, block := range newBab.Blocks {
		b := block
		a.wsAdapter.BroadcastBlockChange(teamID, b)
		a.metrics.IncrementBlocksInserted(1)
		a.webhook.NotifyUpdate(b)
		a.notifyBlockChanged(notify.Add, b, nil, userID)
	}

	if addMember {
		for _, member := range members {
			a.wsAdapter.BroadcastMemberChange(teamID, member.BoardID, member)
		}
	}

	if len(newBab.Blocks) != 0 {
		go func() {
			if uErr := a.UpdateCardLimitTimestamp(); uErr != nil {
				a.logger.Error(
					"UpdateCardLimitTimestamp failed after creating boards and blocks",
					mlog.Err(uErr),
				)
			}
		}()
	}

	for _, board := range newBab.Boards {
		if !board.IsTemplate {
			if err := a.addBoardsToDefaultCategory(userID, board.TeamID, []*model.Board{board}); err != nil {
				return nil, err
			}
		}
	}

	return newBab, nil
}

func (a *App) PatchBoardsAndBlocks(pbab *model.PatchBoardsAndBlocks, userID string) (*model.BoardsAndBlocks, error) {
	oldBlocks, err := a.store.GetBlocksByIDs(pbab.BlockIDs)
	if err != nil {
		return nil, err
	}

	if a.IsCloudLimited() {
		containsLimitedBlocks, cErr := a.ContainsLimitedBlocks(oldBlocks)
		if cErr != nil {
			return nil, cErr
		}
		if containsLimitedBlocks {
			return nil, model.ErrPatchUpdatesLimitedCards
		}
	}

	oldBlocksMap := map[string]*model.Block{}
	for _, block := range oldBlocks {
		oldBlocksMap[block.ID] = block
	}

	bab, err := a.store.PatchBoardsAndBlocks(pbab, userID)
	if err != nil {
		return nil, err
	}

	a.blockChangeNotifier.Enqueue(func() error {
		teamID := bab.Boards[0].TeamID

		for _, block := range bab.Blocks {
			oldBlock, ok := oldBlocksMap[block.ID]
			if !ok {
				a.logger.Error("Error notifying for block change on patch boards and blocks; cannot get old block", mlog.String("blockID", block.ID))
				continue
			}

			b := block
			a.metrics.IncrementBlocksPatched(1)
			a.wsAdapter.BroadcastBlockChange(teamID, b)
			a.webhook.NotifyUpdate(b)
			a.notifyBlockChanged(notify.Update, b, oldBlock, userID)
		}

		for _, board := range bab.Boards {
			a.wsAdapter.BroadcastBoardChange(board.TeamID, board)
		}
		return nil
	})

	return bab, nil
}

func (a *App) DeleteBoardsAndBlocks(dbab *model.DeleteBoardsAndBlocks, userID string) error {
	firstBoard, err := a.store.GetBoard(dbab.Boards[0])
	if err != nil {
		return err
	}

	// we need the block entity to notify of the block changes, so we
	// fetch and store the blocks first
	blocks := []*model.Block{}
	for _, blockID := range dbab.Blocks {
		block, err := a.store.GetBlock(blockID)
		if err != nil {
			return err
		}
		blocks = append(blocks, block)
	}

	if err := a.store.DeleteBoardsAndBlocks(dbab, userID); err != nil {
		return err
	}

	a.blockChangeNotifier.Enqueue(func() error {
		for _, block := range blocks {
			a.wsAdapter.BroadcastBlockDelete(firstBoard.TeamID, block.ID, block.BoardID)
			a.metrics.IncrementBlocksDeleted(1)
			a.notifyBlockChanged(notify.Update, block, block, userID)
		}

		for _, boardID := range dbab.Boards {
			a.wsAdapter.BroadcastBoardDelete(firstBoard.TeamID, boardID)
		}
		return nil
	})

	if len(dbab.Blocks) != 0 {
		go func() {
			if uErr := a.UpdateCardLimitTimestamp(); uErr != nil {
				a.logger.Error(
					"UpdateCardLimitTimestamp failed after deleting boards and blocks",
					mlog.Err(uErr),
				)
			}
		}()
	}

	return nil
}
